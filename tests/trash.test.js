const request = require('supertest');
const path = require('path');
const app = require('../index'); // Adjust if your app entry file is different
const { getAuthToken } = require('./testutils'); // Your auth helper

jest.setTimeout(30000);

describe('Trash API integration tests', () => {
  let token;
  let deletedFileId;
  let deletedFolderId;

  beforeAll(async () => {
    // Get auth token
    token = await getAuthToken();

    // --- Upload a file ---
    const uploadRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', path.resolve(__dirname, 'dummy.txt'));

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.file).toHaveProperty('id');
    deletedFileId = uploadRes.body.file.id;

    // Soft-delete file (move to trash)
    const deleteFileRes = await request(app)
      .delete(`/api/files/${deletedFileId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteFileRes.status).toBe(200);
    expect(deleteFileRes.body.message).toMatch(/moved to trash/i);

    // --- Create a folder ---
    const folderCreateRes = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Folder', parent_folder_id: null });

    expect(folderCreateRes.status).toBe(200);
    expect(folderCreateRes.body).toHaveProperty('id');
    deletedFolderId = folderCreateRes.body.id;

    // Soft-delete folder (move to trash)
    const deleteFolderRes = await request(app)
      .delete(`/api/folders/${deletedFolderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteFolderRes.status).toBe(200);
    expect(deleteFolderRes.body.message).toMatch(/moved to trash/i);
  }, 30000);

  describe('GET /api/files/trash', () => {
    it('should list trashed files', async () => {
      const res = await request(app)
        .get('/api/files/trash')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // trashed file should be present
      const trashedFileIds = res.body.map(file => file.id);
      expect(trashedFileIds).toContain(deletedFileId);
    });
  });

  describe('GET /api/folders/trash', () => {
    it('should list trashed folders', async () => {
      const res = await request(app)
        .get('/api/folders/trash')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // trashed folder should be present
      const trashedFolderIds = res.body.map(folder => folder.id);
      expect(trashedFolderIds).toContain(deletedFolderId);
    });
  });
});