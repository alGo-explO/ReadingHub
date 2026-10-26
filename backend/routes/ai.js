import express from 'express';
import prisma from '../lib/prisma.js';
import authenticateToken from '../middleware/auth.js';
import geminiService from '../services/geminiService.js';

const router = express.Router();

router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const userBooks = await prisma.book.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        title: true,
        author: true,
        genre: true,
        status: true,
        rating: true
      }
    });

    if (userBooks.length === 0) {
      return res.json({
        recommendations: [],
        message: 'Add some books to your library to get personalized recommendations!'
      });
    }

    const preferences = {
      genres: [...new Set(userBooks.flatMap(book => book.genre || []))],
      authors: [...new Set(userBooks.map(book => book.author))].slice(0, 5)
    };

    try {
      const recommendations = await geminiService.generateBookRecommendations(userBooks, preferences);
      res.json(recommendations);
    } catch (aiError) {
      console.error('AI service error:', aiError.message);
      
      res.json({
        recommendations: [
          {
            title: "The Seven Husbands of Evelyn Hugo",
            author: "Taylor Jenkins Reid",
            genre: ["Fiction", "Romance"],
            reason: "Based on your reading preferences, this engaging novel offers compelling characters and storytelling.",
            description: "A reclusive Hollywood icon finally tells her story to a young journalist."
          }
        ],
        message: 'AI recommendations temporarily unavailable. Here are some popular suggestions.',
        fallback: true
      });
    }
  } catch (error) {
    console.error('Error getting AI recommendations:', error);
    res.status(500).json({ 
      error: 'Failed to generate recommendations',
      message: 'Please try again later'
    });
  }
});


router.get('/insights', authenticateToken, async (req, res) => {
  try {
    const userBooks = await prisma.book.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      take: 200
    });


    const readingSessions = await prisma.readingSession.findMany({
      where: { userId: req.userId },
      orderBy: { date: 'desc' },
      take: 50 
    });

    if (userBooks.length === 0) {
      return res.json({
        insights: {
          readingPatterns: 'Start adding books to your library to get personalized insights!',
          favoriteGenres: [],
          readingStrengths: 'Begin your reading journey by adding your first book.',
          suggestions: 'Add books you\'ve read or want to read to get AI-powered insights.',
          yearProgress: 'Your reading adventure is about to begin!'
        }
      });
    }

    try {
      const insights = await geminiService.generateReadingInsights(userBooks, readingSessions);
      res.json(insights);
    } catch (aiError) {
      console.error('AI insights error:', aiError.message);
      

      res.json({
        insights: {
          readingPatterns: 'You have a growing library with diverse interests. Keep exploring different genres!',
          favoriteGenres: [...new Set(userBooks.flatMap(book => book.genre || []))].slice(0, 3),
          readingStrengths: 'You\'re building a great reading habit by tracking your books.',
          suggestions: 'Try setting a monthly reading goal and explore new authors in your favorite genres.',
          yearProgress: `You have ${userBooks.filter(b => b.status === 'COMPLETED').length} completed books. Keep up the great work!`
        },
        fallback: true
      });
    }
  } catch (error) {
    console.error('Error getting reading insights:', error);
    res.status(500).json({ 
      error: 'Failed to generate insights',
      message: 'Please try again later'
    });
  }
});


router.get('/summary/:bookId', authenticateToken, async (req, res) => {
  try {
    const { bookId } = req.params;
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: req.userId
      }
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const summary = await geminiService.generateBookSummary(
      book.title, 
      book.author, 
      book.notes || ''
    );
    
    res.json(summary);
  } catch (error) {
    console.error('Error generating book summary:', error);
    res.status(500).json({ 
      error: 'Failed to generate book summary',
      message: 'Please try again later'
    });
  }
});


router.get('/goals', authenticateToken, async (req, res) => {
  try {
    const userBooks = await prisma.book.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      take: 200
    });


    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { readingGoal: true }
    });

    const goals = await geminiService.generateReadingGoals(userBooks, user?.readingGoal);
    
    res.json(goals);
  } catch (error) {
    console.error('Error generating reading goals:', error);
    res.status(500).json({ 
      error: 'Failed to generate reading goals',
      message: 'Please try again later'
    });
  }
});

router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, bookId } = req.body;
    
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 4000) {
      return res.status(400).json({ error: 'Message must be 4000 characters or fewer' });
    }

    let context = '';
    
    try {
      if (bookId) {
        const book = await prisma.book.findFirst({
          where: {
            id: bookId,
            userId: req.userId
          }
        });

        if (book) {
          context = `Context: User is asking about "${book.title}" by ${book.author}. `;
          if (book.notes) context += `User's notes: ${book.notes}. `;
          if (book.review) context += `User's review: ${book.review}. `;
        }
      } else {
        const recentBooks = await prisma.book.findMany({
          where: { userId: req.userId },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: { title: true, author: true, status: true }
        });

        if (recentBooks && recentBooks.length > 0) {
          context = `Context: User's recent books: ${recentBooks.map(b => `"${b.title}" by ${b.author} (${b.status})`).join(', ')}. `;
        }
      }
    } catch (contextError) {
      console.warn('Could not retrieve book context for AI chat:', contextError.message);
    }

    const aiResponse = await geminiService.chat(message.trim(), context);

    res.json({
      response: aiResponse,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in AI chat route:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      message: 'Please try again later'
    });
  }
});

export default router;
