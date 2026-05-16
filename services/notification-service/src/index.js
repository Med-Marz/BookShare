const http = require('node:http');
const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const pino = require('pino');

const db = require('./db');
const bookClient = require('./bookClient');
const userClient = require('./userClient');
const kafkaConsumer = require('./kafkaConsumer');
const { makeHandlers } = require('./handlers');

// ---- Service identity ----
const SERVICE_NAME = 'notification-service';
const PROTO_FILE = 'notification.proto';
const PROTO_PACKAGE = 'notification';
const PROTO_SERVICE = 'NotificationService';
const GRPC_PORT = Number.parseInt(process.env.NOTIFICATION_GRPC_PORT || '50054', 10);
const HEALTH_PORT = Number.parseInt(process.env.NOTIFICATION_HEALTH_PORT || '50064', 10);

// ---- Logger ----
const isDev = process.env.NODE_ENV !== 'production';
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: SERVICE_NAME },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      }
    : {}),
});

// ---- Load the shared proto contract ----
const PROTO_PATH = path.join(__dirname, '..', '..', '..', 'proto', PROTO_FILE);
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const protoPackage = grpc.loadPackageDefinition(packageDefinition)[PROTO_PACKAGE];
const serviceDef = protoPackage[PROTO_SERVICE].service;

let consumer;

async function start() {
  const { dbPath } = await db.init();
  logger.info({ db_path: dbPath }, 'SQLite ready');

  // The consumer connects before the gRPC server binds — preserves the
  // boot ordering invariant from book-service so we don't accept reads
  // while the Kafka side is still wiring up.
  consumer = await kafkaConsumer.init({ db, bookClient, userClient, logger });

  const realHandlers = makeHandlers({ db, logger });
  const handlers = {};
  for (const methodName of Object.keys(serviceDef)) {
    if (realHandlers[methodName]) {
      handlers[methodName] = realHandlers[methodName];
    } else {
      handlers[methodName] = (_call, callback) => {
        callback({
          code: grpc.status.UNIMPLEMENTED,
          message: `${PROTO_SERVICE}.${methodName} not implemented yet.`,
        });
      };
    }
  }

  const server = new grpc.Server();
  server.addService(serviceDef, handlers);

  server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err) => {
    if (err) {
      logger.fatal({ err }, 'gRPC server failed to bind');
      process.exit(1);
    }
    logger.info({ port: GRPC_PORT, proto: PROTO_FILE }, 'gRPC server listening');

    const healthServer = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: SERVICE_NAME }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'No such route' } }));
    });

    healthServer.listen(HEALTH_PORT, () => {
      logger.info({ port: HEALTH_PORT }, 'health HTTP server listening');
    });
  });

  function shutdown(signal) {
    logger.info({ signal }, 'shutting down');
    server.tryShutdown(async () => {
      if (consumer) await consumer.disconnect().catch(() => {});
      await db.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.fatal({ err }, 'failed to start notification-service');
  process.exit(1);
});
