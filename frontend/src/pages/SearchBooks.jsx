import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BookSearch from '../components/BookSearch';
import { API_URL } from '../config';

function SearchBooks() {
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [addedBooks, setAddedBooks] = useState(new Set());

  const handleBookSelect = async (bookData) => {
    setIsAdding(true);

    try {
      const token = localStorage.getItem('token');
      
      // Clean and validate the book data
      const cleanBookData = {
        title: bookData.title || 'Unknown Title',
        author: bookData.author || 'Unknown Author',
        genre: Array.isArray(bookData.genre) ? bookData.genre : [],
        description: bookData.description || '',
        isbn: bookData.isbn || '',
        publisher: bookData.publisher || '',
        publishedYear: bookData.publishedYear || null,
        pages: bookData.pages || null,
        coverImage: bookData.coverImage || '',
        language: bookData.language || 'English',
        status: 'TO_READ',
        format: 'PHYSICAL',
        priority: 'MEDIUM'
      };

      const response = await fetch(`${API_URL}/api/books`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(cleanBookData)
      });

      if (response.ok) {
        await response.json();
        setAddedBooks(prev => new Set([...prev, bookData.title]));
        
        // Show success message briefly
        setTimeout(() => {
          setAddedBooks(prev => {
            const newSet = new Set(prev);
            newSet.delete(bookData.title);
            return newSet;
          });
        }, 3000);
      } else {
        const data = await response.json();
        console.error('Failed to add book:', {
          status: response.status,
          statusText: response.statusText,
          error: data
        });
        
        // If token is invalid or user not found, redirect to login
        if (response.status === 401 || response.status === 403 || data.code === 'USER_NOT_FOUND') {
          localStorage.removeItem('token');
          alert('Your session has expired or is invalid. Please log in again.');
          navigate('/login');
          return;
        }
        
        alert(`Failed to add book: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding book:', error);
      alert('Failed to add book. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: '#1a535c' }}>Search Books</h1>
            <p className="text-gray-600">Discover and add books to your library using Google Books</p>
          </div>
          <button
            onClick={() => navigate('/library')}
            className="text-white font-medium px-6 py-2 rounded-lg hover:opacity-90 transition duration-200"
            style={{ backgroundColor: '#1a535c' }}
          >
            Back to Library
          </button>
        </div>
      </div>

      {/* Success Messages */}
      {addedBooks.size > 0 && (
        <div className="mb-6">
          {Array.from(addedBooks).map((title) => (
            <div key={title} className="bg-green-50 border-l-4 border-green-500 text-green-700 px-4 py-3 rounded mb-2">
              <p className="text-sm">✓ "{title}" has been added to your library!</p>
            </div>
          ))}
        </div>
      )}

      {/* Loading Overlay */}
      {isAdding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#1a535c' }}></div>
            <span className="text-gray-900">Adding book to library...</span>
          </div>
        </div>
      )}

      {/* Book Search Component */}
      <BookSearch onBookSelect={handleBookSelect} />
    </div>
  );
}

export default SearchBooks;
