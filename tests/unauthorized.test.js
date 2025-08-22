const request = require('supertest');
const app = require('../index');

jest.setTimeout(30000);

describe('Unauthorized Access', () => {
  it('should reject requests with invalid token', async () => {
    const res = await request(app)
      .get('/api/files')
      .set('Authorization', `Bearer invalid_token`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should reject requests with missing token', async () => {
    const res = await request(app)
      .get('/api/files');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});