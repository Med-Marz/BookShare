# REST endpoints

The API Gateway exposes a REST surface at `http://localhost:4000/api/v1`.
All routes return JSON with `Content-Type: application/json` unless noted
(covers are binary). Auth requirements follow this vocabulary:

| Label | Meaning |
| --- | --- |
| **public** | No `Authorization` header required. |
| **optionalAuth** | Works without a JWT; if a valid JWT is present, the response is enriched with contact fields or viewer-specific data (anonymous viewers see contact fields nulled out). |
| **requireAuth** | A valid `Authorization: Bearer <JWT>` header is mandatory; missing/expired → `401`. |

The standard error envelope is:

```json
{ "error": { "code": "UPPER_SNAKE_CODE", "message": "Human readable detail" } }
```

The gRPC → HTTP status mapping is at the end of this file.

---

## Auth — `/api/v1/auth`

### `POST /auth/signup` — public

Create an account.

**Body** (`application/json`):
```json
{
  "email": "alice@example.com",
  "password": "Password123!",
  "display_name": "Alice",
  "phone": "+216 22 000 000",
  "address": "12 rue du Livre, Tunis"
}
```

**Success — `201 Created`**: `{ token, user: { id, email, display_name } }`.

**Errors:**
- `400 VALIDATION_ERROR` — missing/invalid field (password too short, malformed email, etc.).
- `409 CONFLICT` — email already registered.

### `POST /auth/login` — public

Exchange credentials for a JWT.

**Body**: `{ "email": "...", "password": "..." }`.

**Success — `200 OK`**: `{ token, user: { id, email, display_name } }`.

**Errors:**
- `401 AUTHENTICATION_REQUIRED` — wrong email or password.

---

## Profile — `/api/v1/profile`

### `GET /profile` — requireAuth

Return the authenticated user's full profile, including contact details.

**Success — `200 OK`**: `{ id, email, display_name, phone, address, created_at }`.

### `PUT /profile` — requireAuth

Update one or more of `display_name`, `phone`, `address`. Email cannot be
changed.

**Body**: subset of the three fields (`.strict()` rejects unknown keys).

**Success — `200 OK`**: the updated user object.

**Errors:**
- `400 VALIDATION_ERROR` — empty body, unknown field, or field below minimum length.

---

## Users — `/api/v1/users`

### `GET /users/:id` — optionalAuth

Return a user's public profile. Contact fields (`email`, `phone`, `address`)
are **null** unless the caller presents a valid JWT — the gateway only
exposes contact info to authenticated viewers.

**Success — `200 OK`**: user object with contact fields populated or null.

**Errors:**
- `404 NOT_FOUND` — unknown user id.

### `GET /users/:id/books` — public

List every book owned by a user.

**Success — `200 OK`**: `{ books: [...] }`. Empty array is a normal response.

---

## Books — `/api/v1/books`, `/api/v1/home`, `/api/v1/search`

### `GET /home/recent-books?limit=12` — public

The newest books across the whole catalog (used by the Home carousel).

**Query**: `limit` (default 12, max 24).

**Success — `200 OK`**: `{ books: [ { id, title, author, year_published, cover_object_key, status, owner: { id, display_name } } ] }`.

### `GET /books?limit=24&cursor=<opaque>` — public

Cursor-paginated catalog listing.

**Success — `200 OK`**: `{ books: [...], next_cursor: "<opaque|empty>" }`.

### `GET /search?q=<query>` — public

Token-AND case-insensitive search over title + author + owner display name.

**Query**: `q` (required, 1-128 chars).

**Success — `200 OK`**: `{ books: [ { ..., matched_by: ["title_author"|"owner"] } ] }`.

**Errors:**
- `400 VALIDATION_ERROR` — `q` missing or empty.

### `GET /books/:id` — optionalAuth

Book detail. Owner contact fields gated like `GET /users/:id`. When the
caller is authenticated, the response also carries `my_active_reservation`
(non-null when the caller currently holds an active reservation on this book).

**Success — `200 OK`**: `{ ..., owner: { id, display_name, email?, phone?, address? }, my_active_reservation?: { id, state, ... } | null }`.

**Errors:**
- `404 NOT_FOUND` — unknown book id.

### `POST /books` — requireAuth

Add a book. Multipart, cover mandatory (the gateway enforces this at upload
time as well as the service-side validation — defense in depth).

**Body** (`multipart/form-data`):
- `title`, `author`, `year_published` (text fields).
- `cover` (file, ≤ 10 MB, `image/jpeg | image/png | image/webp`).

**Success — `201 Created`**: `{ book }`.

**Errors:**
- `400 VALIDATION_ERROR` — missing field, cover missing, oversized cover, disallowed content type.

### `PUT /books/:id` — requireAuth (owner only)

Edit `title`, `author`, `year_published` (any subset).

**Body**: JSON, partial.

**Success — `200 OK`**: `{ book }`.

**Errors:**
- `400 VALIDATION_ERROR`, `403 FORBIDDEN` (non-owner), `404 NOT_FOUND`.

### `PUT /books/:id/cover` — requireAuth (owner only)

Replace the cover image. Multipart, single `cover` file (same size/type
rules as `POST /books`).

**Success — `200 OK`**: `{ book }`.

**Errors:**
- `400`, `403`, `404`.

### `DELETE /books/:id` — requireAuth (owner only)

Delete a book and its cover (best-effort MinIO delete). Refuses to delete a
book that's currently `Reserved` or `Lent Out`.

**Success — `204 No Content`**.

**Errors:**
- `403 FORBIDDEN`, `404 NOT_FOUND`, `409 FAILED_PRECONDITION` (book not Available).

