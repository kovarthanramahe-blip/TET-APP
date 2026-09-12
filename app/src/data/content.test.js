import { describe, it, expect } from 'vitest';
import { BANK } from './quizBank.js';
import { CARDS } from './flashcards.js';

// Canonical part values Quiz.jsx's PART_OPTIONS filters against (and the
// only values partForModule()/buildQuiz() know how to match) -- a BANK
// entry with any other `part` string would silently never appear in a
// part-filtered practice/mock quiz.
const VALID_PARTS = ['Child Development & Pedagogy', 'Language I — Hindi', 'Language II — English', 'General Studies', 'Subject'];
const VALID_TYPES = ['mcq', 'tf', 'fib', 'sa'];

describe('quizBank data integrity', () => {
  it('has no duplicate ids', () => {
    const ids = BANK.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every question has a real type and part', () => {
    for (const q of BANK) {
      expect(VALID_TYPES).toContain(q.type);
      expect(VALID_PARTS).toContain(q.part);
      expect(q.q.trim().length).toBeGreaterThan(0);
      expect(q.explain.trim().length).toBeGreaterThan(0);
    }
  });

  it('every mcq/tf question has an in-range answer index into non-empty options', () => {
    for (const q of BANK.filter(x => x.type === 'mcq' || x.type === 'tf')) {
      expect(Array.isArray(q.options)).toBe(true);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(Number.isInteger(q.answer)).toBe(true);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
    }
  });

  it('every tf question offers exactly True/False options', () => {
    for (const q of BANK.filter(x => x.type === 'tf')) {
      expect(q.options).toEqual(['True', 'False']);
    }
  });

  it('every fib/sa question has a non-empty free-text answer', () => {
    for (const q of BANK.filter(x => x.type === 'fib' || x.type === 'sa')) {
      expect(typeof q.answer).toBe('string');
      expect(q.answer.trim().length).toBeGreaterThan(0);
    }
  });

  // Quiz.test.jsx's "fill-in-the-blank button label" tests deliberately
  // hardcode a 2-question pool (see its own comment) so the active
  // question's type is deterministic without controlling buildQuiz()'s
  // shuffle. This pins that assumption here, in the data file itself, so
  // a future change that adds/removes a 'fib' question fails with a clear
  // pointer to Quiz.test.jsx rather than a confusing failure over there.
  it('keeps exactly 2 fib questions, matching what Quiz.test.jsx hardcodes', () => {
    expect(BANK.filter(q => q.type === 'fib')).toHaveLength(2);
  });
});

describe('flashcards (CARDS) data integrity', () => {
  it('every card is a [front, back, category] triple of non-empty strings', () => {
    for (const c of CARDS) {
      expect(c).toHaveLength(3);
      const [front, back, category] = c;
      expect(front.trim().length).toBeGreaterThan(0);
      expect(back.trim().length).toBeGreaterThan(0);
      expect(category.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate front text', () => {
    const fronts = CARDS.map(c => c[0]);
    expect(new Set(fronts).size).toBe(fronts.length);
  });
});
