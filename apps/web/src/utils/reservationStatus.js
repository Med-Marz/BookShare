// Tailwind classes for each reservation-state badge. Kept in one place so
// both the borrower-side `MyReservationCard` and the owner-side panel render
// the same visual vocabulary.
export const STATE_STYLES = {
  Active: 'border-gold/40 bg-gold/15 text-bordeauxDeep',
  LoanStarted: 'border-bordeaux/30 bg-bordeaux/10 text-bordeaux',
  Cancelled: 'border-sepiaSoft/30 bg-sepiaSoft/10 text-sepiaSoft',
  Completed: 'border-forest/30 bg-forest/10 text-forest',
};

export const STATE_LABELS = {
  Active: 'Reserved',
  LoanStarted: 'On loan',
  Cancelled: 'Cancelled',
  Completed: 'Returned',
};

export function badgeClassFor(state) {
  return STATE_STYLES[state] || STATE_STYLES.Active;
}

export function labelFor(state) {
  return STATE_LABELS[state] || state;
}

// "Reserved on May 14" / "Returned on May 16" — uses the right verb per state.
export function formatStateTimestamp(reservation) {
  const { state, created_at, loan_started_at, returned_at, cancelled_at } = reservation;
  let label;
  let iso;
  switch (state) {
    case 'LoanStarted':
      label = 'Loan started';
      iso = loan_started_at;
      break;
    case 'Cancelled':
      label = 'Cancelled';
      iso = cancelled_at;
      break;
    case 'Completed':
      label = 'Returned';
      iso = returned_at;
      break;
    default:
      label = 'Reserved';
      iso = created_at;
  }
  if (!iso) return label;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return label;
    return `${label} on ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  } catch {
    return label;
  }
}
