require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with anon/public key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY // 🔐 anon/public key (not service role key)
);

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1]; // Expect "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    // Verify token and get user
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Token invalid or expired' });
    }

    req.user = data.user; // Attach user to request
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

module.exports = authMiddleware;