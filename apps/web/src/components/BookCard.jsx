import { Link } from 'react-router-dom';
import { coverUrl } from '../api/covers';
import { formatYear } from '../utils/formatYear';

const STATUS_STYLES = {
  Available: 'border-forest/30 bg-forest/10 text-forest',
  Reserved: 'border-bordeaux/30 bg-bordeaux/10 text-bordeaux',
  'Lent Out': 'border-sepiaSoft/30 bg-sepiaSoft/10 text-sepiaSoft',
};

function BookCard({ book, showStatus = true, owner = null }) {
  const statusClass = STATUS_STYLES[book.status] || STATUS_STYLES.Available;
  return (
    <Link to={`/books/${book.id}`} className="block no-underline">
      <article className="card-surface flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-shelfLg">
        <div className="aspect-[2/3] w-full overflow-hidden bg-paper">
          <img
            src={coverUrl(book.cover_object_key)}
            alt={`${book.title} by ${book.author}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <h3 className="line-clamp-2 font-display text-lg leading-tight text-sepiaDark">
            {book.title}
          </h3>
          <p className="text-sm text-sepiaSoft">
            {book.author} · {formatYear(book.year_published)}
          </p>
          {owner && (
            <p className="text-xs text-sepiaSoft">
              Shared by <span className="text-sepia">{owner.display_name}</span>
            </p>
          )}
          {showStatus && (
            <span
              className={`mt-2 inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}
            >
              {book.status}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}

export default BookCard;
