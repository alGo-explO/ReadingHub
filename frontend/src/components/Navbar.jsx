import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function Navbar({ setToken }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [user, setUser] = useState(null);

  // Fetch user data on component mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token');
          setToken(null);
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };

    fetchUser();
    const handleProfileUpdate = (event) => {
      setUser((previous) => ({ ...previous, ...event.detail }));
    };
    window.addEventListener('profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('profile-updated', handleProfileUpdate);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setShowProfileMenu(false);
    navigate('/login');
    // Force page refresh to clear any cached state
    window.location.reload();
  };

  const isActive = (path) => location.pathname === path;

  // Get user's first letter
  const getUserInitial = () => {
    if (user && user.name) {
      return user.name.charAt(0).toUpperCase();
    }
    return 'U'; // Default fallback
  };

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/library" className="flex items-center space-x-3">
            <span className="text-2xl font-bold" style={{ color: '#1a535c' }}>ReadingHub</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              to="/library"
              className={`font-medium transition-colors ${
                isActive('/library')
                  ? 'border-b-2 pb-1'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={isActive('/library') ? { color: '#1a535c', borderColor: '#1a535c' } : {}}
            >
              Library
            </Link>
            <Link
              to="/collections"
              className={`font-medium transition-colors ${
                isActive('/collections')
                  ? 'border-b-2 pb-1'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={isActive('/collections') ? { color: '#1a535c', borderColor: '#1a535c' } : {}}
            >
              Collections
            </Link>
            <Link
              to="/reading-sessions"
              className={`font-medium transition-colors ${
                isActive('/reading-sessions')
                  ? 'border-b-2 pb-1'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={isActive('/reading-sessions') ? { color: '#1a535c', borderColor: '#1a535c' } : {}}
            >
              Sessions
            </Link>
            <Link
              to="/ai-insights"
              className={`font-medium transition-colors ${
                isActive('/ai-insights')
                  ? 'border-b-2 pb-1'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={isActive('/ai-insights') ? { color: '#1a535c', borderColor: '#1a535c' } : {}}
            >
              AI Assistant
            </Link>
            <Link
              to="/analytics"
              className={`font-medium transition-colors ${
                isActive('/analytics')
                  ? 'border-b-2 pb-1'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={isActive('/analytics') ? { color: '#1a535c', borderColor: '#1a535c' } : {}}
            >
              Analytics
            </Link>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            <Link
              to="/search-books"
              className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              Search Books
            </Link>
            <Link
              to="/add-book"
              className="text-white font-medium px-6 py-2 rounded-lg hover:opacity-90 transition duration-200"
              style={{ backgroundColor: '#1a535c' }}
            >
              Add Book
            </Link>

            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium hover:opacity-90 transition"
                style={{ backgroundColor: '#1a535c' }}
                aria-label="Open profile menu"
                aria-expanded={showProfileMenu}
              >
                {getUserInitial()}
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2">
                  <Link
                    to="/profile"
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-50 transition"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    Profile
                  </Link>
                  <hr className="my-2" />
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-50 transition"
                    style={{ color: '#1a535c' }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
