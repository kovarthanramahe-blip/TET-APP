import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Vitest's `globals` mode is off (test files import describe/it/etc.
// explicitly), so React Testing Library's own auto-cleanup -- which only
// registers itself when it finds an ambient global afterEach -- never
// kicks in on its own. Without this, component tests in the same file
// would keep piling their rendered trees into the same jsdom document,
// so a later test's query can match an earlier test's leftover markup.
afterEach(() => {
  cleanup();
});
