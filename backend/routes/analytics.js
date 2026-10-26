import express from 'express';
import prisma from '../lib/prisma.js';
import authenticateToken from '../middleware/auth.js';

const router = express.Router();


router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { timeframe = 'year' } = req.query;
    const userId = req.userId;

    const now = new Date();
    let startDate;
    
    switch (timeframe) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(2000, 0, 1); 
    }


    const [
      totalBooks,
      booksCompleted,
      booksInProgress,
      booksToRead,
      completedInTimeframe,
      readingSessions
    ] = await Promise.all([
      prisma.book.count({ where: { userId } }),
      prisma.book.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.book.count({ where: { userId, status: 'IN_PROGRESS' } }),
      prisma.book.count({ where: { userId, status: 'TO_READ' } }),
      prisma.book.count({
        where: {
          userId,
          status: 'COMPLETED',
          dateFinished: { gte: startDate }
        }
      }),
      prisma.readingSession.findMany({
        where: {
          userId,
          date: { gte: startDate }
        }
      })
    ]);


    const totalPages = readingSessions.reduce((sum, session) => 
      sum + (session.endPage - session.startPage), 0
    );
    
    const totalMinutes = readingSessions.reduce((sum, session) => 
      sum + session.duration, 0
    );

    const daysInTimeframe = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    const avgPagesPerDay = daysInTimeframe > 0 ? Math.round(totalPages / daysInTimeframe) : 0;
    const avgSessionTime = readingSessions.length > 0 ? 
      Math.round(totalMinutes / readingSessions.length) : 0;


    const recentSessions = await prisma.readingSession.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 30
    });

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const sessionDates = [...new Set(recentSessions.map(s => 
      s.date.toISOString().split('T')[0]
    ))].sort().reverse();

    for (let i = 0; i < sessionDates.length; i++) {
      const currentDate = new Date(sessionDates[i]);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      
      if (currentDate.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
        currentStreak++;
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        if (i === 0) currentStreak = 0;
        tempStreak = 0;
      }
    }


    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { readingGoal: true }
    });

    const yearlyGoal = user?.readingGoal || 12;
    const booksCompletedThisYear = await prisma.book.count({
      where: {
        userId,
        status: 'COMPLETED',
        dateFinished: {
          gte: new Date(now.getFullYear(), 0, 1),
          lte: new Date(now.getFullYear(), 11, 31)
        }
      }
    });

    const yearlyProgress = (booksCompletedThisYear / yearlyGoal) * 100;

    res.json({
      totalBooks,
      booksCompleted: completedInTimeframe,
      pagesRead: totalPages,
      readingTime: Math.round(totalMinutes / 60), 
      readingStreak: currentStreak,
      longestStreak,
      avgPagesPerDay,
      avgSessionTime,
      completionRate: totalBooks > 0 ? Math.round((booksCompleted / totalBooks) * 100) : 0,
      yearlyGoal,
      booksCompletedThisYear,
      yearlyProgress: Math.min(yearlyProgress, 100),
      monthlyProgress: Math.min((booksCompletedThisYear / yearlyGoal) * 100 * 12 / (now.getMonth() + 1), 100)
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});


router.get('/reading-progress', authenticateToken, async (req, res) => {
  try {
    const { timeframe = 'year' } = req.query;
    const userId = req.userId;

    const now = new Date();
    let startDate, groupBy;

    switch (timeframe) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        groupBy = 'day';
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        groupBy = 'week';
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        groupBy = 'month';
        break;
      default:
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        groupBy = 'month';
    }

    const completedBooks = await prisma.book.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        dateFinished: { gte: startDate }
      },
      select: { dateFinished: true }
    });


    const progressData = [];
    const periods = groupBy === 'day' ? 30 : groupBy === 'week' ? 12 : 12;

    for (let i = 0; i < periods; i++) {
      let periodStart, periodEnd, periodLabel;

      if (groupBy === 'day') {
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - i);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 1);
        periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (groupBy === 'week') {
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - (i * 7));
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 7);
        periodLabel = `Week ${Math.ceil((now - periodStart) / (7 * 24 * 60 * 60 * 1000))}`;
      } else {
        periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short' });
      }

      const booksInPeriod = completedBooks.filter(book => 
        book.dateFinished >= periodStart && book.dateFinished < periodEnd
      ).length;

      progressData.unshift({
        period: periodLabel,
        books: booksInPeriod,
        date: periodStart
      });
    }

    res.json(progressData);

  } catch (error) {
    console.error('Error fetching reading progress:', error);
    res.status(500).json({ error: 'Failed to fetch reading progress' });
  }
});


router.get('/genres', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const books = await prisma.book.findMany({
      where: { userId },
      select: { genre: true }
    });

    const genreCounts = {};
    books.forEach(book => {
      if (book.genre && Array.isArray(book.genre)) {
        book.genre.forEach(genre => {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
      }
    });


    const genreData = Object.entries(genreCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json(genreData);

  } catch (error) {
    console.error('Error fetching genre data:', error);
    res.status(500).json({ error: 'Failed to fetch genre statistics' });
  }
});

export default router;
