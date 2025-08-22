const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Recursive helper to get breadcrumbs
async function getBreadcrumbs(folderId, userId, supabase) {
  const breadcrumbs = [];
  let currentId = folderId;

  while (currentId) {
    const { data: folder, error } = await supabase
      .from('folders')
      .select('id, name, parent_folder_id')
      .eq('id', currentId)
      .eq('user_id', userId)
      .single();

    if (error || !folder) break;

    breadcrumbs.push({ id: folder.id, name: folder.name });
    currentId = folder.parent_folder_id;
  }

  // Reverse to get root -> current folder order
  return breadcrumbs.reverse();
}

// Create folder
router.post('/', authMiddleware, async (req, res) => {
  const { name, parent_folder_id } = req.body;
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('folders')
    .insert([{ name, parent_folder_id, user_id: userId }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Rename folder
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  try {
    const { data, error } = await supabase
      .from('folders')
      .update({ name })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Unexpected error during folder rename:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Soft delete folder
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('folders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Folder moved to trash' });
});

// List folders in a directory
router.get('/', authMiddleware, async (req, res) => {
  const {
    parent_folder_id,
    limit = 20,
    offset = 0,
    sort = 'name',
    order = 'asc'
  } = req.query;
  const userId = req.user.id;

  const folderId = parent_folder_id === 'null' ? null : parent_folder_id;

  const sortMap = {
    name: 'name',
    date: 'created_at'
  };
  const orderDir = order.toLowerCase() === 'desc' ? false : true;
  const sortCol = sortMap[sort.toLowerCase()] || 'name';

  let query = supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order(sortCol, { ascending: orderDir })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (folderId === null) {
    query = query.is('parent_folder_id', null);
  } else {
    query = query.eq('parent_folder_id', folderId);
  }

  const { data, error } = await query;

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Get trashed folders
router.get('/trash', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Get folder details
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) return res.status(404).json({ error: 'Folder not found' });
  res.json(data);
});

// New breadcrumb endpoint
router.get('/:id/breadcrumbs', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const breadcrumbs = await getBreadcrumbs(id, userId, supabase);
    res.json(breadcrumbs);
  } catch (error) {
    console.error('Breadcrumb fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch breadcrumbs' });
  }
});

// Restore a trashed folder
router.post('/:id/restore', authMiddleware, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('folders')
    .update({ deleted_at: null })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!data) {
    return res.status(404).json({ error: 'Folder not found' });
  }

  res.json({ message: 'Folder restored', folder: data });
});

// Permanently delete a folder
router.delete('/:id/permanent', authMiddleware, async (req, res) => {
  const { id } = req.params;

  // Optionally, you might want to check if folder exists before deleting
  const { data: folder, error: folderError } = await supabase
    .from('folders')
    .select('id')
    .eq('id', id)
    .single();

  if (folderError || !folder) {
    return res.status(404).json({ error: folderError?.message || 'Folder not found' });
  }

  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'Folder permanently deleted' });
});

module.exports = router;