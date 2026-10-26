import express from 'express';
import prisma from '../lib/prisma.js';
import authenticateToken from '../middleware/auth.js';

const router = express.Router();


router.get('/', authenticateToken, async (req, res) => {
  try {
    const collections = await prisma.collection.findMany({
      where: { userId: req.userId },
      include: {
        _count: {
          select: { books: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(collections);
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// Create new collection
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, color, isPublic } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Collection name is required' });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Collection name must be 100 characters or fewer' });
    }
    if (color && !/^#[0-9a-f]{6}$/i.test(color)) {
      return res.status(400).json({ error: 'Collection color must be a six-digit hex color' });
    }

    const collection = await prisma.collection.create({
      data: {
        name: name.trim(),
        description: typeof description === 'string' ? description.trim().slice(0, 1000) || null : null,
        color: color || '#6366f1',
        isPublic: isPublic === true,
        userId: req.userId
      },
      include: {
        _count: {
          select: { books: true }
        }
      }
    });

    res.status(201).json(collection);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Collection name already exists' });
    }
    console.error('Error creating collection:', error);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// Delete collection
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const collection = await prisma.collection.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    await prisma.collection.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Collection deleted successfully' });
  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

export default router;
