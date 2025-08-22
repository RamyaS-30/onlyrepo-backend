const request = require('supertest');
const app = require('../index');
const path = require('path');
const { getAuthToken } = require('./testutils'); // <- Using the helper

jest.setTimeout(30000);

let token;
let sharedLink;

beforeAll(async () => {
  token = await getAuthToken(); // Handles login + fallback registration

  // Upload a file to share
  const upload = await request(app)
    .post('/api/files/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', path.resolve(__dirname, 'dummy.txt'));

  const fileId = upload.body?.file?.id;

  if (!fileId) {
    console.error('❌ Failed to upload file:', upload.body);
    throw new Error('Upload failed, cannot proceed with test.');
  }

  // Share the file
  const share = await request(app)
    .post('/api/share/link')
    .set('Authorization', `Bearer ${token}`)
    .send({ resource_id: fileId, resource_type: 'file', role: 'viewer' });

  if (share.status !== 200 || !share.body?.link) {
    console.error('❌ Failed to generate share link:', share.body);
    throw new Error('Share link generation failed.');
  }

  const urlParts = share.body.link.split('/');
  sharedLink = urlParts[urlParts.length - 1];
});

describe('Share Link Access', () => {
  it('should allow access to shared resource by link', async () => {
    const res = await request(app).get(`/api/share/access/${sharedLink}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('resource');
    expect(res.body).toHaveProperty('role');
  });

  it('should return 404 for invalid link', async () => {
    const res = await request(app).get('/api/share/access/invalid-link-id');

    expect(res.status).toBe(404);
  });
});