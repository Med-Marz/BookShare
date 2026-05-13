# Kafka event contracts

BookShare uses four Kafka topics to propagate reservation and loan state
changes. All events share a common envelope; the per-topic `data` shape is
locked here so producers and consumers stay in sync.

## Envelope (every topic)

```json
{
  "eventId": "uuid-v4",
  "occurredAt": "2026-05-13T14:30:00.000Z",
  "actorId": "user-uuid",
  "data": {
    /* topic-specific fields, camelCase */
  }
}
```

The Kafka message `key` is the **primary entity ID** (`bookId` for `book.*` and `loan.*` topics; `reservationId` for `reservation.*` topics). Keying ensures per-entity ordering within a partition.

Encoding: `JSON.stringify(envelope)` over UTF-8 bytes — no Avro, no Protobuf.

## Topics

> Producers, consumers, and `data` shape are placeholders here — final
> contracts land alongside the loan-service (producer) and the consumers
> in epic 4 (`book.reserved`, `reservation.cancelled`, `loan.started`,
> `loan.returned`) and epic 5 (notification-service consumer).

### `book.reserved`

- **Producer:** loan-service
- **Consumers:** book-service (`book-service-availability` group, updates status to Reserved); notification-service (`notification-service-mock-mailer` group, persists mock notification + emits structured log)
- **Trigger:** a borrower clicks Reserve on an Available book
- **Key:** `bookId`
- **`data` shape (TBD epic 4):** `{ reservationId, bookId, borrowerId, ownerId }`

### `reservation.cancelled`

- **Producer:** loan-service
- **Consumers:** book-service (returns book to Available); notification-service
- **Trigger:** the borrower cancels their own active reservation before the loan starts
- **Key:** `bookId`
- **`data` shape (TBD epic 4):** `{ reservationId, bookId, borrowerId, ownerId }`

### `loan.started`

- **Producer:** loan-service
- **Consumers:** book-service (transitions status from Reserved to Lent Out); notification-service
- **Trigger:** the owner marks the physical handoff complete
- **Key:** `bookId`
- **`data` shape (TBD epic 4):** `{ reservationId, bookId, borrowerId, ownerId }`

### `loan.returned`

- **Producer:** loan-service
- **Consumers:** book-service (transitions status from Lent Out back to Available); notification-service
- **Trigger:** the owner marks the physical return complete
- **Key:** `bookId`
- **`data` shape (TBD epic 4):** `{ reservationId, bookId, borrowerId, ownerId }`

## Consumer-group hygiene

Each consumer service uses its own consumer group ID so the two consumers
on the same topic receive every message (broadcast semantics across groups,
share semantics within a group). The locked IDs:

- `book-service-availability` — book-service availability projector
- `notification-service-mock-mailer` — notification-service mock notifier

Sharing a group ID across services would silently break the multi-consumer
pattern; never reuse.
