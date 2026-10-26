import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY environment variable is not set');
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    try {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
      this.initialized = true;
      console.log('✅ Gemini AI service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI service:', error.message);
      throw error;
    }
  }

  ensureInitialized() {
    if (!this.initialized) {
      this.initialize();
    }
  }

  async generateText(prompt) {
    this.ensureInitialized();
    const candidateModels = [
      process.env.GEMINI_MODEL,
      'gemini-2.5-flash'
    ].filter(Boolean);

    const modelsToTry = [...new Set(candidateModels)];
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (error) {
        lastError = error;
        console.warn(`[GeminiService] Model ${modelName} failed (${error.status || error.message}). Trying fallback model...`);
      }
    }

    throw lastError || new Error('All Gemini models failed to generate content');
  }

  async chat(message, context = '') {
    this.ensureInitialized();
    const prompt = `${context}User question: ${message}

Please provide a helpful, friendly, and engaging response about books, reading habits, authors, or literary recommendations. Keep it conversational.`;

    try {
      return await this.generateText(prompt);
    } catch (error) {
      console.error('Error during AI chat:', error);
      return "I'm having a little trouble connecting to my full book knowledge right now due to high server demand. Here are a few timeless recommendations while we wait: if you love fiction, check out 'The Midnight Library' by Matt Haig; for sci-fi, 'Project Hail Mary' by Andy Weir; or for non-fiction, 'Atomic Habits' by James Clear. Feel free to try asking again in a moment!";
    }
  }

  async generateBookRecommendations(userBooks, preferences = {}) {
    this.ensureInitialized();
    
    try {
      const { genres = [], authors = [], readingGoals = '' } = preferences;
      
      const booksContext = userBooks.map(book => 
        `"${book.title}" by ${book.author} (${book.genre?.join(', ') || 'Unknown genre'}) - Status: ${book.status}`
      ).join('\n');

      const prompt = `
Based on this user's reading history and preferences, recommend 5 books they might enjoy:

READING HISTORY:
${booksContext}

PREFERENCES:
- Favorite genres: ${genres.join(', ') || 'Not specified'}
- Favorite authors: ${authors.join(', ') || 'Not specified'}
- Reading goals: ${readingGoals || 'Not specified'}

Please provide 5 book recommendations in this exact JSON format:
{
  "recommendations": [
    {
      "title": "Book Title",
      "author": "Author Name",
      "genre": ["Genre1", "Genre2"],
      "reason": "Why this book is recommended based on their reading history",
      "description": "Brief description of the book"
    }
  ]
}

Focus on books that match their reading patterns and introduce them to new but related genres or authors.
`;

      const text = await this.generateText(prompt);
      
      // Try to parse JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse recommendations from AI response');
    } catch (error) {
      console.error('Error generating book recommendations:', error);
      throw new Error('Failed to generate book recommendations');
    }
  }

  async generateReadingInsights(userBooks, readingSessions = []) {
    this.ensureInitialized();
    
    try {
      const completedBooks = userBooks.filter(book => book.status === 'COMPLETED');
      const inProgressBooks = userBooks.filter(book => book.status === 'IN_PROGRESS');
      
      const booksContext = completedBooks.map(book => 
        `"${book.title}" by ${book.author} (${book.genre?.join(', ') || 'Unknown'}) - Rating: ${book.rating || 'Not rated'}`
      ).join('\n');

      const prompt = `
Analyze this user's reading patterns and provide insights:

COMPLETED BOOKS (${completedBooks.length}):
${booksContext}

CURRENTLY READING (${inProgressBooks.length}):
${inProgressBooks.map(book => `"${book.title}" by ${book.author}`).join('\n')}

READING SESSIONS: ${readingSessions.length} sessions recorded

Please provide reading insights in this JSON format:
{
  "insights": {
    "readingPatterns": "Analysis of their reading habits and preferences",
    "favoriteGenres": ["Genre1", "Genre2"],
    "readingStrengths": "What they're doing well in their reading journey",
    "suggestions": "Suggestions to improve their reading experience",
    "yearProgress": "Assessment of their reading progress this year"
  }
}

Be encouraging and provide actionable insights based on their reading data.
`;

      const text = await this.generateText(prompt);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse insights from AI response');
    } catch (error) {
      console.error('Error generating reading insights:', error);
      throw new Error('Failed to generate reading insights');
    }
  }

  async generateBookSummary(bookTitle, bookAuthor, userNotes = '') {
    this.ensureInitialized();
    
    try {
      const prompt = `
Create a helpful summary for the book "${bookTitle}" by ${bookAuthor}.

${userNotes ? `User's personal notes: ${userNotes}` : ''}

Please provide a summary in this JSON format:
{
  "summary": {
    "overview": "Brief overview of the book (2-3 sentences)",
    "keyThemes": ["Theme1", "Theme2", "Theme3"],
    "mainTakeaways": ["Takeaway1", "Takeaway2", "Takeaway3"],
    "recommendedFor": "Who would enjoy this book",
    "similarBooks": ["Similar Book 1", "Similar Book 2"]
  }
}

Keep it concise and helpful for someone who has read or is reading the book.
`;

      const text = await this.generateText(prompt);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse summary from AI response');
    } catch (error) {
      console.error('Error generating book summary:', error);
      throw new Error('Failed to generate book summary');
    }
  }

  async generateReadingGoals(userBooks, currentGoal = null) {
    this.ensureInitialized();
    
    try {
      const completedThisYear = userBooks.filter(book => 
        book.status === 'COMPLETED' && 
        book.dateFinished && 
        new Date(book.dateFinished).getFullYear() === new Date().getFullYear()
      );

      const prompt = `
Help set realistic reading goals for this user:

CURRENT PROGRESS:
- Books completed this year: ${completedThisYear.length}
- Current goal: ${currentGoal || 'Not set'}
- Total books in library: ${userBooks.length}
- Currently reading: ${userBooks.filter(book => book.status === 'IN_PROGRESS').length}

Please suggest reading goals in this JSON format:
{
  "goals": {
    "yearlyGoal": "Suggested number of books for the year",
    "monthlyGoal": "Suggested books per month",
    "genreChallenge": "Suggestion to explore new genres",
    "readingHabit": "Suggestion for building better reading habits",
    "motivation": "Encouraging message about their reading journey"
  }
}

Be realistic and encouraging based on their current reading pace.
`;

      const text = await this.generateText(prompt);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse goals from AI response');
    } catch (error) {
      console.error('Error generating reading goals:', error);
      throw new Error('Failed to generate reading goals');
    }
  }
}

export default new GeminiService();
