import { Router, Response } from 'express';
import { Storage } from '../db/storage.js';
import { generateToken, requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Register a new user
router.post('/register', async (req, res) => {
  const { email, password, fullName } = req.body;

  if (!email || !password || !fullName) {
    res.status(400).json({ error: 'All fields (email, password, fullName) are required.' });
    return;
  }

  try {
    const existing = Storage.getUserByEmail(email);
    if (existing) {
      res.status(400).json({ error: 'User with this email already exists.' });
      return;
    }

    const user = await Storage.createUser(email, password, fullName);
    const token = generateToken({ id: user.id, email: user.email, fullName: user.fullName });

    res.status(201).json({ user, token });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Server error during registration.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  try {
    const user = Storage.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Since we store passwordHash, we check using bcrypt
    const bcrypt = await import('bcryptjs');
    const isValid = await bcrypt.default.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    const token = generateToken({ id: user.id, email: user.email, fullName: user.fullName });

    res.json({ user: userWithoutPassword, token });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Server error during login.' });
  }
});

// Get current user profile
router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

export default router;
