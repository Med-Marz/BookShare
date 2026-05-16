const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
const TOPICS = ['book.reserved', 'reservation.cancelled', 'loan.started', 'loan.returned'];
const CONSUMER_GROUP_ID = 'notification-service.notifier';

// Per-topic routing. The recipient/actor inversion between reserve+cancel
// (owner is the recipient) and loan-started+returned (borrower is the
// recipient) is the meaningful product detail — both sides need to know
// when something changes around their book.
//
// All look-ups happen at consumption time so the read API stays a pure DB
// fetch. Trade-off: a slower consumer for a simpler ListNotifications.
const ROUTING = {
  'book.reserved': {
    recipient: (d) => d.owner_id,
    actor: (d) => d.borrower_id,
    message: ({ actorName, bookTitle }) =>
      `${actorName} reserved your book "${bookTitle}"`,
  },
  'reservation.cancelled': {
    recipient: (d) => d.owner_id,
    actor: (d) => d.borrower_id,
    message: ({ actorName, bookTitle }) =>
      `${actorName} cancelled their reservation on your book "${bookTitle}"`,
  },
  'loan.started': {
    recipient: (d) => d.borrower_id,
    actor: (d) => d.owner_id,
    message: ({ actorName, bookTitle }) =>
      `Your loan of "${bookTitle}" has been started by ${actorName}`,
  },
  'loan.returned': {
    recipient: (d) => d.borrower_id,
    actor: (d) => d.owner_id,
    message: ({ actorName, bookTitle }) =>
      `Your return of "${bookTitle}" has been confirmed by ${actorName}`,
  },
};

async function resolveBookTitle(bookClient, bookId, logger) {
  try {
    const { book } = await bookClient.getBook({ book_id: bookId });
    return book?.title || `<book #${bookId}>`;
  } catch (err) {
    logger.warn(
      { err: err?.message || err, book_id: bookId },
      'failed to resolve book title; falling back',
    );
    return `<book #${bookId}>`;
  }
}

async function resolveUserName(userClient, userId, logger) {
  try {
    const { user } = await userClient.getUser({ user_id: userId });
    return user?.display_name || `<user #${userId}>`;
  } catch (err) {
    logger.warn(
      { err: err?.message || err, user_id: userId },
      'failed to resolve user display_name; falling back',
    );
    return `<user #${userId}>`;
  }
}

async function init({ db, bookClient, userClient, logger }) {
  const kafka = new Kafka({ clientId: 'notification-svc', brokers: BROKERS });
  const consumer = kafka.consumer({ groupId: CONSUMER_GROUP_ID });
  await consumer.connect();
  for (const topic of TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const raw = message.value?.toString('utf8');
        if (!raw) {
          logger.error({ event: 'notification.bad_message', topic }, 'empty kafka payload');
          return;
        }
        let envelope;
        try {
          envelope = JSON.parse(raw);
        } catch (parseErr) {
          logger.error(
            { event: 'notification.bad_message', topic, err: parseErr?.message },
            'invalid JSON envelope',
          );
          return;
        }
        const { eventId, occurredAt, data } = envelope || {};
        if (!eventId || !data || !data.book_id || !data.reservation_id) {
          logger.error(
            { event: 'notification.bad_message', topic, envelope },
            'envelope missing required fields',
          );
          return;
        }

        const route = ROUTING[topic];
        if (!route) {
          logger.error({ event: 'notification.bad_message', topic }, 'unknown topic');
          return;
        }

        const recipientId = route.recipient(data);
        const actorId = route.actor(data);
        const [bookTitle, actorName] = await Promise.all([
          resolveBookTitle(bookClient, data.book_id, logger),
          resolveUserName(userClient, actorId, logger),
        ]);

        const row = {
          id: uuidv4(),
          event_id: eventId,
          topic,
          recipient_actor_id: recipientId,
          actor_id: actorId,
          book_id: data.book_id,
          reservation_id: data.reservation_id,
          message: route.message({ actorName, bookTitle }),
          occurred_at: occurredAt || new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        try {
          await db.insertNotification(row);
        } catch (insertErr) {
          if (insertErr?.code === 'DUPLICATE_EVENT') {
            logger.info(
              { event: 'notification.duplicate', topic, event_id: eventId },
              'duplicate event_id — skipping',
            );
            return;
          }
          throw insertErr;
        }

        logger.info(
          {
            event: 'notification.created',
            topic,
            event_id: eventId,
            key: message.key?.toString('utf8'),
            recipient_actor_id: recipientId,
            actor_id: actorId,
            book_id: data.book_id,
            reservation_id: data.reservation_id,
            message: row.message,
          },
          'notification persisted',
        );
      } catch (err) {
        logger.error({ err: err?.message || err, topic }, 'notification consumer error');
      }
    },
  });

  logger.info(
    { brokers: BROKERS, topics: TOPICS, group_id: CONSUMER_GROUP_ID },
    'kafka consumer running',
  );
  return consumer;
}

module.exports = { init, CONSUMER_GROUP_ID };
