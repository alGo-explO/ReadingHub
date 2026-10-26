import express from 'express';
import prisma from '../lib/prisma.js';
import authenticateToken from '../middleware/auth.js';
import { searchBooks } from '../services/bookSearchService.js';

const router = express.Router();

const validStatuses = ['TO_READ', 'IN_PROGRESS', 'COMPLETED', 'DNF', 'ON_HOLD'];
const validFormats = ['PHYSICAL', 'EBOOK', 'AUDIOBOOK', 'PDF'];
const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const validSortFields = ['dateAdded', 'dateFinished', 'title', 'author', 'updatedAt'];

const isValidCoverUrl = (value) => {
  if (!value) return true;
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch (_error) {
    return false;
  }
};


router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      search, 
      status, 
      genre, 
      sortBy = 'dateAdded', 
      sortOrder = 'desc', 
      page = 1, 
      limit = 10 
    } = req.query;

    const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'dateAdded';
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
    const skip = (parsedPage - 1) * parsedLimit;

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid book status' });
    }
    

    const where = {
      userId: req.userId,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { author: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(status && { status }),
      ...(genre && { genre: { has: genre } })
    };

    
    const orderBy = {};
    orderBy[safeSortBy] = safeSortOrder;

    const [books, totalCount] = await Promise.all([
      prisma.book.findMany({
        where,
        orderBy,
        skip,
        take: parsedLimit,
      }),
      prisma.book.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / parsedLimit);

    res.json({
      books,
      pagination: {
        currentPage: parsedPage,
        totalPages,
        totalCount,
        hasNext: parsedPage < totalPages,
        hasPrev: parsedPage > 1
      }
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

router.get('/search', authenticateToken, async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 2 || query.length > 200) {
    return res.status(400).json({ error: 'Search query must be between 2 and 200 characters' });
  }

  try {
    const results = await searchBooks(query);
    res.set('Cache-Control', 'private, max-age=300');
    res.json(results);
  } catch (error) {
    console.error('Book search failed:', error.message);
    res.status(502).json({ error: 'Book search is temporarily unavailable. Please try again shortly.' });
  }
});


router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const book = await prisma.book.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json(book);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});


