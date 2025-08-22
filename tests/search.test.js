const request = require('supertest');
const app = require('../index');
const { getAuthToken } = require('./testutils');

let token;

beforeAll(async () => {
  token = await getAuthToken();
  if (!token) {
    throw new Error('Failed to obtain auth token');
  }
});

/**
 * Runs search test with folder_id query param explicitly set (can be null or valid string)
 * @param {string|null} folderId - folder_id to test with; if null, it sends "null" string
 */
async function runSearchWithFolderId(folderId) {
  // folder_id always included, convert null to string 'null' because query params are strings
  const folderIdValue = folderId === null ? 'null' : folderId;

  const query = {
    q: 'Test',
    folder_id: folderIdValue,
  };

  const res = await request(app)
    .get('/api/search')
    .query(query)
    .set('Authorization', `Bearer ${token}`)
    .expect('Content-Type', /json/);

  if (res.status !== 200) {
    console.error(`Search API error response (folder_id=${folderIdValue}):`, res.body);
  }

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('files');
  expect(res.body).toHaveProperty('folders');
  expect(Array.isArray(res.body.files)).toBe(true);
  expect(Array.isArray(res.body.folders)).toBe(true);
}

describe('Search API with folder_id (valid or null)', () => {
  it('should return search results with valid folder_id', async () => {
    await runSearchWithFolderId('00000000-0000-0000-0000-000000000000');
  });

  it('should return search results with folder_id explicitly set to null (string)', async () => {
    await runSearchWithFolderId(null);
  });

  it('should return 400 if query param is missing', async () => {
    const res = await request(app)
      .get('/api/search')
      .query({})  // no q param at all
      .set('Authorization', `Bearer ${token}`)
      .expect('Content-Type', /json/);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});