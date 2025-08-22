// backend/jest.config.js
const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname),
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  testEnvironment: 'node',
  verbose: true,
};