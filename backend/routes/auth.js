import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import authenticateToken from '../middleware/auth.js';

const router = express.Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tokenOptions = {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  issuer: process.env.JWT_ISSUER || 'readinghub-api',
  audience: process.env.JWT_AUDIENCE || 'readinghub-web',
  algorithm: 'HS256'
};

const createToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, tokenOptions);

// Signup
router.post('/signup', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    if (!emailPattern.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'Password must be 8 to 72 bytes long' });
    }
    if (name.length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or fewer' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name: name || null }
    });

    const token = createToken(user.id);
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error('Signup failed:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        location: true,
        website: true,
        readingGoal: true,
        isPublic: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});


router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, avatar, bio, location, website, readingGoal, isPublic } = req.body;

    const parsedGoal = readingGoal === undefined ? undefined : Number(readingGoal);
    if (name !== undefined && (typeof name !== 'string' || name.trim().length > 100)) {
      return res.status(400).json({ error: 'Name must be 100 characters or fewer' });
    }
    if (parsedGoal !== undefined && (!Number.isInteger(parsedGoal) || parsedGoal < 1 || parsedGoal > 1000)) {
      return res.status(400).json({ error: 'Reading goal must be between 1 and 1000' });
    }
    if (website) {
      try {
        const websiteUrl = new URL(String(website));
        if (!['http:', 'https:'].includes(websiteUrl.protocol)) throw new Error('Unsupported protocol');
      } catch (_error) {
        return res.status(400).json({ error: 'Website must be a valid HTTP or HTTPS URL' });
      }
    }
    if (avatar) {
      try {
        const avatarUrl = new URL(String(avatar));
        if (avatarUrl.protocol !== 'https:') throw new Error('Unsupported protocol');
      } catch (_error) {
        return res.status(400).json({ error: 'Avatar must be a valid HTTPS URL' });
      }
    }
    if (isPublic !== undefined && typeof isPublic !== 'boolean') {
      return res.status(400).json({ error: 'Profile visibility must be a boolean' });
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(name !== undefined && { name: name.trim() || null }),
        ...(avatar !== undefined && { avatar: String(avatar).trim().slice(0, 2000) || null }),
        ...(bio !== undefined && { bio: String(bio).trim().slice(0, 1000) || null }),
        ...(location !== undefined && { location: String(location).trim().slice(0, 150) || null }),
        ...(website !== undefined && { website: String(website).trim().slice(0, 500) || null }),
        ...(parsedGoal !== undefined && { readingGoal: parsedGoal }),
        ...(isPublic !== undefined && { isPublic })
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        location: true,
        website: true,
        readingGoal: true,
        isPublic: true,
        createdAt: true
      }
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
