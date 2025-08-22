const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Share a file or folder via link
router.post('/link', authMiddleware, async (req, res) => {
  const { resource_id, resource_type, role } = req.body;
  const userId = req.user.id;

  if (!['file', 'folder'].includes(resource_type) || !['viewer', 'editor'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role or resource type' });
  }

  const shared_link = uuidv4();

  const { data, error } = await supabase
    .from('permissions')
    .insert([{ user_id: userId, resource_id, resource_type, role, shared_link }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    message: 'Link generated successfully',
    link: `${process.env.FRONTEND_URL}/share/${shared_link}`,
    permission: data,
  });
});

// Access shared resource by link (public)
router.get('/access/:link', async (req, res) => {
  const { link } = req.params;

  const { data: permission, error } = await supabase
    .from('permissions')
    .select('*')
    .eq('shared_link', link)
    .single();

  if (error || !permission) return res.status(404).json({ error: 'Link not found or expired' });

  let dataQuery;

  if (permission.resource_type === 'file') {
    dataQuery = supabase.from('files').select('*').eq('id', permission.resource_id).single();
  } else {
    dataQuery = supabase.from('folders').select('*').eq('id', permission.resource_id).single();
  }

  const { data, error: dataError } = await dataQuery;

  if (dataError) return res.status(500).json({ error: dataError.message });

  res.json({ resource: data, role: permission.role, resource_type: permission.resource_type });
});

module.exports = router;