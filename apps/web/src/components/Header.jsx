import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useApolloClient } from '@apollo/client/react';
import { BookOpen, LogOut, PlusCircle, UserRound } from 'lucide-react';
import useAuth from '../auth/useAuth';

function navLinkClasses({ isActive }) {
  return [
    'group relative text-sm tracking-wide no-underline transition',
    isActive ? 'text-bordeaux' : 'text-sepiaSoft hover:text-sepiaDark',
  ].join(' ');
}

function NavLinkLabel({ children, isActive }) {
  return (
    <>
      {children}
      <span
        className={[
          'pointer-events-none absolute -bottom-1.5 left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-bordeaux transition-all duration-200',
          isActive ? 'w-full' : 'w-0 group-hover:w-3/4',
        ].join(' ')}
      />
    </>
  );
}

function Header() {
  const { token, currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const apollo = useApolloClient();
  const isAuthenticated = Boolean(token);

  async function handleLogout() {
    logout();
    await apollo.clearStore().catch(() => {});
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-paper/80 bg-ivory/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link
          to="/"
          className="group flex items-center gap-2.5 no-underline"
          aria-label="BookShare — home"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-bordeaux text-ivory shadow-shelf transition group-hover:bg-bordeauxDeep">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-2xl tracking-tight text-sepiaDark">BookShare</span>
        </Link>

        <nav className="flex items-center gap-7">
          <NavLink to="/" end className={navLinkClasses}>
            {({ isActive }) => <NavLinkLabel isActive={isActive}>Home</NavLinkLabel>}
          </NavLink>
          <NavLink to="/books" className={navLinkClasses}>
            {({ isActive }) => <NavLinkLabel isActive={isActive}>Books</NavLinkLabel>}
          </NavLink>

          {isAuthenticated ? (
            <>
              <NavLink
                to="/books/new"
                className="btn-primary !px-4 !py-1.5 !text-sm no-underline"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                Add a book
              </NavLink>
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 rounded-full border border-paperDark bg-cream py-1 pl-1 pr-3 text-sm text-sepia no-underline shadow-shelf hover:border-sepiaSoft hover:text-sepiaDark"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-paper text-sepia">
                  <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="max-w-[10rem] truncate">
                  {currentUser?.display_name || 'You'}
                </span>
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
              <Link to="/login" className="text-sm text-sepiaSoft no-underline hover:text-bordeaux">
                Log in
              </Link>
              <Link to="/signup" className="btn-primary !px-4 !py-1.5 !text-sm no-underline">
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
