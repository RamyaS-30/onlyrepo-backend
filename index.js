require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// Route imports
const { router: authRoutes } = require('./routes/auth');
const fileRoutes = require('./routes/file');
const folderRoutes = require('./routes/folder');
const shareRoutes = require('./routes/share');
const searchRoutes = require('./routes/search');

// Middleware
const authMiddleware = require('./middleware/authMiddleware');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Should be SERVICE_KEY for server use
const supabase = createClient(supabaseUrl, supabaseKey);

// Health check route
app.get('/', (req, res) => {
  res.send('Only Repo API is running!');
});

// List all users (for debugging – remove or protect in production)
app.get('/users', async (req, res) => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Auth routes
app.use('/api/auth', authRoutes);

// Protected test route
app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({ message: 'You accessed a protected route', user: req.user });
});

// Main feature routes
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/search', searchRoutes);

module.exports = app;