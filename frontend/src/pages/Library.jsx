import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

function Library() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [sortBy, setSortBy] = useState('dateAdded');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [stats, setStats] = useState({});

  const fetchBooks = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage,
        limit: 6,
        sortBy,
        sortOrder,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(genreFilter && { genre: genreFilter })
      });

      const response = await fetch(`${API_URL}/api/books?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setBooks(data.books);
        setPagination(data.pagination);
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
      }
    } catch (error) {
      console.error('Error fetching books:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/books/stats/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchBooks();
    fetchStats();
  }, [currentPage, search, statusFilter, genreFilter, sortBy, sortOrder]);

  const handleDelete = async (bookId) => {
    if (!confirm('Are you sure you want to delete this book?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/books/${bookId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        fetchBooks();
        fetchStats();
      }
    } catch (error) {
      console.error('Error deleting book:', error);
    }
  };

  const handleStatusChange = async (bookId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/books/${bookId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        // Update the book in the local state immediately for better UX
        setBooks(prevBooks => 
          prevBooks.map(book => 
            book.id === bookId 
              ? { ...book, status: newStatus }
              : book
          )
        );
        // Refresh data to get accurate stats and any server-side updates
        fetchBooks();
        fetchStats();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update book status');
      }
    } catch (error) {
      console.error('Error updating book status:', error);
      alert('Failed to update book status. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'TO_READ': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'COMPLETED': return 'Completed';
      case 'IN_PROGRESS': return 'Reading';
      case 'TO_READ': return 'To Read';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-2xl text-gray-600">Loading your library...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold" style={{ color: '#1a535c' }}>My Library</h1>
          <Link
            to="/add-book"
            className="text-white font-medium px-6 py-2.5 rounded-lg hover:opacity-90 transition duration-200"
            style={{ backgroundColor: '#1a535c' }}
          >
            Add Book
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: '#1a535c' }}>{stats.totalBooks || 0}</div>
            <div className="text-gray-600">Total Books</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: '#1a535c' }}>{stats.completedBooks || 0}</div>
            <div className="text-gray-600">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: '#1a535c' }}>{stats.inProgressBooks || 0}</div>
            <div className="text-gray-600">Reading</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: '#1a535c' }}>{stats.toReadBooks || 0}</div>
            <div className="text-gray-600">To Read</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input
              type="text"
              placeholder="Search books..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            >
              <option value="">All Status</option>
              <option value="TO_READ">To Read</option>
              <option value="IN_PROGRESS">Reading</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <input
              type="text"
              placeholder="Filter by genre..."
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            >
              <option value="dateAdded">Date Added</option>
              <option value="title">Title</option>
              <option value="author">Author</option>
              <option value="dateFinished">Date Finished</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>

        {/* Books Grid */}
        {books.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No books found</h3>
            <p className="text-gray-600 mb-6">Start building your digital library!</p>
            <Link
              to="/add-book"
              className="text-white font-medium px-6 py-3 rounded-lg hover:opacity-90 transition duration-200"
              style={{ backgroundColor: '#1a535c' }}
            >
              Add Your First Book
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {books.map((book) => (
                <div key={book.id} className="bg-white rounded-lg p-6 border border-gray-100 hover:border-gray-200 transition">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(book.status)}`}>
                      {getStatusText(book.status)}
                    </span>
                    <div className="flex space-x-2">
                      <Link
                        to={`/book/${book.id}`}
                        className="hover:opacity-70 font-medium"
                        style={{ color: '#1a535c' }}
                      >
                        View
                      </Link>
                      <Link
                        to={`/edit-book/${book.id}`}
                        className="hover:opacity-70 font-medium"
                        style={{ color: '#1a535c' }}
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(book.id)}
                        className="text-red-600 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{book.title}</h3>
                  <p className="text-gray-600 mb-2">by {book.author}</p>
                  {book.genre && book.genre.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {book.genre.slice(0, 2).map((genre, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md">
                          {genre}
                        </span>
                      ))}
                      {book.genre.length > 2 && (
                        <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded-md">
                          +{book.genre.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {book.pages && (
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{book.currentPage}/{book.pages} pages</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(book.currentPage / book.pages) * 100}%`, backgroundColor: '#1a535c' }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {book.rating && (
                    <div className="flex items-center mb-2">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={`text-lg ${i < book.rating ? 'text-yellow-400' : 'text-gray-300'}`}>
                          ★
                        </span>
                      ))}
                      <span className="text-sm text-gray-600 ml-2">({book.rating}/5)</span>
                    </div>
                  )}
                  
                  {book.notes && (
                    <p className="text-sm text-gray-600 italic mb-3">{book.notes.substring(0, 100)}...</p>
                  )}

                  {/* Quick Actions */}
                  <div className="flex space-x-2 pt-2">
                    {book.status === 'TO_READ' && (
                      <button
                        onClick={() => handleStatusChange(book.id, 'IN_PROGRESS')}
                        className="flex-1 bg-blue-50 text-blue-700 font-medium py-2 px-3 rounded-lg hover:bg-blue-100 transition text-sm"
                      >
                        Start Reading
                      </button>
                    )}
                    {book.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => handleStatusChange(book.id, 'COMPLETED')}
                        className="flex-1 bg-green-50 text-green-700 font-medium py-2 px-3 rounded-lg hover:bg-green-100 transition text-sm"
                      >
                        Mark Complete
                      </button>
                    )}
                    {book.status === 'COMPLETED' && (
                      <button
                        onClick={() => handleStatusChange(book.id, 'IN_PROGRESS')}
                        className="flex-1 bg-blue-50 text-blue-700 font-medium py-2 px-3 rounded-lg hover:bg-blue-100 transition text-sm"
                      >
                        Mark Reading
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center space-x-4">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={!pagination.hasPrev}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-gray-600">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!pagination.hasNext}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Library;
