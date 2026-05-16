import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenCheck, Compass, History } from 'lucide-react';

import {
  cancelReservation,
  listMyReservations,
} from '../api/reservationsApi';
import MyReservationCard from '../components/MyReservationCard.jsx';

function MyReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const list = await listMyReservations();
      setReservations(list || []);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load your reservations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleCancel = useCallback(
    async (reservation) => {
      await cancelReservation(reservation.id);
      await fetchAll();
    },
    [fetchAll],
  );

  const active = reservations.filter(
    (r) => r.state === 'Active' || r.state === 'LoanStarted',
  );
  const history = reservations.filter(
    (r) => r.state === 'Cancelled' || r.state === 'Completed',
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-sepiaSoft">
        Loading your reservations…
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <p
          role="alert"
          className="rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-sm text-bordeaux"
        >
          {error}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 animate-fade-up">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-sepiaSoft">Your reservations</p>
        <h1 className="mt-1 font-display text-3xl text-sepiaDark sm:text-4xl">
          Books you've reserved
        </h1>
        <p className="mt-2 text-sepiaSoft">
          Reach out to each owner to arrange the handover. Active reservations show their contact
          details below.
        </p>
      </header>

      <section className="mt-6">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-5 w-5 text-bordeaux" aria-hidden="true" />
          <h2 className="font-display text-2xl text-sepiaDark">Active reservations</h2>
        </div>
        {active.length > 0 ? (
          <div className="mt-4 space-y-4">
            {active.map((r) => (
              <MyReservationCard
                key={r.id}
                reservation={r}
                variant="full"
                onCancel={handleCancel}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No active reservations"
            copy="When you reserve a book, it'll show up here so you can arrange the handover."
            cta={{ to: '/books', label: 'Browse the catalog' }}
          />
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-sepiaSoft" aria-hidden="true" />
          <h2 className="font-display text-2xl text-sepiaDark">History</h2>
        </div>
        {history.length > 0 ? (
          <div className="mt-4 space-y-4">
            {history.map((r) => (
              <MyReservationCard key={r.id} reservation={r} variant="full" />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No reservation history yet"
            copy="Once you cancel or complete a reservation, it'll be archived here."
          />
        )}
      </section>
    </main>
  );
}

function EmptyState({ title, copy, cta }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-paperDark bg-ivory/70 p-6">
      <h3 className="font-display text-lg text-sepiaDark">{title}</h3>
      <p className="mt-2 text-sm text-sepiaSoft">{copy}</p>
      {cta && (
        <Link to={cta.to} className="btn-ghost mt-3 no-underline">
          <Compass className="h-4 w-4" aria-hidden="true" />
          {cta.label}
        </Link>
      )}
    </div>
  );
}

export default MyReservationsPage;
