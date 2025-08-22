const request = require('supertest');
const path = require('path');
const app = require('../index');
const { getAuthToken } = require('./testutils');

jest.setTimeout(30000);

let token;
let fileId;

beforeAll(async () => {
  token = await getAuthToken();

  // Upload a test file to download
  const uploadRes = await request(app)
    .post('/api/files/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', path.resolve(__dirname, 'dummy.txt'));

  fileId = uploadRes.body.file.id;
});

describe('File Download', () => {
  it('should return a signed URL for downloading the file', async () => {
    const res = await request(app)
      .get(`/api/files/${fileId}/download`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(res.body.url).toMatch(/^https?:\/\/.+/);
  });
});