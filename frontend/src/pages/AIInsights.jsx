import { useState, useEffect } from 'react';
import { API_URL } from '../config';

function AIInsights() {
  const [activeTab, setActiveTab] = useState('recommendations');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [insights, setInsights] = useState(null);
  const [goals, setGoals] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/ai/recommendations`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || []);
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/ai/insights`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights);
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/ai/goals`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setGoals(data.goals);
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setChatHistory(prev => [
        ...prev,
        { type: 'user', message: chatMessage },
        {
          type: 'ai',
          message: 'Your session has expired or you are not logged in. Please log in again to continue.',
          isAuthError: true
        }
      ]);
      setChatMessage('');
      return;
    }

    setChatLoading(true);
    const userMessage = chatMessage;
    setChatMessage('');
    
    // Add user message to chat
    setChatHistory(prev => [...prev, { type: 'user', message: userMessage }]);

    try {
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMessage })
      });

      if (response.ok) {
        const data = await response.json();
        setChatHistory(prev => [...prev, { type: 'ai', message: data.response }]);
      } else {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token');
          setChatHistory(prev => [...prev, {
            type: 'ai',
            message: 'Your session has expired or is invalid. Please log in again to continue.',
            isAuthError: true
          }]);
        } else {
          setChatHistory(prev => [...prev, {
            type: 'ai',
            message: errData.message || errData.error || 'Sorry, I encountered an error. Please try again.'
          }]);
        }
      }
    } catch (error) {
      console.error('Error sending chat message:', error);
      setChatHistory(prev => [...prev, { type: 'ai', message: 'Unable to reach the server. Please check your connection and ensure the backend is running.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'recommendations') {
      fetchRecommendations();
    } else if (activeTab === 'insights') {
      fetchInsights();
    } else if (activeTab === 'goals') {
      fetchGoals();
    }
  }, [activeTab]);

  const tabs = [
    { id: 'recommendations', label: 'Book Recommendations', icon: '📚' },
    { id: 'insights', label: 'Reading Insights', icon: '📊' },
    { id: 'goals', label: 'Reading Goals', icon: '🎯' },
    { id: 'chat', label: 'AI Chat', icon: '💬' }
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#1a535c' }}>
            AI Reading Assistant
          </h1>
          <p className="text-gray-600">Get personalized insights and recommendations powered by AI</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-md font-medium transition ${
                activeTab === tab.id
                  ? 'text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={{
                backgroundColor: activeTab === tab.id ? '#1a535c' : 'transparent'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg">
          {/* Recommendations Tab */}
          {activeTab === 'recommendations' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Personalized Book Recommendations</h2>
                <button
                  onClick={fetchRecommendations}
                  disabled={loading}
                  className="text-white font-medium px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                  style={{ backgroundColor: '#1a535c' }}
                >
                  {loading ? 'Generating...' : 'Refresh'}
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#1a535c' }}></div>
                  <p className="mt-4 text-gray-600">AI is analyzing your reading preferences...</p>
                </div>
              ) : recommendations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recommendations.map((book, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{book.title}</h3>
                      <p className="text-gray-600 mb-3">by {book.author}</p>
                      
                      {book.genre && book.genre.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {book.genre.map((genre, i) => (
                            <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md">
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <p className="text-sm text-gray-700 mb-3">{book.description}</p>
                      
                      <div className="bg-blue-50 p-3 rounded-md">
                        <p className="text-sm text-blue-800">
                          <strong>Why recommended:</strong> {book.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">Add some books to your library to get AI-powered recommendations!</p>
                </div>
              )}
            </div>
          )}

          {/* Insights Tab */}
          {activeTab === 'insights' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Reading Insights</h2>
                <button
                  onClick={fetchInsights}
                  disabled={loading}
                  className="text-white font-medium px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                  style={{ backgroundColor: '#1a535c' }}
                >
                  {loading ? 'Analyzing...' : 'Refresh'}
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#1a535c' }}></div>
                  <p className="mt-4 text-gray-600">AI is analyzing your reading patterns...</p>
                </div>
              ) : insights ? (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">📈 Reading Patterns</h3>
                    <p className="text-gray-700">{insights.readingPatterns}</p>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">🌟 Your Strengths</h3>
                    <p className="text-gray-700">{insights.readingStrengths}</p>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">💡 Suggestions</h3>
                    <p className="text-gray-700">{insights.suggestions}</p>
                  </div>

                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-lg">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">📅 Year Progress</h3>
                    <p className="text-gray-700">{insights.yearProgress}</p>
                  </div>

                  {insights.favoriteGenres && insights.favoriteGenres.length > 0 && (
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h3 className="text-lg font-bold text-gray-900 mb-3">❤️ Favorite Genres</h3>
                      <div className="flex flex-wrap gap-2">
                        {insights.favoriteGenres.map((genre, index) => (
                          <span key={index} className="px-3 py-1 bg-white text-gray-700 rounded-full text-sm border">
                            {genre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">Add some books to get personalized reading insights!</p>
                </div>
              )}
            </div>
          )}

          {/* Goals Tab */}
          {activeTab === 'goals' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Reading Goals</h2>
                <button
                  onClick={fetchGoals}
                  disabled={loading}
                  className="text-white font-medium px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                  style={{ backgroundColor: '#1a535c' }}
                >
                  {loading ? 'Generating...' : 'Refresh'}
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#1a535c' }}></div>
                  <p className="mt-4 text-gray-600">AI is creating personalized goals...</p>
                </div>
              ) : goals ? (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-lg">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">📅 Yearly Goal</h3>
                    <p className="text-gray-700">{goals.yearlyGoal}</p>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-teal-50 p-6 rounded-lg">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">📖 Monthly Target</h3>
                    <p className="text-gray-700">{goals.monthlyGoal}</p>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-6 rounded-lg">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">🎨 Genre Challenge</h3>
                    <p className="text-gray-700">{goals.genreChallenge}</p>
                  </div>

                  <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-lg">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">⚡ Reading Habit</h3>
                    <p className="text-gray-700">{goals.readingHabit}</p>
                  </div>

                  <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-6 rounded-lg">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">💪 Motivation</h3>
                    <p className="text-gray-700">{goals.motivation}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">Add some books to get personalized reading goals!</p>
                </div>
              )}
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Chat with AI Reading Assistant</h2>
              
              <div className="bg-gray-50 rounded-lg p-4 h-96 overflow-y-auto mb-4">
                {chatHistory.length === 0 ? (
                  <div className="text-center text-gray-500 mt-20">
                    <p>👋 Hi! I'm your AI reading assistant.</p>
                    <p>Ask me anything about books, reading recommendations, or your reading journey!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatHistory.map((chat, index) => (
                      <div key={index} className={`flex ${chat.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          chat.type === 'user' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-white text-gray-800 border'
                        }`}>
                          <p className="text-sm">{chat.message}</p>
                          {chat.isAuthError && (
                            <a
                              href="/login"
                              className="inline-block mt-2 px-3 py-1.5 text-xs font-semibold text-white rounded-md hover:opacity-90 transition shadow-sm"
                              style={{ backgroundColor: '#1a535c' }}
                            >
                              Log in again →
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white text-gray-800 border px-4 py-2 rounded-lg">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Ask me about books, reading tips, or recommendations..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400"
                  disabled={chatLoading}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatMessage.trim()}
                  className="text-white font-medium px-6 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                  style={{ backgroundColor: '#1a535c' }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIInsights;
