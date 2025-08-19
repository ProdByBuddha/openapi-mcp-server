/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: ['index.js', 'cli.js'],
  coverageDirectory: 'coverage',
};

