# GraphQL schema

The API Gateway exposes a single GraphQL endpoint at
`http://localhost:4000/graphql`. Apollo Sandbox opens automatically when the
URL is visited in a browser, with full schema introspection.

GraphQL is the right tool here for **cross-service joins** — a single query
can pull `book`, the book's `owner` (from user-service), and the viewer's
`my_active_reservation` (from loan-service) in one round-trip. REST would
need three calls.

---

## Full schema

```graphql
type User {
  id: ID!
  email: String          # null for anonymous viewers (contact-info gated)
  display_name: String!
  phone: String          # null for anonymous viewers
  address: String        # null for anonymous viewers
  created_at: String
  books: [Book!]!        # fan-out to book-service ListBooksByOwner
}

type AuthPayload {
  token: String!
  user: User!
}

input SignupInput {
  email: String!
  password: String!
  display_name: String!
  phone: String!
  address: String!
}

input UpdateProfileInput {
  display_name: String
  phone: String
  address: String
}

type Query {
  _empty: String           # heartbeat field
  profile: User!           # requires JWT
  user(id: ID!): User!     # public, contact gated for anonymous viewers
  book(id: ID!): Book!
  recentBooks(limit: Int = 12): [Book!]!
  books(limit: Int = 24, cursor: String = ""): BookPage!
  search(q: String!): SearchResult!
  myReservations: [Reservation!]!           # requires JWT
  ownedReservations: [Reservation!]!        # requires JWT
  me: Me!                                   # requires JWT
  notifications(limit: Int = 20, since: String): [Notification!]!  # requires JWT
  unreadNotificationCount: Int!             # requires JWT
}

type Mutation {
  signup(input: SignupInput!): AuthPayload!
  login(email: String!, password: String!): AuthPayload!
  updateProfile(input: UpdateProfileInput!): User!         # requires JWT
  addBook(input: AddBookInput!): Book!                     # requires JWT
  editBook(id: ID!, input: EditBookInput!): Book!          # owner only
  deleteBook(id: ID!): Boolean!                            # owner only
  reserveBook(book_id: ID!): Reservation!                  # requires JWT
  cancelReservation(id: ID!): Reservation!                 # borrower only
  startLoan(id: ID!): Reservation!                         # owner only
  markReturned(id: ID!): Reservation!                      # owner only
  markNotificationRead(id: ID!): Notification!             # recipient only
  markAllNotificationsRead: Int!                           # requires JWT
}

type Book {
  id: ID!
  owner_id: ID!
  owner: User!                       # fan-out to user-service
  title: String!
  author: String!
  year_published: Int!
  cover_object_key: String!
  status: String!
  created_at: String!
  updated_at: String!
  my_active_reservation: Reservation # fan-out to loan-service when authenticated
}

type BookPage {
  edges: [Book!]!
  next_cursor: String!
}

type SearchResult {
  books: [SearchBook!]!
}

type SearchBook {
  id: ID!
  owner_id: ID!
  owner: User!
  title: String!
  author: String!
  year_published: Int!
  cover_object_key: String!
  status: String!
  matched_by: [String!]!   # ["title_author"|"owner"]
}

type Reservation {
  id: ID!
  book_id: ID!
  owner_id: ID!
  borrower_id: ID!
  state: String!           # Active | Cancelled | LoanStarted | Completed
  created_at: String!
  loan_started_at: String
  returned_at: String
  cancelled_at: String
  book: Book               # field resolver, fans out to book-service
  owner: User              # visible only to the borrower
  borrower: User           # visible only to the owner
}

type Notification {
  id: ID!
  topic: String!           # book.reserved | reservation.cancelled | loan.started | loan.returned
  actor_id: ID!
  book_id: ID!
  reservation_id: ID!
  message: String!
  occurred_at: String!
  created_at: String!
  read_at: String          # null until marked read
}

type Me {
  activity: Activity!
}

type Activity {
  active_reservation_count: Int!
  listed_book_count: Int!
}
```

The on-disk source of truth is `apps/gateway/src/schema.gql` — diff this
file against that one whenever you suspect drift.

---

## Cross-service fan-out

GraphQL field resolvers let one HTTP request span multiple microservices.
For each field that's "owned" by a different service, the gateway issues a
gRPC call only when the client actually asks for the field.

