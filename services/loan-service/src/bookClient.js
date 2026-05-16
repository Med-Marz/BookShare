const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '..', '..', '..', 'proto', 'book.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const bookProto = grpc.loadPackageDefinition(packageDefinition).book;

const BOOK_GRPC_HOST = process.env.BOOK_GRPC_HOST || 'book-service';
const BOOK_GRPC_PORT = process.env.BOOK_GRPC_PORT || '50052';

// Singleton client. Loan-service only calls GetBook (for Reserve validation).
const client = new bookProto.BookService(
  `${BOOK_GRPC_HOST}:${BOOK_GRPC_PORT}`,
  grpc.credentials.createInsecure(),
);

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
  getBook: unary('GetBook'),
};
