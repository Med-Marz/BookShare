const pino = require('pino');

// Structured JSON logs to stdout; pino-pretty in dev only for readable terminal output.
const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'gateway' },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      }
    : {}),
});

module.exports = logger;
