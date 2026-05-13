const grpc = require('@grpc/grpc-js');

// Canonical gRPC status.Code → HTTP status + error-code mapping. This is the
// only place that translates between protocols; every REST route and every
// Apollo resolver routes errors through here.
//
// Codes match the architecture's standard envelope:
//   { error: { code: '<UPPER_SNAKE>', message: '<human>' } }
const grpcToHttp = {
  [grpc.status.OK]: { status: 200, code: 'OK' },
  [grpc.status.INVALID_ARGUMENT]: { status: 400, code: 'VALIDATION_ERROR' },
  [grpc.status.UNAUTHENTICATED]: { status: 401, code: 'AUTHENTICATION_REQUIRED' },
  [grpc.status.PERMISSION_DENIED]: { status: 403, code: 'FORBIDDEN' },
  [grpc.status.NOT_FOUND]: { status: 404, code: 'NOT_FOUND' },
  [grpc.status.ALREADY_EXISTS]: { status: 409, code: 'CONFLICT' },
  [grpc.status.FAILED_PRECONDITION]: { status: 409, code: 'CONFLICT' },
  [grpc.status.RESOURCE_EXHAUSTED]: { status: 429, code: 'RATE_LIMITED' },
  [grpc.status.UNAVAILABLE]: { status: 503, code: 'SERVICE_UNAVAILABLE' },
  [grpc.status.INTERNAL]: { status: 500, code: 'INTERNAL_ERROR' },
};

function mapGrpcError(err) {
  const mapping = grpcToHttp[err?.code] || { status: 500, code: 'INTERNAL_ERROR' };
  return {
    status: mapping.status,
    body: {
      error: {
        code: mapping.code,
        message: err?.details || err?.message || 'Unexpected error',
      },
    },
  };
}

// Express error-handling middleware. Routes throw or `next(err)` — this catches
// gRPC errors and any thrown error, then returns the standard envelope.
function errorHandler(err, req, res, _next) {
  const { status, body } = mapGrpcError(err);
  if (req.log) {
    req.log.error({ err, status, code: body.error.code }, 'request failed');
  }
  res.status(status).json(body);
}

module.exports = { mapGrpcError, errorHandler };
