import React from 'react';
import { AppProvider, useApp } from './AppContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import QuoteBar from './components/QuoteBar.jsx';
import Dashboard from './components/Dashboard.jsx';
import StudySessions from './components/StudySessions.jsx';
import Syllabus from './components/Syllabus.jsx';
import TasksView from './components/TasksView.jsx';
import Quiz from './components/Quiz.jsx';
import Flashcards from './components/Flashcards.jsx';
import Notes from './components/Notes.jsx';
import Badges from './components/Badges.jsx';
import MigrationBanner from './components/MigrationBanner.jsx';

const VIEW_COMPONENTS = {
  dash: Dashboard,
  study: StudySessions,
  syllabus: Syllabus,
  tasks: TasksView,
  quiz: Quiz,
  cards: Flashcards,
  notes: Notes,
  badges: Badges
};

function Shell() {
  const { state } = useApp();
  const ViewComponent = VIEW_COMPONENTS[state.view] || Dashboard;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
      <Sidebar />
      <main style={{ flex: '1 1 560px', minWidth: '320px', padding: 'var(--space-6) var(--space-8)', maxWidth: '1180px' }}>
        <Header />
        <QuoteBar />
        <ViewComponent />
      </main>
      <MigrationBanner />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
