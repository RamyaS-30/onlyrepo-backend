const request = require('supertest');
const path = require('path');
const app = require('../index');
const { getAuthToken } = require('./testutils');

jest.setTimeout(30000);

let token;

beforeAll(async () => {
  token = await getAuthToken();
});

describe('File Upload', () => {
  it('should upload a file successfully', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', path.resolve(__dirname, 'dummy.txt'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('file');
    expect(res.body.file).toHaveProperty('id');
  });
});