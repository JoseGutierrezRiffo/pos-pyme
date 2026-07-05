import '@testing-library/jest-dom/vitest';

// Mock ResizeObserver (not in jsdom)
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Suppress noisy console.error from expected React errors in tests
const originalError = console.error;
console.error = (...args) => {
  const msg = String(args[0]);
  if (msg.includes('not wrapped in act')) return;
  if (msg.includes('Warning: An update to')) return;
  originalError(...args);
};