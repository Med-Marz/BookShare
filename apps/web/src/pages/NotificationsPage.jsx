import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BookmarkPlus,
  CheckCircle2,
  Handshake,
  XCircle,
} from 'lucide-react';

import {
  listNotifications,
  markAllNotificationsRead,
} from '../api/notificationsApi';
import { relativeTime } from '../utils/relativeTime';

const TOPIC_ICON = {
  'book.reserved': BookmarkPlus,
  'reservation.cancelled': XCircle,
  'loan.started': Handshake,
  'loan.returned': CheckCircle2,
};

function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      const list = await listNotifications({ limit: 50 });
      setItems(list || []);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: fetch the list, then fire-and-forget mark-all-read; once that
  // settles, refetch so the read_at columns populate locally and the unread
  // treatment matches the persisted state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refetch();
      try {
        await markAllNotificationsRead();
      } catch {
        // ignore — the row marks aren't critical for first paint
      }
      if (!cancelled) await refetch();
    })();
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  function handleRowClick(n) {
    if (n.book_id) {
      navigate(`/books/${n.book_id}`);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-sepiaSoft">
        Loading notifications…
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
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
    <main className="mx-auto max-w-3xl px-6 py-12 animate-fade-up">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-sepiaSoft">Notifications</p>
        <h1 className="mt-1 font-display text-3xl text-sepiaDark sm:text-4xl">Recent activity</h1>
        <p className="mt-2 text-sepiaSoft">
          Updates on the books you've reserved and the books you've shared.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-paperDark bg-ivory/70 p-8 text-center">
          <Bell className="mx-auto h-8 w-8 text-sepiaSoft" aria-hidden="true" />
          <h2 className="mt-3 font-display text-xl text-sepiaDark">No notifications yet</h2>
          <p className="mt-2 text-sm text-sepiaSoft">
            Once someone reserves your book or you reserve someone else's, you'll see updates here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => {
            const Icon = TOPIC_ICON[n.topic] || Bell;
            const unread = !n.read_at;
            const clickable = Boolean(n.book_id);
            const baseClasses = [
              'card-surface flex items-start gap-4 p-4 transition',
              clickable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-shelfLg' : '',
              unread ? 'border-l-4 border-l-bordeaux bg-cream/60' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <li
                key={n.id}
                className={baseClasses}
                onClick={() => clickable && handleRowClick(n)}
                onKeyDown={(e) => {
                  if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleRowClick(n);
                  }
                }}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
              >
                <span
                  className={[
                    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    unread ? 'bg-paper text-bordeaux' : 'bg-paper/60 text-sepiaSoft',
                  ].join(' ')}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <p className={unread ? 'font-medium text-sepiaDark' : 'text-sepia'}>
                    {n.message}
                  </p>
                  <p className="mt-0.5 text-xs text-sepiaSoft">{relativeTime(n.occurred_at)}</p>
                </div>
                {unread && (
                  <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-bordeaux" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

export default NotificationsPage;
