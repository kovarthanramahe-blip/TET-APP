import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '../AppContext.jsx';
import Syllabus from './Syllabus.jsx';

beforeEach(() => {
  localStorage.clear();
});

function renderSyllabus() {
  return render(
    <AppProvider>
      <Syllabus />
    </AppProvider>
  );
}

describe('Syllabus custom topics', () => {
  it('renders the add-custom-topic form', () => {
    renderSyllabus();
    expect(screen.getByText('Add a custom topic')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Topic name')).toBeInTheDocument();
  });

  it('adding a topic under an existing module name folds it into that module, tagged Custom', () => {
    renderSyllabus();
    const moduleInput = screen.getByPlaceholderText('e.g. Child Development & Pedagogy');
    fireEvent.change(moduleInput, { target: { value: 'Child Development & Pedagogy' } });
    fireEvent.change(screen.getByPlaceholderText('Topic name'), { target: { value: 'My extra topic' } });
    fireEvent.click(screen.getByText('Add topic'));

    expect(screen.getByText('My extra topic')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
    // Still only one "Child Development & Pedagogy" module card, not a duplicate.
    expect(screen.getAllByText('Child Development & Pedagogy')).toHaveLength(1);
  });

  it('adding a topic under a brand-new module name starts a new "Custom module" card', () => {
    renderSyllabus();
    fireEvent.change(screen.getByPlaceholderText('e.g. Child Development & Pedagogy'), { target: { value: 'My Own Module' } });
    fireEvent.change(screen.getByPlaceholderText('Topic name'), { target: { value: 'Topic X' } });
    fireEvent.click(screen.getByText('Add topic'));

    expect(screen.getByText('My Own Module')).toBeInTheDocument();
    expect(screen.getByText('Custom module')).toBeInTheDocument();
  });

  it('clears the draft fields after a successful add', () => {
    renderSyllabus();
    const moduleInput = screen.getByPlaceholderText('e.g. Child Development & Pedagogy');
    const topicInput = screen.getByPlaceholderText('Topic name');
    fireEvent.change(moduleInput, { target: { value: 'My Own Module' } });
    fireEvent.change(topicInput, { target: { value: 'Topic X' } });
    fireEvent.click(screen.getByText('Add topic'));

    expect(moduleInput.value).toBe('');
    expect(topicInput.value).toBe('');
  });

  it('does nothing when the topic name is left blank', () => {
    renderSyllabus();
    fireEvent.change(screen.getByPlaceholderText('e.g. Child Development & Pedagogy'), { target: { value: 'My Own Module' } });
    fireEvent.click(screen.getByText('Add topic'));
    expect(screen.queryByText('My Own Module')).not.toBeInTheDocument();
  });

  it('a custom topic\'s confidence chip cycles the same way a seeded topic\'s does', () => {
    renderSyllabus();
    fireEvent.change(screen.getByPlaceholderText('e.g. Child Development & Pedagogy'), { target: { value: 'My Own Module' } });
    fireEvent.change(screen.getByPlaceholderText('Topic name'), { target: { value: 'Topic X' } });
    fireEvent.click(screen.getByText('Add topic'));

    const chip = screen.getByRole('button', { name: /Topic X confidence: Untouched/ });
    fireEvent.click(chip);
    expect(screen.getByRole('button', { name: /Topic X confidence: Needs work/ })).toBeInTheDocument();
  });

  it('deleting a custom topic removes it from the syllabus view', () => {
    renderSyllabus();
    fireEvent.change(screen.getByPlaceholderText('e.g. Child Development & Pedagogy'), { target: { value: 'My Own Module' } });
    fireEvent.change(screen.getByPlaceholderText('Topic name'), { target: { value: 'Topic X' } });
    fireEvent.click(screen.getByText('Add topic'));
    expect(screen.getByText('Topic X')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete custom topic Topic X' }));
    expect(screen.queryByText('Topic X')).not.toBeInTheDocument();
    expect(screen.queryByText('My Own Module')).not.toBeInTheDocument();
  });

  it('seeded topics have no delete button, only custom ones do', () => {
    renderSyllabus();
    const seededChip = screen.getAllByRole('button', { name: /confidence: Untouched/ })[0];
    // Its row shouldn't include a "Delete custom topic" button.
    const row = seededChip.closest('div');
    expect(row.querySelector('button[aria-label^="Delete custom topic"]')).toBeNull();
  });
});
