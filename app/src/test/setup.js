import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom/vitest';

// jest-axe's matcher is jest-style but framework-agnostic underneath --
// Vitest's expect.extend() is jest-compatible, so it registers the same
// way it would in a real Jest project. Global so any test file can just
// call expect(await axe(container)).toHaveNoViolations() without its own
// per-file setup.
expect.extend(toHaveNoViolations);

// Vitest's `globals` mode is off (test files import describe/it/etc.
// explicitly), so React Testing Library's own auto-cleanup -- which only
// registers itself when it finds an ambient global afterEach -- never
// kicks in on its own. Without this, component tests in the same file
// would keep piling their rendered trees into the same jsdom document,
// so a later test's query can match an earlier test's leftover markup.
afterEach(() => {
  cleanup();
});
