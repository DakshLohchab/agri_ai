import { Router } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '@workspace/db';
import { users } from '@workspace/db/schema';
import { eq } from 'drizzle-orm';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET as string;

// Helper to generate app JWT
const generateToken = (userId: number) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

// Sign up with email
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    console.log('Signup attempt:', { email });

    // Check if user already exists
    const existingUsers = await db.select().from(users).where(eq(users.email, email));
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(password, salt);

    // Create user in database
    const newUser = await db.insert(users).values({
      email,
      name: name || email.split('@')[0],
      passwordHash,
    }).returning();

    const appToken = generateToken(newUser[0].id);
    
    console.log('✅ Signup successful for:', email);
    return res.json({
      token: appToken,
      user: {
        id: newUser[0].id,
        email: newUser[0].email,
        name: newUser[0].name,
      },
    });
  } catch (error: any) {
    console.error('❌ Signup error:', {
      message: error.message,
      code: error.code,
    });
    return res.status(400).json({
      error: error.message || 'Sign up failed',
    });
  }
});

// Login with email
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    console.log('Login attempt:', { email });

    // Find user by email
    const appUsers = await db.select().from(users).where(eq(users.email, email));

    if (appUsers.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const appUser = appUsers[0];

    // Verify password
    if (!appUser.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcryptjs.compare(password, appUser.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const appToken = generateToken(appUser.id);

    console.log('✅ Login successful for:', email);
    return res.json({
      token: appToken,
      user: {
        id: appUser.id,
        email: appUser.email,
        name: appUser.name,
      },
    });
  } catch (error: any) {
    console.error('❌ Login error:', {
      message: error.message,
      code: error.code,
    });
    return res.status(401).json({
      error: 'Login failed',
    });
  }
});

// Google OAuth callback (Neon handles the OAuth flow)
router.post('/google-callback', async (req, res) => {
  try {
    const { neonToken, email, name, picture, sub } = req.body;

    if (!neonToken || !email) {
      return res.status(400).json({ error: 'Missing auth data' });
    }

    // Get or create user in our database
    let appUsers = await db.select().from(users).where(eq(users.email, email));

    let appUser;
    if (appUsers.length === 0) {
      const newUser = await db.insert(users).values({
        email,
        name: name || email.split('@')[0],
        picture,
        neonUserId: sub,
      }).returning();
      appUser = newUser[0];
    } else {
      appUser = appUsers[0];
      // Update user profile with picture if available
      if (picture && !appUser.picture) {
        await db.update(users).set({ picture }).where(eq(users.id, appUser.id));
        appUser.picture = picture;
      }
    }

    const appToken = generateToken(appUser.id);

    return res.json({
      token: appToken,
      neonToken,
      user: {
        id: appUser.id,
        email: appUser.email,
        name: appUser.name,
        picture: appUser.picture,
      },
    });
  } catch (error) {
    console.error('Google callback error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const appUsers = await db.select().from(users).where(eq(users.id, decoded.userId));

    if (appUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = appUsers[0];
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout (Neon handles session revocation)
router.post('/logout', async (req, res) => {
  try {
    const neonToken = req.headers.authorization?.split(' ')[1];

    if (neonToken) {
      // Revoke Neon token
      await axios.post(
        `${NEON_AUTH_URL}/logout`,
        {},
        { headers: getNeonAuthHeaders(neonToken) }
      );
    }

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// Helper function to verify token and get user
const getUserFromToken = (token: string) => {
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded.userId;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Update user profile (name, location)
router.patch('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const userId = getUserFromToken(token);
    const { name, location } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const updatedUsers = await db
      .update(users)
      .set({
        name: name.trim(),
        picture: location || undefined, // Using picture field to store location temporarily
      })
      .where(eq(users.id, userId))
      .returning();

    if (updatedUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = updatedUsers[0];
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (error: any) {
    console.error('Profile update error:', error);
    if (error.message === 'Invalid token') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.post('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const userId = getUserFromToken(token);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get user from database
    const appUsers = await db.select().from(users).where(eq(users.id, userId));

    if (appUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = appUsers[0];

    // Verify current password
    if (!user.passwordHash) {
      return res.status(400).json({ error: 'Password reset not available for OAuth users' });
    }

    const isPasswordValid = await bcryptjs.compare(currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and update new password
    const salt = await bcryptjs.genSalt(10);
    const newPasswordHash = await bcryptjs.hash(newPassword, salt);

    await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId));

    console.log('✅ Password changed successfully for user:', user.email);
    return res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    if (error.message === 'Invalid token') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;