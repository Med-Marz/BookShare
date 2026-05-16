const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '..', '..', '..', '..', 'proto', 'loan.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const loanProto = grpc.loadPackageDefinition(packageDefinition).loan;

const LOAN_GRPC_HOST = process.env.LOAN_GRPC_HOST || 'loan-service';
const LOAN_GRPC_PORT = process.env.LOAN_GRPC_PORT || '50053';

const client = new loanProto.LoanService(
  `${LOAN_GRPC_HOST}:${LOAN_GRPC_PORT}`,
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
  reserve: unary('Reserve'),
  cancelReservation: unary('CancelReservation'),
  startLoan: unary('StartLoan'),
  markReturned: unary('MarkReturned'),
  getMyActiveReservationOnBook: unary('GetMyActiveReservationOnBook'),
};
