require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Use ANON key for public auth routes
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Loaded' : 'Missing');

// ✅ Middleware to authenticate Supabase JWT token
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = data.user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Internal authentication error' });
  }
}

// ✅ Signup using Supabase Auth
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and Password required' });
  }

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    const token = data?.session?.access_token;

    if (!token) {
      return res.status(200).json({
        message: 'Signup successful. Please check your email to confirm your account.',
      });
    }

    res.status(200).json({
      message: 'Signup successful',
      token,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// ✅ Login with Supabase Auth
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    const { session, user } = data;

    res.status(200).json({ token: session.access_token, user });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ✅ Logout (handled on frontend)
router.post('/logout', (req, res) => {
  res.status(200).json({ message: 'Logout handled on client by deleting token' });
});

// ✅ Google OAuth Redirect to Supabase hosted page
router.get('/google', (req, res) => {
  const redirectTo = encodeURIComponent(`${process.env.FRONTEND_URL}/oauth-success`);
  const googleUrl = `${process.env.SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
  res.redirect(googleUrl);
});

// Forgot Password - Send reset password email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const redirectTo = `${process.env.FRONTEND_URL}/reset-password`; // Frontend route
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({
      message: 'Password reset email sent. Please check your inbox.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during password reset request' });
  }
});

module.exports = {
  router,
  authenticateToken,
};