| Field | Resolves via |
| --- | --- |
| `Book.owner` | `user-service / GetUser` |
| `Book.my_active_reservation` | `loan-service / GetMyActiveReservationOnBook` (only if caller has a JWT) |
| `User.books` | `book-service / ListBooksByOwner` |
| `Reservation.book` | `book-service / GetBook` |
| `Reservation.owner` | `user-service / GetUser` — **null unless caller is the borrower** |
| `Reservation.borrower` | `user-service / GetUser` — **null unless caller is the owner** |
| `Me.activity` | `loan-service / CountMyActiveReservations` **and** `book-service / ListBooksByOwner` in parallel |
| `SearchBook.owner` | `user-service / GetUser` |

### Field-selection advantage

GraphQL's main pay-off over REST is "ask for what you need." If a client
queries `book(id) { id title status }` only, the gateway calls **only**
book-service — user-service and loan-service stay idle. If the client adds
`owner { display_name }`, the gateway fans out to user-service too.

This is observable live: open two Apollo Sandbox tabs, run a stripped-down
query in one and the full demo query in the other, then watch
`docker compose logs --since 30s loan-service` — the trimmed query produces
**zero** loan-service log lines.

---

## Authentication

JWTs are sent in an HTTP `Authorization: Bearer <token>` header. The gateway
extracts the `sub` claim and stores it as `ctx.userId` for resolvers. Each
resolver decides what to do when `ctx.userId` is absent:

- Reads that work anonymously (`user(id)`, `book(id)`, `recentBooks`, `search`) — gated fields return `null` for anonymous viewers.
- Reads that require auth (`profile`, `myReservations`, `notifications`, …) — throw `AUTHENTICATION_REQUIRED`.
- Mutations — all require auth; ownership/role enforcement happens at the microservice layer.

Errors are returned as standard `GraphQLError` objects with
`extensions.code` mirroring the REST envelope (`VALIDATION_ERROR`,
`FORBIDDEN`, `NOT_FOUND`, `FAILED_PRECONDITION`, etc.) plus
`extensions.http.status` for clients that respect it (Apollo Client does).

---

## Three example queries

### 1. Flagship cross-service join

Show a book's detail + the owner's contact + whether the viewer holds an
active reservation, all in one round-trip:

```graphql
query DemoBookDetail($id: ID!) {
  book(id: $id) {
    id
    title
    author
    year_published
    status
    cover_object_key
    owner {
      id
      display_name
      email
      phone
      address
    }
    my_active_reservation {
      id
      state
      created_at
    }
  }
}
```

Variables: `{ "id": "<book id from /home/recent-books>" }`.
Headers: `Authorization: Bearer <JWT>`.

The gateway:
1. Calls `book-service / GetBook(id)`.
2. With the returned `owner_id`, fans out in parallel to
   `user-service / GetUser` and (if `ctx.userId` is set)
   `loan-service / GetMyActiveReservationOnBook`.
3. Stitches the response.

### 2. Search with matched-by chips

```graphql
query DemoSearch {
  search(q: "Nietzsche") {
    books {
      id
      title
      author
      matched_by
      owner { display_name }
    }
  }
}
```

`matched_by` is the array of reasons the row was included — `["title_author"]`,
`["owner"]`, or `["title_author", "owner"]`. The React `SearchPage` renders
these as small chips above each result.

### 3. My reservations with owner contact (auth required)

```graphql
query DemoMyReservations {
  myReservations {
    id
    state
    created_at
    book {
      title
      author
    }
    owner {
      display_name
      email
      phone
    }
  }
}
```

`Reservation.owner` is non-null here because `ctx.userId === reservation.borrower_id`
(the caller is the borrower of their own listed reservations).

---

## Anonymous-viewer gating

Running the flagship query **without** an `Authorization` header:
- `book.title` / `author` / `status` / `cover_object_key`: populated.
- `book.owner.display_name`: populated.
- `book.owner.email` / `phone` / `address`: **null** (contact-info gated).
- `book.my_active_reservation`: **null** (no caller identity → no possible reservation).

This is enforced in the resolvers, not the microservices — book-service
and user-service still return full data over gRPC. The gateway is the one
trusted boundary that decides what an anonymous browser sees.
