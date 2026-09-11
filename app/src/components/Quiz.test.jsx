import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider, useApp } from '../AppContext.jsx';
import Quiz from './Quiz.jsx';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

// Narrows the quiz builder to fill-in-the-blank only (2 seeded questions --
// see data/quizBank.js) so the active question's type is deterministic
// without needing to control buildQuiz()'s shuffle.
function startFibOnlyPracticeQuiz() {
  render(
    <AppProvider>
      <Quiz />
    </AppProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Multiple choice' }));
  fireEvent.click(screen.getByRole('button', { name: 'True / false' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fill in the blank' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start practice set' }));
}

// The "next" button's label used to always read "Next question" for a
// fib/sa question in Practice mode, regardless of whether the click was
// actually about to check the answer, skip an unanswered question, or
// genuinely advance -- see nextLabel/nextQuestion in Quiz.jsx. These
// assert the label matches nextQuestion()'s real branching at each step.
describe('Quiz: fill-in-the-blank button label tracks what the click will actually do', () => {
  it('reads "Skip" while unanswered, "Check answer" once typed, then "Next question" after checking', () => {
    startFibOnlyPracticeQuiz();

    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: 'some answer' } });
    expect(screen.getByRole('button', { name: 'Check answer' })).toBeInTheDocument();
    // Checking must not itself advance the question -- no feedback yet.
    expect(screen.queryByText('Correct')).not.toBeInTheDocument();
    expect(screen.queryByText('Not quite')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    // Feedback now visible, and the question hasn't advanced.
    expect(screen.getByText(/^Question 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText(/^(Correct|Not quite)$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next question' })).toBeInTheDocument();
  });

  it('advances to the next question, which correctly offers "Submit test" while unanswered on the last question', () => {
    startFibOnlyPracticeQuiz();
    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: 'some answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }));

    expect(screen.getByText(/^Question 2 of 2/)).toBeInTheDocument();
    // Unanswered on the last question -- clicking this literally submits,
    // so the label must say so rather than "Next question"/"Check answer".
    expect(screen.getByRole('button', { name: 'Submit test' })).toBeInTheDocument();
  });
});

function StateDebug() {
  const { state } = useApp();
  return <div data-testid="debug">{JSON.stringify({ customCards: state.customCards })}</div>;
}

// Closes the quiz -> flashcards loop: a missed question, one click away
// from becoming spaced-repetition material, instead of the quiz and the
// SRS deck running as two systems that never talk to each other.
describe('Quiz: "Add missed questions to flashcards" on the result screen', () => {
  it('offers to add every wrong answer, and adds them to customCards on click', () => {
    render(
      <AppProvider>
        <StateDebug />
        <Quiz />
      </AppProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Multiple choice' }));
    fireEvent.click(screen.getByRole('button', { name: 'True / false' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill in the blank' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start practice set' }));

    // Answer both fib questions wrong.
    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: 'definitely wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: 'also wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit test' }));

    const addButton = screen.getByRole('button', { name: 'Add 2 missed questions to flashcards' });
    const before = JSON.parse(screen.getByTestId('debug').textContent).customCards.length;

    fireEvent.click(addButton);

    expect(screen.getByText('Added to your flashcards.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add \d+ missed question/ })).not.toBeInTheDocument();
    const after = JSON.parse(screen.getByTestId('debug').textContent).customCards;
    expect(after.length).toBe(before + 2);
    expect(after.slice(0, 2).map(c => c.front).sort()).toEqual([
      'Change to passive voice: "She writes a letter." → A letter ___ written by her.',
      'The sum of the interior angles of a triangle is ___ degrees.'
    ]);
  });
});
