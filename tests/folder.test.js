const request = require('supertest');
const app = require('../index');
const { getAuthToken } = require('./testutils');

jest.setTimeout(30000);

let token;

beforeAll(async () => {
  token = await getAuthToken();
});

describe('Folder API', () => {
  it('should create a folder', async () => {
    const res = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Folder' });

    if (res.status !== 200) {
      console.error('❌ Folder creation failed:', res.body);
    }

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Folder');
  });
});
