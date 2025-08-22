require('dotenv').config();
const request = require('supertest');
const app = require('../index');
const creds = require('./test-credentials');

const TEST_EMAIL = creds.email;
const TEST_PASSWORD = creds.password;

const getAuthToken = async () => {
  // Try login first
  let res = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

  if (res.status !== 200) {
    // If login fails, register
    await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    // Then try login again
    res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  }

  if (!res.body?.token) {
    throw new Error(`Login failed. Message: ${res.body?.error || 'No token returned.'}`);
  }

  return res.body.token;
};

module.exports = { getAuthToken };