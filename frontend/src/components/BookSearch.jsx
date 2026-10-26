import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

function BookSearch({ onBookSelect }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [provider, setProvider] = useState('');

  const searchBooks = async (searchQuery) => {
    const cleanQuery = searchQuery.trim();
    if (cleanQuery.length < 2) {
      setError('Enter at least 2 characters to search.');
      return;
    }

    setLoading(true);
    setError('');
    setHasSearched(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      const response = await fetch(`${API_URL}/api/books/search?q=${encodeURIComponent(cleanQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token');
          navigate('/login', { replace: true });
          return;
        }
        throw new Error(data.error || 'Book search is temporarily unavailable.');
      }

      setBooks(data.items || []);
      setProvider(data.provider || '');
    } catch (err) {
      setError(err.message || 'Failed to search books. Please try again.');
      setBooks([]);
      setProvider('');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    searchBooks(query);
  };

  const toggleDescription = (bookId) => {
    setExpandedDescriptions(prev => ({
      ...prev,
      [bookId]: !prev[bookId]
    }));
  };

  const truncateText = (text, maxLength = 200) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getBookCover = (book) => {
    const imageLinks = book.volumeInfo?.imageLinks;
    const cover = imageLinks?.thumbnail || imageLinks?.smallThumbnail;
    return cover ? cover.replace(/^http:\/\//i, 'https://') : null;
  };

  const formatAuthors = (authors) => {
    if (!authors || authors.length === 0) return 'Unknown Author';
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return authors.join(' & ');
    return `${authors[0]} & ${authors.length - 1} others`;
  };

  const handleAddBook = (book) => {
    // Convert language code to full name
    const getLanguageName = (langCode) => {
      const languageMap = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese'
      };
      return languageMap[langCode] || 'English';
    };

    // Clean and validate genre data
    const cleanGenres = (categories) => {
      if (!categories || !Array.isArray(categories)) return [];
      return categories
        .filter(cat => cat && typeof cat === 'string')
        .map(cat => cat.trim())
        .filter(cat => cat.length > 0)
        .slice(0, 5); // Limit to 5 genres max
    };

    const bookData = {
      title: book.volumeInfo?.title || 'Unknown Title',
      author: formatAuthors(book.volumeInfo?.authors),
      genre: cleanGenres(book.volumeInfo?.categories),
      description: book.volumeInfo?.description || '',
      isbn: book.volumeInfo?.industryIdentifiers?.[0]?.identifier || '',
      publisher: book.volumeInfo?.publisher || '',
      publishedYear: book.volumeInfo?.publishedDate ? new Date(book.volumeInfo.publishedDate).getFullYear() : null,
      pages: book.volumeInfo?.pageCount || null,
      coverImage: getBookCover(book),
      language: getLanguageName(book.volumeInfo?.language || 'en')
    };

    if (onBookSelect) {
      onBookSelect(bookData);
    }
  };

  return (
    <div className="w-full">
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for books by title, author, or keywords..."
            className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-gray-900"
            disabled={loading}
            minLength="2"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="text-white font-medium px-8 py-3 rounded-lg hover:opacity-90 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#1a535c' }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#1a535c' }}></div>
          <p className="mt-4 text-gray-600">Searching for books...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded mb-6">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* No Results */}
      {hasSearched && !loading && !error && books.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-xl font-bold text-gray-900 mb-2">No books found</h3>
          <p className="text-gray-600">Try searching with different keywords or check your spelling.</p>
        </div>
      )}

      {/* Results Grid */}
      {books.length > 0 && (
        <>
          {provider === 'open-library' && (
            <p className="mb-4 text-sm text-gray-500">Results provided by Open Library</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((book) => {
            const bookId = book.id;
            const volumeInfo = book.volumeInfo || {};
            const coverImage = getBookCover(book);
            const description = volumeInfo.description || '';
            const isExpanded = expandedDescriptions[bookId];

            return (
              <div key={bookId} className="bg-white rounded-lg p-6 border border-gray-100 hover:border-gray-200 transition">
                {/* Book Cover */}
                <div className="flex items-start space-x-4 mb-4">
                  <div className="flex-shrink-0 w-20 h-28 bg-gray-100 rounded-lg overflow-hidden">
                    {coverImage ? (
                      <img
                        src={coverImage}
                        alt={volumeInfo.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center"
                      style={{ display: coverImage ? 'none' : 'flex' }}
                    >
                      No Cover
                    </div>
                  </div>

                  {/* Book Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">
                      {volumeInfo.title || 'Unknown Title'}
                    </h3>
                    <p className="text-gray-600 mb-2 text-sm">
                      by {formatAuthors(volumeInfo.authors)}
                    </p>
                    {volumeInfo.publishedDate && (
                      <p className="text-gray-500 text-xs mb-2">
                        Published: {new Date(volumeInfo.publishedDate).getFullYear()}
                      </p>
                    )}
                    {volumeInfo.pageCount && (
                      <p className="text-gray-500 text-xs">
                        {volumeInfo.pageCount} pages
                      </p>
                    )}
                  </div>
                </div>

                {/* Description */}
                {description && (
                  <div className="mb-4">
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {isExpanded ? description : truncateText(description)}
                    </p>
                    {description.length > 200 && (
                      <button
                        onClick={() => toggleDescription(bookId)}
                        className="text-sm font-medium mt-2 hover:opacity-70"
                        style={{ color: '#1a535c' }}
                      >
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                )}

                {/* Categories */}
                {volumeInfo.categories && volumeInfo.categories.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {volumeInfo.categories.slice(0, 2).map((category, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md">
                          {category}
                        </span>
                      ))}
                      {volumeInfo.categories.length > 2 && (
                        <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded-md">
                          +{volumeInfo.categories.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Add Button */}
                <button
                  onClick={() => handleAddBook(book)}
                  className="w-full text-white font-medium py-2 rounded-lg hover:opacity-90 transition duration-200"
                  style={{ backgroundColor: '#1a535c' }}
                >
                  Add to Library
                </button>
              </div>
            );
          })}
          </div>
        </>
      )}

      {/* Results Count */}
      {books.length > 0 && (
        <div className="mt-6 text-center text-gray-600">
          Found {books.length} books
        </div>
      )}
    </div>
  );
}

export default BookSearch;
