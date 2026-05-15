const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '..', '..', '..', '..', 'proto', 'book.proto');
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

// Singleton client — built once at module load, reused by every request.
// Bumped max message size to 16 MB so 10 MB cover bytes ride comfortably.
const SIXTEEN_MB = 16 * 1024 * 1024;
const client = new bookProto.BookService(
  `${BOOK_GRPC_HOST}:${BOOK_GRPC_PORT}`,
  grpc.credentials.createInsecure(),
  {
    'grpc.max_send_message_length': SIXTEEN_MB,
    'grpc.max_receive_message_length': SIXTEEN_MB,
  },
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
  addBook: unary('AddBook'),
  getBook: unary('GetBook'),
  editBook: unary('EditBook'),
  replaceCover: unary('ReplaceCover'),
  deleteBook: unary('DeleteBook'),
  getCoverBytes: unary('GetCoverBytes'),
  listBooksByOwner: unary('ListBooksByOwner'),
  listRecentBooks: unary('ListRecentBooks'),
};
