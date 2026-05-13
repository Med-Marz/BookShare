const http = require('node:http');
const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const pino = require('pino');

// ---- Service identity ----
const SERVICE_NAME = 'user-service';
const PROTO_FILE = 'user.proto';
const PROTO_PACKAGE = 'user';
const PROTO_SERVICE = 'UserService';
const GRPC_PORT = Number.parseInt(process.env.USER_GRPC_PORT || '50051', 10);
const HEALTH_PORT = Number.parseInt(process.env.USER_HEALTH_PORT || '50061', 10);

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

// ---- Empty handler set — every RPC currently returns UNIMPLEMENTED ----
// Real RPCs land in story 1.2+ (CreateUser, AuthenticateUser, ...).
const handlers = {};
for (const methodName of Object.keys(serviceDef)) {
  handlers[methodName] = (_call, callback) => {
    callback({
      code: grpc.status.UNIMPLEMENTED,
      message: `${PROTO_SERVICE}.${methodName} not implemented yet — stub from story 1.1.`,
    });
  };
}

// ---- gRPC server ----
const server = new grpc.Server();
if (Object.keys(serviceDef).length > 0) {
  server.addService(serviceDef, handlers);
}

server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err) => {
  if (err) {
    logger.fatal({ err }, 'gRPC server failed to bind');
    process.exit(1);
  }
  logger.info({ port: GRPC_PORT, proto: PROTO_FILE }, 'gRPC server listening');

  // ---- Tiny HTTP /health server — only after gRPC is bound ----
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

// ---- Graceful shutdown ----
function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.tryShutdown(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
