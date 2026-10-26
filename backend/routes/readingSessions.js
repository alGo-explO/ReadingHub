import express from 'express';
import prisma from '../lib/prisma.js';
import authenticateToken from '../middleware/auth.js';

const router = express.Router();


router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const sessions = await prisma.readingSession.findMany({
      where: { userId: req.userId },
      include: {
        book: {
          select: { id: true, title: true, author: true }
        }
      },
      orderBy: { date: 'desc' },
      skip,
      take: parsedLimit
    });

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching reading sessions:', error);
    res.status(500).json({ error: 'Failed to fetch reading sessions' });
  }
});

// Create new reading session
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { bookId, startPage, endPage, duration, notes, mood, location } = req.body;

    const parsedStart = Number(startPage);
    const parsedEnd = Number(endPage);
    const parsedDuration = Number(duration);

    if (!bookId || !Number.isInteger(parsedStart) || !Number.isInteger(parsedEnd) || !Number.isInteger(parsedDuration)) {
      return res.status(400).json({ error: 'Book, pages, and duration are required' });
    }
    if (parsedStart < 0 || parsedEnd <= parsedStart || parsedDuration < 1 || parsedDuration > 1440) {
      return res.status(400).json({ error: 'End page must be greater than start page' });
    }


    const book = await prisma.book.findFirst({
      where: { id: bookId, userId: req.userId }
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    if (book.pages && parsedEnd > book.pages) {
      return res.status(400).json({ error: 'End page cannot exceed the book page count' });
    }

    const session = await prisma.$transaction(async (tx) => {
      const createdSession = await tx.readingSession.create({
        data: {
          bookId,
          userId: req.userId,
          startPage: parsedStart,
          endPage: parsedEnd,
          duration: parsedDuration,
          notes: typeof notes === 'string' ? notes.trim().slice(0, 2000) || null : null,
          mood: typeof mood === 'string' ? mood.trim().slice(0, 50) || null : null,
          location: typeof location === 'string' ? location.trim().slice(0, 150) || null : null
        },
        include: {
          book: {
            select: { id: true, title: true, author: true }
          }
        }
      });

      await tx.book.update({
        where: { id: bookId },
        data: {
          currentPage: Math.max(book.currentPage, parsedEnd),
          ...(book.status === 'TO_READ' && { status: 'IN_PROGRESS', dateStarted: new Date() })
        }
      });

      return createdSession;
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating reading session:', error);
    res.status(500).json({ error: 'Failed to create reading session' });
  }
});

// Get reading session statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const sessions = await prisma.readingSession.findMany({
      where: { userId: req.userId }
    });

    const totalSessions = sessions.length;
    const totalPages = sessions.reduce((sum, session) => sum + (session.endPage - session.startPage), 0);
    const totalMinutes = sessions.reduce((sum, session) => sum + session.duration, 0);
    const avgSessionTime = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

    res.json({
      totalSessions,
      totalPages,
      totalMinutes,
      avgSessionTime
    });
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch session statistics' });
  }
});


router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const session = await prisma.readingSession.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Reading session not found' });
    }

    await prisma.readingSession.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Reading session deleted successfully' });
  } catch (error) {
    console.error('Error deleting reading session:', error);
    res.status(500).json({ error: 'Failed to delete reading session' });
  }
});

export default router;
