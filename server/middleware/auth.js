import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { readRawData, writeRawData } from '../services/jsonDbService.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'expensewise-jwt-secret-key-2026';
const TOKEN_EXPIRY = '7d';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user._id || user.id,
      username: user.username,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function createToken(user = { id: 'default-user', username: 'default-user', email: 'default@expensewise.local' }) {
  return generateToken(user);
}

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    return res.status(401).json({ error: 'Invalid or malformed authentication token' });
  }
}

export async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (mongoose.connection.readyState === 1) {
      const existingUser = await User.findOne({
        $or: [{ username: normalizedUsername }, { email: normalizedEmail }]
      });

      if (existingUser) {
        if (existingUser.username === normalizedUsername) {
          return res.status(409).json({ error: 'Username is already taken' });
        }
        return res.status(409).json({ error: 'Email is already registered' });
      }

      const newUser = await User.create({
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword
      });

      const token = generateToken(newUser);
      return res.status(201).json({
        message: 'Account registered successfully',
        token,
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          currency: newUser.currency
        }
      });
    } else {
      // Offline fallback
      const db = readRawData();
      if (!db.users) db.users = [];

      const existing = db.users.find(
        u => u.username === normalizedUsername || u.email === normalizedEmail
      );
      if (existing) {
        if (existing.username === normalizedUsername) {
          return res.status(409).json({ error: 'Username is already taken' });
        }
        return res.status(409).json({ error: 'Email is already registered' });
      }

      const newUser = {
        _id: 'user_' + Date.now(),
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        currency: 'INR',
        createdAt: new Date().toISOString()
      };
      db.users.push(newUser);
      writeRawData(db);

      const token = generateToken(newUser);
      return res.status(201).json({
        message: 'Account registered successfully',
        token,
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          currency: newUser.currency
        }
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
}

export async function login(req, res) {
  try {
    const { username, email, password } = req.body;
    const identifier = (username || email || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/Email and Password are required' });
    }

    let user = null;

    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({
        $or: [{ username: identifier }, { email: identifier }]
      });
    } else {
      const db = readRawData();
      if (db.users) {
        user = db.users.find(
          u => u.username === identifier || u.email === identifier
        );
      }
    }

    if (!user) {
      // Fallback check against configured APP_PASSWORD for dev convenience
      if (process.env.APP_PASSWORD && password === process.env.APP_PASSWORD) {
        const devUser = { _id: 'dev_user', username: identifier || 'admin', email: 'admin@expensewise.local' };
        return res.json({
          token: generateToken(devUser),
          user: devUser
        });
      }
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = generateToken(user);
    return res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        currency: user.currency || 'INR'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

export async function getCurrentUser(req, res) {
  try {
    const userId = req.userId;
    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(userId).select('-password');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({ user });
    } else {
      const db = readRawData();
      const user = (db.users || []).find(u => u._id === userId);
      if (!user) {
        return res.json({ user: { id: userId, username: req.user.username, email: req.user.email } });
      }
      const { password, ...safeUser } = user;
      return res.json({ user: safeUser });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}

export async function validateUsername(req, res) {
  try {
    const { username } = req.body;
    if (!username || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ valid: false, error: 'Username must contain only letters, numbers, and underscores' });
    }
    const normalized = username.trim().toLowerCase();
    let exists = false;
    if (mongoose.connection.readyState === 1) {
      exists = await User.exists({ username: normalized });
    } else {
      const db = readRawData();
      exists = (db.users || []).some(u => u.username === normalized);
    }
    if (exists) {
      return res.status(409).json({ valid: false, error: 'Username is already taken' });
    }
    return res.json({ valid: true });
  } catch (error) {
    return res.status(500).json({ error: 'Validation error' });
  }
}

export async function validateEmail(req, res) {
  try {
    const { email } = req.body;
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ valid: false, error: 'Invalid email address' });
    }
    const normalized = email.trim().toLowerCase();
    let exists = false;
    if (mongoose.connection.readyState === 1) {
      exists = await User.exists({ email: normalized });
    } else {
      const db = readRawData();
      exists = (db.users || []).some(u => u.email === normalized);
    }
    if (exists) {
      return res.status(409).json({ valid: false, error: 'Email is already in use' });
    }
    return res.json({ valid: true });
  } catch (error) {
    return res.status(500).json({ error: 'Validation error' });
  }
}
