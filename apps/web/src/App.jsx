import { Routes, Route } from 'react-router-dom';

// Placeholder pages — every route renders its name. Real page components
// land in later stories (1.4 → /me, 1.5 → /users/:id, epic 2 → /books/*,
// epic 4 → /reservations, epic 5 → /notifications).
function Placeholder({ title }) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-display text-4xl text-sepia">{title}</h1>
      <p className="mt-4 text-sepiaSoft">
        Placeholder route — the real page lands in a later story.
      </p>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder title="BookShare" />} />
      <Route path="/login" element={<Placeholder title="Sign in" />} />
      <Route path="/signup" element={<Placeholder title="Sign up" />} />
      <Route path="/me" element={<Placeholder title="My profile" />} />
      <Route path="/users/:id" element={<Placeholder title="User profile" />} />
      <Route path="/books" element={<Placeholder title="Browse books" />} />
      <Route path="/books/new" element={<Placeholder title="Add a book" />} />
      <Route path="/books/:id" element={<Placeholder title="Book detail" />} />
      <Route path="/reservations" element={<Placeholder title="My reservations" />} />
      <Route path="/notifications" element={<Placeholder title="Notifications" />} />
      <Route path="*" element={<Placeholder title="Not found" />} />
    </Routes>
  );
}

export default App;
