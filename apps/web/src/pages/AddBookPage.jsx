import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookmarkPlus, ImagePlus, UploadCloud } from 'lucide-react';
import { addBook } from '../api/booksApi';

const INITIAL = { title: '', author: '', year_published: '' };
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function AddBookPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [cover, setCover] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Local object URL for the cover preview. Revoked on file change + unmount
  // so the browser releases the memory.
  const previewUrl = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  }

  function handleCoverChange(e) {
    const file = e.target.files?.[0];
    if (error) setError(null);
    if (!file) {
      setCover(null);
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      setError('Cover must be a JPEG, PNG, or WEBP image.');
      setCover(null);
      e.target.value = '';
      return;
    }
    setCover(file);
  }

  const canSubmit =
    Boolean(form.title.trim()) &&
    Boolean(form.author.trim()) &&
    Boolean(form.year_published) &&
    Boolean(cover) &&
    !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const book = await addBook({
        title: form.title.trim(),
        author: form.author.trim(),
        year_published: Number.parseInt(form.year_published, 10),
        cover,
      });
      navigate(`/books/${book.id}`, { replace: true });
    } catch (err) {
      const message =
        err?.response?.data?.error?.message || 'Could not add this book. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 animate-fade-up">
      <header className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-bordeaux text-ivory shadow-shelf">
          <BookmarkPlus className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-sepiaSoft">List a book</p>
          <h1 className="font-display text-3xl text-sepiaDark sm:text-4xl">Add a new book</h1>
        </div>
      </header>

      <p className="mt-4 text-sepiaSoft">
        Share a book from your shelf. Other readers will be able to discover and reserve it.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
        {/* ---- Cover picker + preview ---- */}
        <section className="card-surface p-6">
          <h2 className="font-display text-xl text-sepiaDark">Cover image</h2>
          <p className="mt-1 text-sm text-sepiaSoft">
            JPEG, PNG, or WEBP — up to 10MB. A clear photo of the cover works best.
          </p>

          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-48 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-paperDark bg-ivory">
              {previewUrl ? (
                <img src={previewUrl} alt="Cover preview" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-8 w-8 text-sepiaSoft" aria-hidden="true" />
              )}
            </div>

            <div className="flex-1">
              <label
                htmlFor="cover"
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-paperDark bg-cream px-4 py-2 text-sm font-semibold text-sepia shadow-shelf hover:border-sepiaSoft hover:text-sepiaDark"
              >
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                {cover ? 'Choose a different cover' : 'Choose a cover'}
              </label>
              <input
                id="cover"
                name="cover"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleCoverChange}
                className="sr-only"
              />
              {cover && (
                <p className="mt-3 text-xs text-sepiaSoft">
                  Selected: <span className="font-medium text-sepiaDark">{cover.name}</span>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ---- Textual fields ---- */}
        <section className="card-surface p-6">
          <h2 className="font-display text-xl text-sepiaDark">Book details</h2>

          <div className="mt-5 space-y-5">
            <Field
              label="Title"
              name="title"
              value={form.title}
              onChange={handleChange}
              autoComplete="off"
              required
            />
            <Field
              label="Author"
              name="author"
              value={form.author}
              onChange={handleChange}
              autoComplete="off"
              required
            />
            <Field
              label="Year published"
              name="year_published"
              type="number"
              min="-3000"
              max="9999"
              value={form.year_published}
              onChange={handleChange}
              help="Use a negative number for BCE — e.g. -500 for 500 BCE (The Art of War)."
              required
            />
          </div>
        </section>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-sm text-bordeaux"
          >
            {error}
          </p>
        )}

        <button type="submit" disabled={!canSubmit} className="btn-primary w-full sm:w-auto">
          {submitting ? 'Adding…' : 'Add this book'}
        </button>
      </form>
    </main>
  );
}

function Field({ label, name, type = 'text', help, ...inputProps }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-sepia">{label}</span>
      <input name={name} type={type} className="input-field" {...inputProps} />
      {help && <span className="mt-1 block text-xs text-sepiaSoft">{help}</span>}
    </label>
  );
}

export default AddBookPage;
