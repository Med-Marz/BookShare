const { Kafka } = require('kafkajs');

const BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
const TOPICS = ['book.reserved', 'reservation.cancelled', 'loan.started', 'loan.returned'];

// Status transition table — book status only advances when the source state
// matches what the topic implies. Defensive against replays and out-of-order
// delivery.
const TRANSITIONS = {
  'book.reserved':         { from: 'Available', to: 'Reserved' },
  'reservation.cancelled': { from: 'Reserved',  to: 'Available' },
  'loan.started':          { from: 'Reserved',  to: 'Lent Out' },
  'loan.returned':         { from: 'Lent Out',  to: 'Available' },
};

// In-memory dedup: skip events we've already processed (Kafka at-least-once).
// Survives the consumer process lifetime — adequate for our scale.
const processedEventIds = new Set();

async function init(db, logger) {
  const kafka = new Kafka({ clientId: 'book-svc', brokers: BROKERS });
  const consumer = kafka.consumer({ groupId: 'book-service.book-status' });
  await consumer.connect();
  for (const topic of TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const envelope = JSON.parse(message.value.toString('utf8'));
        const eventId = envelope?.eventId;
        if (!eventId) {
          logger.warn({ topic }, 'kafka message missing eventId');
          return;
        }
        if (processedEventIds.has(eventId)) return; // dedup
        processedEventIds.add(eventId);

        const bookId = envelope?.data?.book_id;
        if (!bookId) {
          logger.warn({ topic, envelope }, 'kafka message missing data.book_id');
          return;
        }
        const transition = TRANSITIONS[topic];
        if (!transition) {
          logger.warn({ topic }, 'unknown topic — ignored');
          return;
        }

        const doc = await db.collection.findOne({ selector: { id: bookId } }).exec();
        if (!doc) {
          logger.warn(
            {
              event: 'book.status.transition.skip',
              topic,
              event_id: eventId,
              book_id: bookId,
              reason: 'book_not_found',
            },
            'book not found for kafka transition',
          );
          return;
        }
        if (doc.status !== transition.from) {
          logger.warn(
            {
              event: 'book.status.transition.skip',
              topic,
              event_id: eventId,
              book_id: bookId,
              current: doc.status,
              expected_from: transition.from,
              reason: 'unexpected_source_state',
            },
            'kafka transition skipped',
          );
          return;
        }
        await doc.patch({
          status: transition.to,
          updated_at: new Date().toISOString(),
        });
        logger.info(
          {
            event: 'book.status.transition',
            topic,
            event_id: eventId,
            book_id: bookId,
            from: transition.from,
            to: transition.to,
          },
          'book status updated by kafka',
        );
      } catch (err) {
        logger.error({ err, topic }, 'kafka consumer error');
      }
    },
  });

  logger.info({ brokers: BROKERS, topics: TOPICS, group_id: 'book-service.book-status' }, 'kafka consumer running');
  return consumer;
}

module.exports = { init };
