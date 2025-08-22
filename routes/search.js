const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// GET /api/search?q=query&limit=10&offset=0&sort=name&order=asc
router.get('/', authMiddleware, async (req, res) => {
  const {
    q,
    limit = 10,
    offset = 0,
    sort = 'name',    // Default sort column
    order = 'asc',    // Default sort order
    folder_id,
  } = req.query;

  const folderId = folder_id === 'null' || folder_id === 'undefined' ? null : folder_id;
  const userId = req.user.id;

  if (!q) return res.status(400).json({ error: 'Query string is required' });

  const searchQuery = `${q.trim()}:*`;

  // Sort maps: folders may not have 'size', so exclude it for folders
  const fileSortMap = {
    name: 'name',
    size: 'size',
    date: 'created_at',
  };

  const folderSortMap = {
    name: 'name',
    date: 'created_at',
  };

  const validOrders = ['asc', 'desc'];

  const sortKey = (sort || '').toLowerCase();
  const sortDir = validOrders.includes((order || '').toLowerCase())
    ? order.toLowerCase()
    : 'asc';

  const fileSortCol = fileSortMap[sortKey] || 'name';
  const folderSortCol = folderSortMap[sortKey] || 'name';

  try {
    // Search files with sort and order
    const { data: files, error: fileError } = await supabase.rpc('search_files', {
      query: searchQuery,
      uid: userId,
      folder_id: folderId,
      lim: parseInt(limit, 10),
      off: parseInt(offset, 10),
      sort_col: fileSortCol,
      sort_dir: sortDir,
    });

    if (fileError) throw fileError;

    // Search folders with sort and order
    const { data: folders, error: folderError } = await supabase.rpc('search_folders', {
      query: searchQuery,
      uid: userId,
      parent_folder_id: folderId,
      lim: parseInt(limit, 10),
      off: parseInt(offset, 10),
      sort_col: folderSortCol,
      sort_dir: sortDir,
    });

    if (folderError) throw folderError;

    res.json({ files, folders });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;