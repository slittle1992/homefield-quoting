// Mock the database pool before any route modules load
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockRelease = jest.fn();

const mockClient = {
  query: jest.fn(),
  release: mockRelease,
};

mockConnect.mockResolvedValue(mockClient);

const mockPool = {
  query: mockQuery,
  connect: mockConnect,
  end: jest.fn(),
};

jest.mock('../src/config/database', () => mockPool);

// Set env vars for tests
process.env.JWT_SECRET = 'test-secret-key';
process.env.DAILY_DROP_LIMIT = '50';
process.env.MAILER_ENABLED = 'false';

module.exports = { mockQuery, mockConnect, mockClient, mockPool, mockRelease };
