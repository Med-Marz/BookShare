const { randomUUID } = require('node:crypto');
const { Kafka } = require('kafkajs');

const BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
const kafka = new Kafka({ clientId: 'loan-svc', brokers: BROKERS });
const producer = kafka.producer();
let connected = false;

async function init(logger) {
  await producer.connect();
  connected = true;
  logger.info({ brokers: BROKERS }, 'kafka producer connected');
}

async function emit({ topic, key, actorId, data }, logger) {
  if (!connected) throw new Error('kafka producer not connected');
  const envelope = {
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    actorId,
    data,
  };
  await producer.send({
    topic,
    messages: [{ key, value: JSON.stringify(envelope) }],
  });
  if (logger) {
    logger.info(
      {
        event: 'kafka.emit',
        topic,
        event_id: envelope.eventId,
        key,
        actor_id: actorId,
      },
      'kafka event emitted',
    );
  }
}

async function close() {
  if (connected) await producer.disconnect();
}

module.exports = { init, emit, close };
