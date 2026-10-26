import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

const currentYear = new Date().getFullYear();
const statusOptions = [
  { value: 'TO_READ', label: 'Want to read', hint: 'Save it for later' },
  { value: 'IN_PROGRESS', label: 'Reading now', hint: 'Start tracking progress' },
  { value: 'COMPLETED', label: 'Completed', hint: 'Already finished' },
  { value: 'ON_HOLD', label: 'On hold', hint: 'Paused for now' },
  { value: 'DNF', label: 'Did not finish', hint: 'Stopped reading' }
];

const inputClass = 'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#1a535c] focus:ring-4 focus:ring-[#1a535c]/10 disabled:bg-gray-100';

function AddBook() {
  const navigate = useNavigate();
  const errorRef = useRef(null);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    genre: [],
    pages: '',
    status: 'TO_READ',
    format: 'PHYSICAL',
    priority: 'MEDIUM',
    isbn: '',
    publisher: '',
    publishedYear: '',
    language: 'English',
    description: '',
    coverImage: ''
  });
  const [genreInput, setGenreInput] = useState('');
  const [coverFailed, setCoverFailed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCoverFailed(false);
  }, [formData.coverImage]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const statusLabel = useMemo(
    () => statusOptions.find((option) => option.value === formData.status)?.label,
    [formData.status]
  );

  const updateField = (name, value) => {
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const mergeGenres = (rawValue, currentGenres = formData.genre) => {
    const candidates = rawValue
      .split(',')
      .map((genre) => genre.trim())
      .filter(Boolean);
    const genres = [...currentGenres];

    for (const candidate of candidates) {
      if (genres.length >= 20) break;
      if (!genres.some((genre) => genre.toLowerCase() === candidate.toLowerCase())) {
        genres.push(candidate.slice(0, 60));
      }
    }
    return genres;
  };

  const commitGenres = () => {
    if (!genreInput.trim()) return;
    updateField('genre', mergeGenres(genreInput));
    setGenreInput('');
  };

  const handleGenreKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitGenres();
    }
    if (event.key === 'Backspace' && !genreInput && formData.genre.length) {
      updateField('genre', formData.genre.slice(0, -1));
    }
  };

  const removeGenre = (genreToRemove) => {
    updateField('genre', formData.genre.filter((genre) => genre !== genreToRemove));
  };

  const validate = (data) => {
    if (!data.title.trim()) return 'Please enter the book title.';
    if (!data.author.trim()) return 'Please enter the author name.';
    if (data.title.trim().length > 300) return 'The title must be 300 characters or fewer.';
    if (data.author.trim().length > 200) return 'The author must be 200 characters or fewer.';

    if (data.pages !== '') {
      const pages = Number(data.pages);
      if (!Number.isInteger(pages) || pages < 1 || pages > 100000) {
        return 'Total pages must be a whole number between 1 and 100,000.';
      }
    }

    if (data.publishedYear !== '') {
      const year = Number(data.publishedYear);
      if (!Number.isInteger(year) || year < 0 || year > currentYear + 1) {
        return `Published year must be between 0 and ${currentYear + 1}.`;
      }
    }

    if (data.coverImage) {
      try {
        const url = new URL(data.coverImage);
        if (url.protocol !== 'https:') throw new Error('Invalid protocol');
      } catch (_error) {
        return 'Cover image must be a valid HTTPS URL.';
      }
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const genres = genreInput.trim() ? mergeGenres(genreInput) : formData.genre;
    const dataToValidate = { ...formData, genre: genres };
    const validationError = validate(dataToValidate);
    if (validationError) {
      setError(validationError);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    setError('');
    setLoading(true);

    try {
      const payload = {
        ...dataToValidate,
        title: dataToValidate.title.trim(),
        author: dataToValidate.author.trim(),
        isbn: dataToValidate.isbn.trim(),
        publisher: dataToValidate.publisher.trim(),
        language: dataToValidate.language.trim() || 'English',
        description: dataToValidate.description.trim(),
        coverImage: dataToValidate.coverImage.trim(),
        pages: dataToValidate.pages === '' ? null : Number(dataToValidate.pages),
        publishedYear: dataToValidate.publishedYear === '' ? null : Number(dataToValidate.publishedYear)
      };

      const response = await fetch(`${API_URL}/api/books`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        navigate(`/book/${data.id}`, { replace: true });
        return;
      }

      if (response.status === 401 || response.status === 403 || data.code === 'USER_NOT_FOUND') {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
        return;
      }

      setError(data.error || 'We could not add this book. Please try again.');
    } catch (_error) {
      setError('Unable to reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Link to="/library" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a535c] hover:opacity-75">
            <span aria-hidden="true">←</span> Back to library
          </Link>
          <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1a535c]">Your library</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Add a book</h1>
              <p className="mt-2 max-w-2xl text-slate-600">Capture the essentials now. You can add notes, ratings, and reading progress later.</p>
            </div>
            <Link
              to="/search-books"
              className="inline-flex items-center justify-center rounded-xl border border-[#1a535c]/20 bg-[#1a535c]/5 px-4 py-2.5 text-sm font-semibold text-[#1a535c] transition hover:bg-[#1a535c]/10"
            >
              Search the book catalog
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8 lg:py-10">
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {error && (
            <div
              ref={errorRef}
              tabIndex="-1"
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 outline-none focus:ring-2 focus:ring-red-300"
            >
              {error}
            </div>
          )}

          <fieldset disabled={loading} className="space-y-6 disabled:opacity-75">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-950">Book details</h2>
                <p className="mt-1 text-sm text-slate-500">Title and author are the only required fields.</p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="title" className="mb-2 block text-sm font-semibold text-slate-700">Title <span className="text-red-600">*</span></label>
                  <input id="title" name="title" value={formData.title} onChange={(event) => updateField('title', event.target.value)} className={inputClass} placeholder="e.g. The Left Hand of Darkness" maxLength="300" autoFocus required />
                </div>
                <div>
                  <label htmlFor="author" className="mb-2 block text-sm font-semibold text-slate-700">Author <span className="text-red-600">*</span></label>
                  <input id="author" name="author" value={formData.author} onChange={(event) => updateField('author', event.target.value)} className={inputClass} placeholder="e.g. Ursula K. Le Guin" maxLength="200" required />
                </div>
                <div>
                  <label htmlFor="language" className="mb-2 block text-sm font-semibold text-slate-700">Language</label>
                  <input id="language" name="language" value={formData.language} onChange={(event) => updateField('language', event.target.value)} className={inputClass} placeholder="English" maxLength="100" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="genres" className="mb-2 block text-sm font-semibold text-slate-700">Genres</label>
                  <div className="rounded-xl border border-gray-300 bg-white px-3 py-2 focus-within:border-[#1a535c] focus-within:ring-4 focus-within:ring-[#1a535c]/10">
                    {formData.genre.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {formData.genre.map((genre) => (
                          <span key={genre} className="inline-flex items-center gap-1.5 rounded-full bg-[#1a535c]/10 px-3 py-1 text-sm font-medium text-[#1a535c]">
                            {genre}
                            <button type="button" onClick={() => removeGenre(genre)} className="rounded-full px-1 hover:bg-[#1a535c]/10" aria-label={`Remove ${genre}`}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <input
                      id="genres"
                      value={genreInput}
                      onChange={(event) => {
                        if (event.target.value.includes(',')) {
                          updateField('genre', mergeGenres(event.target.value));
                          setGenreInput('');
                        } else setGenreInput(event.target.value);
                      }}
                      onKeyDown={handleGenreKeyDown}
                      onBlur={commitGenres}
                      className="w-full border-0 px-1 py-1 text-gray-900 outline-none placeholder:text-gray-400"
                      placeholder={formData.genre.length ? 'Add another genre' : 'Type a genre and press Enter'}
                      maxLength="60"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Press Enter or comma to add each genre.</p>
                </div>
                <div>
                  <label htmlFor="pages" className="mb-2 block text-sm font-semibold text-slate-700">Total pages</label>
                  <input id="pages" name="pages" type="number" inputMode="numeric" value={formData.pages} onChange={(event) => updateField('pages', event.target.value)} className={inputClass} placeholder="320" min="1" max="100000" />
                </div>
                <div>
                  <label htmlFor="format" className="mb-2 block text-sm font-semibold text-slate-700">Format</label>
                  <select id="format" name="format" value={formData.format} onChange={(event) => updateField('format', event.target.value)} className={inputClass}>
                    <option value="PHYSICAL">Physical book</option>
                    <option value="EBOOK">E-book</option>
                    <option value="AUDIOBOOK">Audiobook</option>
                    <option value="PDF">PDF</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="description" className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
                  <textarea id="description" name="description" value={formData.description} onChange={(event) => updateField('description', event.target.value)} rows="4" className={inputClass} placeholder="A short synopsis or reminder about this book…" maxLength="5000" />
                  <p className="mt-2 text-right text-xs text-slate-400">{formData.description.length}/5000</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-950">Reading plan</h2>
                <p className="mt-1 text-sm text-slate-500">Choose where this book belongs in your reading journey.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {statusOptions.map((option) => (
                  <label key={option.value} className={`cursor-pointer rounded-xl border p-4 transition ${formData.status === option.value ? 'border-[#1a535c] bg-[#1a535c]/5 ring-1 ring-[#1a535c]' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" name="status" value={option.value} checked={formData.status === option.value} onChange={(event) => updateField('status', event.target.value)} className="sr-only" />
                    <span className="block text-sm font-bold text-slate-900">{option.label}</span>
                    <span className="mt-1 block text-xs text-slate-500">{option.hint}</span>
                  </label>
                ))}
              </div>
              <div className="mt-5">
                <label htmlFor="priority" className="mb-2 block text-sm font-semibold text-slate-700">Priority</label>
                <select id="priority" name="priority" value={formData.priority} onChange={(event) => updateField('priority', event.target.value)} className={inputClass}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </section>

            <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-bold text-slate-950 sm:p-7">
                Publishing details <span className="text-xl font-normal text-slate-400 transition group-open:rotate-45">+</span>
              </summary>
              <div className="grid gap-5 border-t border-slate-100 p-5 sm:grid-cols-2 sm:p-7">
                <div>
                  <label htmlFor="publisher" className="mb-2 block text-sm font-semibold text-slate-700">Publisher</label>
                  <input id="publisher" name="publisher" value={formData.publisher} onChange={(event) => updateField('publisher', event.target.value)} className={inputClass} placeholder="Publisher name" maxLength="200" />
                </div>
                <div>
                  <label htmlFor="publishedYear" className="mb-2 block text-sm font-semibold text-slate-700">Published year</label>
                  <input id="publishedYear" name="publishedYear" type="number" inputMode="numeric" value={formData.publishedYear} onChange={(event) => updateField('publishedYear', event.target.value)} className={inputClass} placeholder={String(currentYear)} min="0" max={currentYear + 1} />
                </div>
                <div>
                  <label htmlFor="isbn" className="mb-2 block text-sm font-semibold text-slate-700">ISBN</label>
                  <input id="isbn" name="isbn" value={formData.isbn} onChange={(event) => updateField('isbn', event.target.value)} className={inputClass} placeholder="978-0-123456-78-9" maxLength="32" />
                </div>
                <div>
                  <label htmlFor="coverImage" className="mb-2 block text-sm font-semibold text-slate-700">Cover image URL</label>
                  <input id="coverImage" name="coverImage" type="url" value={formData.coverImage} onChange={(event) => updateField('coverImage', event.target.value)} className={inputClass} placeholder="https://example.com/cover.jpg" maxLength="2000" />
                </div>
              </div>
            </details>
          </fieldset>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link to="/library" className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-700 transition hover:bg-slate-100">Cancel</Link>
            <button type="submit" disabled={loading} className="inline-flex min-w-40 items-center justify-center rounded-xl bg-[#1a535c] px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-[#13434a] disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? 'Adding book…' : 'Add to library'}
            </button>
          </div>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex min-h-64 items-center justify-center bg-gradient-to-br from-[#1a535c] to-[#2f7c82] p-8">
              {formData.coverImage && !coverFailed ? (
                <img src={formData.coverImage} alt="Book cover preview" onError={() => setCoverFailed(true)} className="h-56 max-w-40 rounded-md object-cover shadow-2xl" />
              ) : (
                <div className="flex h-52 w-36 flex-col items-center justify-center rounded-md border border-white/30 bg-white/10 px-4 text-center text-white shadow-xl backdrop-blur-sm">
                  <span className="text-4xl" aria-hidden="true">📖</span>
                  <span className="mt-3 text-xs font-semibold uppercase tracking-widest text-white/80">Cover preview</span>
                </div>
              )}
            </div>
            <div className="p-6">
              <span className="inline-flex rounded-full bg-[#1a535c]/10 px-3 py-1 text-xs font-bold text-[#1a535c]">{statusLabel}</span>
              <h2 className="mt-4 break-words text-xl font-bold text-slate-950">{formData.title.trim() || 'Your book title'}</h2>
              <p className="mt-1 break-words text-sm text-slate-500">by {formData.author.trim() || 'Author name'}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-md bg-slate-100 px-2.5 py-1.5">{formData.format.toLowerCase().replace('_', ' ')}</span>
                {formData.pages && <span className="rounded-md bg-slate-100 px-2.5 py-1.5">{formData.pages} pages</span>}
                <span className="rounded-md bg-slate-100 px-2.5 py-1.5">{formData.priority.toLowerCase()} priority</span>
              </div>
              {formData.genre.length > 0 && <p className="mt-4 text-xs leading-5 text-slate-500">{formData.genre.join(' · ')}</p>}
            </div>
          </div>
          <p className="mt-4 px-2 text-center text-xs leading-5 text-slate-500">You can update progress, add notes, and write a review from the book details page.</p>
        </aside>
      </div>
    </main>
  );
}

export default AddBook;
