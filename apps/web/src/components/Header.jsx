import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useApolloClient } from '@apollo/client/react';
import { BookOpen, LogOut, PlusCircle, UserRound } from 'lucide-react';
import useAuth from '../auth/useAuth';

function Header() {
  const { token, currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const apollo = useApolloClient();
  const isAuthenticated = Boolean(token);

  async function handleLogout() {
    logout();
    // Drop any cached query results from the authenticated session.
    await apollo.clearStore().catch(() => {});
    navigate('/');
  }

  return (
    <header className="border-b border-paper bg-ivory shadow-shelf">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <BookOpen className="h-6 w-6 text-bordeaux" aria-hidden="true" />
          <span className="font-display text-2xl text-sepia">BookShare</span>
        </Link>

        <nav className="flex items-center gap-6 text-sepiaSoft">
          <NavLink
            to="/books"
            className={({ isActive }) =>
              `text-sm tracking-wide no-underline hover:text-bordeaux ${
                isActive ? 'text-bordeaux' : ''
              }`
            }
          >
            Browse
          </NavLink>

          {isAuthenticated ? (
            <>
              <NavLink
                to="/books/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-bordeaux px-3 py-1.5 text-sm text-ivory no-underline hover:bg-sepia"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                Add a book
              </NavLink>
              <Link
                to="/profile"
                className="inline-flex items-center gap-1.5 text-sm no-underline hover:text-bordeaux"
              >
                <UserRound className="h-4 w-4" aria-hidden="true" />
                {currentUser?.display_name || 'You'}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-sm text-sepiaSoft hover:text-bordeaux"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm no-underline hover:text-bordeaux">
                Log in
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-bordeaux px-4 py-1.5 text-sm text-ivory no-underline hover:bg-sepia"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
