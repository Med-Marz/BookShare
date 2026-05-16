import { Routes, Route } from 'react-router-dom';
import { BookOpenText, Compass } from 'lucide-react';

import Header from './components/Header.jsx';
import RequireAuth from './auth/RequireAuth.jsx';
import HomePage from './pages/HomePage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MyProfilePage from './pages/MyProfilePage.jsx';
import UserProfilePage from './pages/UserProfilePage.jsx';
import AddBookPage from './pages/AddBookPage.jsx';
import BookDetailPage from './pages/BookDetailPage.jsx';
import BrowsePage from './pages/BrowsePage.jsx';
import SearchPage from './pages/SearchPage.jsx';

function Placeholder({ title, copy }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <div className="card-surface flex flex-col items-center gap-5 p-12 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-paper bg-ivory">
          <BookOpenText className="h-7 w-7 text-bordeaux" aria-hidden="true" />
        </span>
        <h1 className="font-display text-4xl text-sepiaDark">{title}</h1>
        <p className="max-w-md text-sepiaSoft">
          {copy || 'This page is coming soon — the surrounding features are still being built.'}
        </p>
        <a
          href="/"
          className="btn-ghost no-underline"
          aria-label="Back to the BookShare home page"
        >
          <Compass className="h-4 w-4" aria-hidden="true" />
          Back to home
        </a>
      </div>
    </main>
  );
}

function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <MyProfilePage />
            </RequireAuth>
          }
        />
        <Route path="/users/:id" element={<UserProfilePage />} />
        <Route path="/books" element={<BrowsePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route
          path="/books/new"
          element={
            <RequireAuth>
              <AddBookPage />
            </RequireAuth>
          }
        />
        <Route path="/books/:id" element={<BookDetailPage />} />
        <Route
          path="/reservations"
          element={
            <Placeholder
              title="My reservations"
              copy="Your active reservations and lending history will live here once loans go live."
            />
          }
        />
        <Route
          path="/notifications"
          element={
            <Placeholder
              title="Notifications"
              copy="Reservation activity and lending updates will appear here when the notifications stream is connected."
            />
          }
        />
        <Route
          path="*"
          element={
            <Placeholder
              title="Page not found"
              copy="That link doesn't lead anywhere on BookShare. Head back to the home page and try again."
            />
          }
        />
      </Routes>
    </>
  );
}

export default App;
