import '@testing-library/jest-dom';

// Mock fetch globally
global.fetch = jest.fn();

// Mock navigator.sendBeacon
global.navigator.sendBeacon = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock window.location
delete window.location;
window.location = { href: '/', reload: jest.fn() };

// Silence console errors during tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      args[0]?.includes?.('Warning:') ||
      args[0]?.includes?.('Error Boundary caught an error')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
