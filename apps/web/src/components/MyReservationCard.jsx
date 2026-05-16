import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import { coverUrl } from '../api/covers';
import { formatYear } from '../utils/formatYear';
import { badgeClassFor, formatStateTimestamp, labelFor } from '../utils/reservationStatus';

// Borrower-side reservation card. Two variants:
//   full    — used on /reservations; shows owner contact + Cancel button when Active.
//   compact — used on /profile (top-3 active panel); smaller cover, no contact, no Cancel.
function MyReservationCard({ reservation, variant = 'full', onCancel }) {
  const compact = variant === 'compact';
  const { book, owner, state } = reservation;
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirmCancel() {
    if (!onCancel) return;
    setWorking(true);
    setError(null);
    try {
      await onCancel(reservation);
      setConfirming(false);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not cancel reservation.');
    } finally {
      setWorking(false);
    }
  }

  const coverImg = book?.cover_object_key ? (
    <img
      src={coverUrl(book.cover_object_key)}
      alt={`${book.title || 'Unknown book'} cover`}
      loading="lazy"
      className="h-full w-full object-cover"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-paperDark/30 text-sepiaSoft text-xs">
      No cover
    </div>
  );

  return (
    <article className="card-surface flex gap-4 p-4">
      <Link
        to={book?.id ? `/books/${book.id}` : '#'}
        className={`shrink-0 overflow-hidden rounded-md no-underline ${
          compact ? 'h-20 w-14' : 'h-32 w-24 sm:h-40 sm:w-28'
        }`}
        aria-label={`Open ${book?.title || 'book'}`}
      >
        {coverImg}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Link
              to={book?.id ? `/books/${book.id}` : '#'}
              className="font-display text-lg text-sepiaDark no-underline hover:text-bordeaux"
            >
              {book?.title || 'Unknown book'}
            </Link>
            {book?.author && (
              <p className="text-sm text-sepiaSoft">
                {book.author}
                {book.year_published ? ` · ${formatYear(book.year_published)}` : ''}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClassFor(state)}`}
          >
            {labelFor(state)}
          </span>
        </div>

        <p className="text-xs text-sepiaSoft">{formatStateTimestamp(reservation)}</p>

        {!compact && owner && (
          <div className="mt-2 rounded-md border border-paper bg-paper/40 p-3 text-sm">
            <p className="font-medium text-sepiaDark">
              {owner.display_name || 'Unknown owner'}
            </p>
            {owner.email && (
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-sepiaSoft">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                <a href={`mailto:${owner.email}`} className="text-sepia no-underline hover:text-bordeaux">
                  {owner.email}
                </a>
              </p>
            )}
            {owner.phone && (
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-sepiaSoft">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-sepia">{owner.phone}</span>
              </p>
            )}
            {owner.address && (
              <p className="mt-0.5 inline-flex items-start gap-1.5 text-sepiaSoft">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="text-sepia">{owner.address}</span>
              </p>
            )}
          </div>
        )}

        {!compact && state === 'LoanStarted' && (
          <p className="mt-1 text-xs italic text-sepiaSoft">
            You're currently borrowing this book — wait for the owner to mark it returned.
          </p>
        )}

        {!compact && state === 'Active' && onCancel && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {confirming ? (
              <>
                <span className="text-xs text-sepiaSoft">Cancel this reservation?</span>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={working}
                  className="btn-primary"
                >
                  {working ? 'Cancelling…' : 'Yes, cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={working}
                  className="btn-ghost"
                >
                  Keep it
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setConfirming(true);
                }}
                className="btn-ghost"
              >
                Cancel reservation
              </button>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-1 text-xs text-bordeaux">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}

export default MyReservationCard;