router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      title, 
      author, 
      genre, 
      pages, 
      status = 'TO_READ',
      isbn,
      publisher,
      publishedYear,
      language = 'English',
      description,
      coverImage,
      format = 'PHYSICAL',
      priority = 'MEDIUM'
    } = req.body;

    if (typeof title !== 'string' || !title.trim() || typeof author !== 'string' || !author.trim()) {
      return res.status(400).json({ error: 'Title and author are required' });
    }
    if (title.trim().length > 300 || author.trim().length > 200) {
      return res.status(400).json({ error: 'Title or author is too long' });
    }
    if (!isValidCoverUrl(coverImage)) {
      return res.status(400).json({ error: 'Cover image must be a valid HTTPS URL' });
    }
    if ((description && (typeof description !== 'string' || description.length > 5000)) ||
        (publisher && (typeof publisher !== 'string' || publisher.length > 200)) ||
        (isbn && (typeof isbn !== 'string' || isbn.length > 32)) ||
        (language && (typeof language !== 'string' || language.length > 100))) {
      return res.status(400).json({ error: 'One or more book details exceed the allowed length' });
    }


    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user) {
      return res.status(401).json({ 
        error: 'User session invalid. Please log in again.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    if (!validFormats.includes(format)) {
      return res.status(400).json({ error: `Invalid format. Must be one of: ${validFormats.join(', ')}` });
    }

    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` });
    }


    const parsedPages = pages === undefined || pages === '' ? null : Number(pages);
    const parsedYear = publishedYear === undefined || publishedYear === '' ? null : Number(publishedYear);
    if (parsedPages !== null && (!Number.isInteger(parsedPages) || parsedPages < 1 || parsedPages > 100000)) {
      return res.status(400).json({ error: 'Pages must be a positive whole number' });
    }
    if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 0 || parsedYear > new Date().getFullYear() + 1)) {
      return res.status(400).json({ error: 'Published year is invalid' });
    }

    const bookData = {
      title: title.trim(),
      author: author.trim(),
      genre: Array.isArray(genre) ? genre.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 20) : [],
      pages: parsedPages,
      status,
      userId: req.userId,
      isbn: isbn || null,
      publisher: publisher || null,
      publishedYear: parsedYear,
      language: language || 'English',
      description: description || null,
      coverImage: coverImage || null,
      format,
      priority,
      ...(status === 'IN_PROGRESS' && { dateStarted: new Date() }),
      ...(status === 'COMPLETED' && { 
        dateStarted: new Date(), 
        dateFinished: new Date(),
        currentPage: parsedPages || 0
      })
    };

    const book = await prisma.book.create({
      data: bookData
    });

    res.status(201).json(book);
  } catch (error) {
    console.error('Error creating book:', error);
    

    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A book with this information already exists' });
    }
    
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid reference data provided' });
    }

    res.status(500).json({ 
      error: 'Failed to create book',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, author, genre, pages, status, currentPage, notes, review, rating, isbn, publisher, publishedYear, language, description, coverImage, format, priority } = req.body;

    const existingBook = await prisma.book.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!existingBook) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid book status' });
    }
    if (format !== undefined && !validFormats.includes(format)) {
      return res.status(400).json({ error: 'Invalid book format' });
    }
    if (priority !== undefined && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid book priority' });
    }
    if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.trim().length > 300)) {
      return res.status(400).json({ error: 'Title is invalid' });
    }
    if (author !== undefined && (typeof author !== 'string' || !author.trim() || author.trim().length > 200)) {
      return res.status(400).json({ error: 'Author is invalid' });
    }
    if (coverImage !== undefined && !isValidCoverUrl(coverImage)) {
      return res.status(400).json({ error: 'Cover image must be a valid HTTPS URL' });
    }

    const parsedPages = pages === undefined || pages === '' ? null : Number(pages);
    const parsedCurrentPage = currentPage === undefined ? undefined : Number(currentPage);
    const parsedRating = rating === undefined || rating === '' ? null : Number(rating);
    const parsedYear = publishedYear === undefined || publishedYear === '' ? null : Number(publishedYear);
    if (pages !== undefined && parsedPages !== null && (!Number.isInteger(parsedPages) || parsedPages < 1 || parsedPages > 100000)) {
      return res.status(400).json({ error: 'Pages must be a positive whole number' });
    }
    if (parsedCurrentPage !== undefined && (!Number.isInteger(parsedCurrentPage) || parsedCurrentPage < 0 || (parsedPages || existingBook.pages) && parsedCurrentPage > (parsedPages || existingBook.pages))) {
      return res.status(400).json({ error: 'Current page is invalid' });
    }
    if (rating !== undefined && parsedRating !== null && (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5)) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    if (publishedYear !== undefined && parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 0 || parsedYear > new Date().getFullYear() + 1)) {
      return res.status(400).json({ error: 'Published year is invalid' });
    }


    const updateData = {};
    
  
    if (title !== undefined) updateData.title = title.trim();
    if (author !== undefined) updateData.author = author.trim();
    if (genre !== undefined) updateData.genre = Array.isArray(genre) ? genre.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 20) : [];
    if (pages !== undefined) updateData.pages = parsedPages;
    if (status !== undefined) updateData.status = status;
    if (currentPage !== undefined) updateData.currentPage = parsedCurrentPage;
    if (notes !== undefined) updateData.notes = notes || null;
    if (review !== undefined) updateData.review = review || null;
    if (rating !== undefined) updateData.rating = parsedRating;
    if (isbn !== undefined) updateData.isbn = isbn;
    if (publisher !== undefined) updateData.publisher = publisher;
    if (publishedYear !== undefined) updateData.publishedYear = parsedYear;
    if (language !== undefined) updateData.language = language;
    if (description !== undefined) updateData.description = description;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (format !== undefined) updateData.format = format;
    if (priority !== undefined) updateData.priority = priority;

    
    if (status && status !== existingBook.status) {
      if (status === 'IN_PROGRESS' && existingBook.status === 'TO_READ') {
        updateData.dateStarted = new Date();
      } else if (status === 'COMPLETED') {
        updateData.dateFinished = new Date();
        if (!existingBook.dateStarted) {
          updateData.dateStarted = new Date();
        }

        if (updateData.pages) {
          updateData.currentPage = updateData.pages;
        } else if (existingBook.pages) {
          updateData.currentPage = existingBook.pages;
        }
      } else if (status === 'TO_READ') {
    
        updateData.currentPage = 0;
        updateData.dateStarted = null;
        updateData.dateFinished = null;
      }
    }

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json(book);
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({ error: 'Failed to update book' });
  }
});


router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const book = await prisma.book.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    await prisma.book.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const [totalBooks, completedBooks, inProgressBooks, toReadBooks] = await Promise.all([
      prisma.book.count({ where: { userId: req.userId } }),
      prisma.book.count({ where: { userId: req.userId, status: 'COMPLETED' } }),
      prisma.book.count({ where: { userId: req.userId, status: 'IN_PROGRESS' } }),
      prisma.book.count({ where: { userId: req.userId, status: 'TO_READ' } })
    ]);

    res.json({
      totalBooks,
      completedBooks,
      inProgressBooks,
      toReadBooks
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
