import axios from './axios';

// POST /api/v1/books/:id/reservations — authenticated borrower reserves.
export async function reserveBook(bookId) {
  const res = await axios.post(`/api/v1/books/${bookId}/reservations`);
  return res.data.reservation;
}

// DELETE /api/v1/reservations/:id — borrower cancels their own active reservation.
export async function cancelReservation(reservationId) {
  const res = await axios.delete(`/api/v1/reservations/${reservationId}`);
  return res.data.reservation;
}

// POST /api/v1/reservations/:id/start-loan — owner marks the loan started.
export async function startLoan(reservationId) {
  const res = await axios.post(`/api/v1/reservations/${reservationId}/start-loan`);
  return res.data.reservation;
}

// POST /api/v1/reservations/:id/mark-returned — owner marks the book returned.
export async function markReturned(reservationId) {
  const res = await axios.post(`/api/v1/reservations/${reservationId}/mark-returned`);
  return res.data.reservation;
}