### `POST /books/:id/reservations` — requireAuth

Reserve a book. The caller becomes the borrower; the book's owner is the
counterparty.

**Body**: empty.

**Success — `201 Created`**: `{ reservation: { id, book_id, owner_id, borrower_id, state: "Active", created_at } }`.

**Errors:**
- `400 VALIDATION_ERROR` — self-reserve (you can't reserve your own book).
- `404 NOT_FOUND` — unknown book.
- `409 FAILED_PRECONDITION` — book is not `Available`.

---

## Covers — `/api/v1/covers`

### `GET /covers/:object_key` — public

Stream a cover image straight from the MinIO bucket through the gateway.

**Success — `200 OK`** with `Content-Type: image/jpeg | image/png | image/webp` and `Cache-Control: public, max-age=86400`.

**Errors:**
- `404 NOT_FOUND` — unknown object key.

---

## Reservations — `/api/v1/reservations`

Three lifecycle actions on existing reservations.

### `DELETE /reservations/:id` — requireAuth (borrower only)

Cancel an `Active` reservation.

**Success — `200 OK`**: `{ reservation }` (state now `Cancelled`).

**Errors:**
- `403 FORBIDDEN` — non-borrower.
- `404 NOT_FOUND` — unknown reservation.
- `409 FAILED_PRECONDITION` — reservation no longer `Active` (already cancelled, completed, or loan started).

### `POST /reservations/:id/start-loan` — requireAuth (owner only)

Mark the physical handoff complete. Reservation moves `Active` → `LoanStarted`.

**Success — `200 OK`**: `{ reservation }`.

**Errors:**
- `403 FORBIDDEN`, `404 NOT_FOUND`, `409 FAILED_PRECONDITION`.

### `POST /reservations/:id/mark-returned` — requireAuth (owner only)

Mark the book returned. Reservation moves `LoanStarted` → `Completed`.

**Success — `200 OK`**: `{ reservation }`.

**Errors:**
- `403`, `404`, `409`.

---

## Me — `/api/v1/me` (borrower- and owner-side views of reservation activity)

### `GET /me/reservations` — requireAuth

Every reservation the caller has placed (borrower side). Each entry is
enriched with `book` (full book object) and `owner` (full user object with
contact fields, since the caller is the borrower coordinating the handoff).

**Success — `200 OK`**: `{ reservations: [ { id, state, ..., book, owner } ] }`.

### `GET /me/owned-reservations` — requireAuth

Every reservation placed on books the caller owns (owner side). Each entry
is enriched with `book` and `borrower` (contact fields included — the owner
needs them).

**Success — `200 OK`**: `{ reservations: [ { id, state, ..., book, borrower } ] }`.

### `GET /me/activity` — requireAuth

Two counts in one round-trip for the Home dashboard.

**Success — `200 OK`**: `{ activeReservationCount, listedBookCount }`.

---

## Notifications — `/api/v1/notifications`

Backed by the second Kafka consumer group (`notification-service.notifier`).
The recipient id is always taken from the JWT — clients can never read
someone else's notifications.

### `GET /notifications?limit=20&since=<iso>` — requireAuth

Recent notifications for the caller, newest first.

**Success — `200 OK`**: `{ notifications: [ { id, topic, actor_id, book_id, reservation_id, message, occurred_at, read_at? } ] }`.

### `GET /notifications/unread-count` — requireAuth

Count of unread rows (used by the navbar badge).

**Success — `200 OK`**: `{ count }`.

### `POST /notifications/:id/read` — requireAuth (recipient only)

Mark one notification read.

**Success — `200 OK`**: `{ notification }` (with `read_at` populated).

**Errors:**
- `403 FORBIDDEN` — not the recipient.
- `404 NOT_FOUND` — unknown id.

### `POST /notifications/mark-all-read` — requireAuth

Bulk-mark every unread notification the caller has as read.

**Success — `200 OK`**: `{ updated_count }`.

---

## gRPC → HTTP status mapping

Centralised in `apps/gateway/src/errors.js`. Every microservice gRPC error
flows through this table on its way to a REST response.

| gRPC status | HTTP | `error.code` |
| --- | --- | --- |
| `OK` | 200 | — |
| `INVALID_ARGUMENT` | 400 | `VALIDATION_ERROR` |
| `UNAUTHENTICATED` | 401 | `AUTHENTICATION_REQUIRED` |
| `PERMISSION_DENIED` | 403 | `FORBIDDEN` |
| `NOT_FOUND` | 404 | `NOT_FOUND` |
| `ALREADY_EXISTS` | 409 | `CONFLICT` |
| `FAILED_PRECONDITION` | 409 | `FAILED_PRECONDITION` |
| `RESOURCE_EXHAUSTED` | 429 | `RATE_LIMITED` |
| `UNAVAILABLE` | 503 | `SERVICE_UNAVAILABLE` |
| `INTERNAL` / any other | 500 | `INTERNAL_ERROR` |

The same envelope shape `{ error: { code, message } }` is emitted in every
error case, so clients only ever need to handle one error shape.

---

## Rate limiting

The gateway enforces **300 requests per 15-minute window per client IP**
across every `/api/v1/*` route. `/health` is mounted before the limiter and
does **not** consume budget (so Docker's per-container healthcheck doesn't
eat into the user budget). Over-limit responses are `429 RATE_LIMITED`.

## CORS

The gateway accepts an explicit allowlist of origins, configured by
`WEB_ORIGIN` in `.env`. The dev default permits both `http://localhost:5173`
(Vite dev server with HMR) and `http://localhost:8080` (the Docker nginx
build).
