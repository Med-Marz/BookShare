# Kafka event contracts

BookShare uses four Kafka topics to propagate reservation and loan state
changes. All events share a common envelope; the per-topic `data` shape is
locked here so producers and consumers stay in sync.

## Envelope (every topic)

```json
{
  "eventId": "uuid-v4",
  "occurredAt": "2026-05-17T14:30:00.000Z",
  "actorId": "user-uuid",
  "data": {
    /* topic-specific fields, snake_case */
  }
}
```

The Kafka message **key** is the **book id** for every topic — keying by the
primary entity ensures per-book ordering within a partition (reservations on
the same book never get reordered across reserve → cancel → start → return).

Encoding: `JSON.stringify(envelope)` over UTF-8 bytes — no Avro, no Protobuf.

## Topics

### `book.reserved`

- **Producer:** loan-service
- **Consumers:**
  - book-service (`book-service.book-status` group → updates the book's
    `status` from `Available` to `Reserved` in RxDB).
  - notification-service (`notification-service.notifier` group → persists a
    notification row for the **owner** with message
    `"<borrower name> reserved your book \"<title>\""`).
- **Trigger:** a borrower clicks **Reserve** on an `Available` book.
- **Key:** `book_id`.
- **`data` shape:**

  ```json
  {
    "reservation_id": "uuid",
    "book_id": "uuid",
    "borrower_id": "uuid",
    "owner_id": "uuid"
  }
  ```

### `reservation.cancelled`

- **Producer:** loan-service
- **Consumers:**
  - book-service (`book-service.book-status` → flips `Reserved` back to
    `Available`).
  - notification-service (`notification-service.notifier` → writes a
    notification for the **owner** with message
    `"<borrower name> cancelled their reservation on your book \"<title>\""`).
- **Trigger:** the borrower cancels their own `Active` reservation before
  the loan starts.
- **Key:** `book_id`.
- **`data` shape:** same as `book.reserved`.

### `loan.started`

- **Producer:** loan-service
- **Consumers:**
  - book-service (`book-service.book-status` → transitions `Reserved` to
    `Lent Out`).
  - notification-service (`notification-service.notifier` → writes a
    notification for the **borrower** with message
    `"Your loan of \"<title>\" has been started by <owner name>"`).
- **Trigger:** the owner marks the physical handoff complete via
  `POST /api/v1/reservations/:id/start-loan`.
- **Key:** `book_id`.
- **`data` shape:** same as `book.reserved`.

### `loan.returned`

- **Producer:** loan-service
- **Consumers:**
  - book-service (`book-service.book-status` → returns `Lent Out` to
    `Available`).
  - notification-service (`notification-service.notifier` → writes a
    notification for the **borrower** with message
    `"Your return of \"<title>\" has been confirmed by <owner name>"`).
- **Trigger:** the owner marks the physical return via
  `POST /api/v1/reservations/:id/mark-returned`.
- **Key:** `book_id`.
- **`data` shape:** same as `book.reserved`.

## Consumer-group hygiene

The same four topics are consumed by **two different services with two
different consumer-group IDs**, so each service receives every message in
parallel (broadcast across groups, share within a group). The locked IDs:

- `book-service.book-status` — book-service availability projector.
- `notification-service.notifier` — notification-service mock-notifier.

Sharing a group ID across services would silently break the multi-consumer
pattern; never reuse.

## Idempotency

- **book-service** keeps an in-memory `Set<eventId>` of processed messages.
  Duplicates from kafkajs's at-least-once delivery are skipped. The set is
  not persisted — on restart the consumer picks up after the last committed
  offset and any rare overlap is also caught by a defensive
  `current.status !== expected.from` check that warns-and-skips on stale
  events.
- **notification-service** persists every notification to SQLite with a
  `UNIQUE(event_id)` constraint. Duplicates raise `SQLITE_CONSTRAINT`; the
  handler catches it, logs `event: 'notification.duplicate'`, and continues.
  The DB-level constraint survives restarts (unlike book-service's
  in-memory set), which fits the different nature of the side effect:
  notifications are user-visible records, not recomputable projections.
