const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/authMiddleware');
const path = require('path');
const { error } = require('console');
const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Multer memory storage to keep file buffer in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // limit files to 50MB
});

// POST /api/files/:id/new-version
router.post('/:id/new-version', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    const userId = req.user.id;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // 1. Fetch current file info
    const { data: currentFile, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !currentFile) {
      return res.status(404).json({ error: fetchError?.message || 'File not found' });
    }

    // 2. Insert current file into file_versions table
    const { error: versionError } = await supabase
      .from('file_versions')
      .insert([{
        file_id: currentFile.id,
        name: currentFile.name,
        size: currentFile.size,
        format: currentFile.format,
        path: currentFile.path
      }]);

    if (versionError) {
      console.error('Version insert error:', versionError);
      return res.status(500).json({ error: versionError.message });
    }

    // 3. Upload new file to Supabase Storage (use a unique path)
    const timestamp = Date.now();
    const newFileName = `${timestamp}_${file.originalname}`;
    const newPath = `${userId}/${newFileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('files')
      .upload(newPath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,  // overwrite if needed
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    // 4. Get public URL for the new file
    const { data: publicUrlData, error: publicUrlError } = supabase.storage
      .from('files')
      .getPublicUrl(newPath);

    if (publicUrlError) {
      return res.status(500).json({ error: publicUrlError.message });
    }

    const publicUrl = publicUrlData.publicUrl;

    // 5. Update original file record with new version info and increment version
    const { data: updatedFile, error: updateError } = await supabase
      .from('files')
      .update({
        name: file.originalname,
        size: file.size,
        format: file.mimetype,
        path: uploadData.path,
        public_url: publicUrl,
        version: currentFile.version + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ message: 'File version uploaded successfully', file: updatedFile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/files/:id/versions
router.get('/:id/versions', authMiddleware, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('file_versions')
    .select('*')
    .eq('file_id', id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

// GET /api/files/versions/:id/download
router.get('/versions/:id/download', authMiddleware, async (req, res) => {
  const versionId = req.params.id;

  // Fetch the file version from Supabase
  const { data: version, error } = await supabase
    .from('file_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (error || !version) {
    return res.status(404).json({ error: 'Version not found' });
  }

  // Use Supabase Storage to create signed URL for download
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('files')
    .createSignedUrl(version.path, 60 * 60); // 1 hour expiration

  if (signedUrlError) {
    return res.status(500).json({ error: signedUrlError.message });
  }

  // Redirect or send the signed URL for client to download
  res.json({ url: signedUrlData.signedUrl });
});

// Get total storage used by the user
router.get('/storage/usage', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('files')
    .select('size')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (error) return res.status(500).json({ error: error.message });

  const totalBytes = data.reduce((sum, file) => sum + file.size, 0);
  const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

  res.json({
    used: totalBytes,
    max: MAX_BYTES,
    percent: (totalBytes / MAX_BYTES) * 100
  });
});


// POST /api/files/upload
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const userId = req.user.id;

    // 🔧 Correctly read folder_id from FormData
    let folderId = req.body.folder_id;
    if (!folderId || folderId === 'undefined' || folderId === 'null' || folderId === '') {
      folderId = null;
    }

    // Generate unique file path
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.originalname}`;
    const storagePath = `${userId}/${fileName}`;

    // Upload file buffer to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('files')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    // Get public URL for the uploaded file
    const { data: publicUrlData, error: publicUrlError } = supabase.storage
      .from('files')
      .getPublicUrl(storagePath);

    if (publicUrlError) {
      return res.status(500).json({ error: publicUrlError.message });
    }

    const publicUrl = publicUrlData.publicUrl;

    // Save file metadata in PostgreSQL
    const { data: insertedFile, error: insertError } = await supabase
      .from('files')
      .insert([
        {
          user_id: userId,
          folder_id: folderId,
          name: file.originalname,
          size: file.size,
          format: file.mimetype,
          path: uploadData.path,
          public_url: publicUrl,
          version: 1,
        },
      ])
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    res.json({ message: 'File uploaded successfully', file: insertedFile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get trashed files and folders
router.get('/trash', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Rename the file (with versioning)
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  // 1. Fetch current file info
  const { data: file, error: fetchError } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !file) {
    return res.status(404).json({ error: fetchError?.message || 'File not found' });
  }

  // 2. Insert current file into versions table
  const { error: versionError } = await supabase
    .from('file_versions')
    .insert([{
      file_id: file.id,
      name: file.name,
      size: file.size,
      format: file.format,
      path: file.path
    }]);

  if (versionError) {
    console.error('Version insert error:', versionError);
    return res.status(500).json({ error: versionError.message });
  }

  // 3. Proceed with the rename
  const { data: updatedFile, error: updateError } = await supabase
    .from('files')
    .update({ 
      name,
      version: file.version + 1
     })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return res.status(400).json({ error: updateError.message });

  res.json(updatedFile);
});

// Soft delete file
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('files')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'File moved to trash' });
});

// List files in folder
router.get('/', authMiddleware, async (req, res) => {
  const {
    folder_id,
    limit = 20,
    offset = 0,
    sort = 'name',
    order = 'asc'
  } = req.query;
  const userId = req.user.id;

  const folderId = folder_id === 'null' ? null : folder_id;

  const sortMap = {
    name: 'name',
    size: 'size',
    date: 'created_at'
  };
  const orderDir = order.toLowerCase() === 'desc' ? false : true; // true = ascending
  const sortCol = sortMap[sort.toLowerCase()] || 'name';

  let query = supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order(sortCol, { ascending: orderDir })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (folderId === null) {
    query = query.is('folder_id', null);
  } else {
    query = query.eq('folder_id', folderId);
  }

  const { data, error } = await query;

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/files/:id/download
router.get('/:id/download', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { data: file, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !file) return res.status(404).json({ error: 'File not found' });

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('files')
    .createSignedUrl(file.path, 60 * 60); // 1 hour

  if (signedUrlError) return res.status(500).json({ error: signedUrlError.message });

  res.json({ url: signedUrlData.signedUrl });
});

// Restore a trashed file
router.post('/:id/restore', authMiddleware, async (req, res) => {
  const { id } = req.params;

  // Update deleted_at to null (restore)
  const { data, error } = await supabase
    .from('files')
    .update({ deleted_at: null })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!data) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.json({ message: 'File restored', file: data });
});

// Permanently delete a file
router.delete('/:id/permanent', authMiddleware, async (req, res) => {
  const { id } = req.params;

  // Get file path first
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('path')
    .eq('id', id)
    .single();

  if (fileError) {
    return res.status(404).json({ error: fileError.message || 'File not found' });
  }

  if (!file || !file.path) {
    return res.status(404).json({ error: 'File path not found' });
  }

  // Remove file from storage
  const { error: storageError } = await supabase.storage
    .from('files')
    .remove([file.path]);

  if (storageError) {
    return res.status(500).json({ error: storageError.message || 'Error deleting file from storage' });
  }

  // Delete record from DB
  const { error: deleteError } = await supabase
    .from('files')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return res.status(500).json({ error: deleteError.message || 'Error deleting file record' });
  }

  res.json({ message: 'File permanently deleted' });
});

module.exports = router;