const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Load the shared proto contract from the repo-wide /proto directory.
const PROTO_PATH = path.join(__dirname, '..', '..', '..', '..', 'proto', 'user.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const userProto = grpc.loadPackageDefinition(packageDefinition).user;

const USER_GRPC_HOST = process.env.USER_GRPC_HOST || 'user-service';
const USER_GRPC_PORT = process.env.USER_GRPC_PORT || '50051';

// Singleton client — built once at module load, reused by every request.
const client = new userProto.UserService(
  `${USER_GRPC_HOST}:${USER_GRPC_PORT}`,
  grpc.credentials.createInsecure(),
);

// Promisify a unary RPC. Resolves with the response on success, rejects with
// the raw gRPC error (which already carries `.code` so `mapGrpcError` can map
// it to the right HTTP status).
function unary(method) {
  return (request, metadata) =>
    new Promise((resolve, reject) => {
      client[method](request, metadata || new grpc.Metadata(), (err, response) => {
        if (err) return reject(err);
        resolve(response);
      });
    });
}

module.exports = {
  client,
  createUser: unary('CreateUser'),
};
