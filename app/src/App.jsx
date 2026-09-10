import React, { lazy, Suspense } from 'react';
import { AppProvider, useApp } from './AppContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import QuoteBar from './components/QuoteBar.jsx';
import MigrationBanner from './components/MigrationBanner.jsx';
import { useStudyReminders } from './hooks/useStudyReminders.js';

// Phase 14: each view is its own chunk, loaded only when actually
// navigated to, rather than all eight shipping in the one entry bundle
// regardless of which view is open. Dashboard is the default view on a
// fresh load too, but still gets its own chunk for the same reason the
// others do -- keeping it out of the shared entry chunk shrinks what has
// to parse/execute before ANY view can render, and Vite/Rollup already
// prioritizes fetching it immediately since it's the first one requested.
const Dashboard = lazy(() => import('./components/Dashboard.jsx'));
const StudySessions = lazy(() => import('./components/StudySessions.jsx'));
const Syllabus = lazy(() => import('./components/Syllabus.jsx'));
const TasksView = lazy(() => import('./components/TasksView.jsx'));
const Quiz = lazy(() => import('./components/Quiz.jsx'));
const Flashcards = lazy(() => import('./components/Flashcards.jsx'));
const Notes = lazy(() => import('./components/Notes.jsx'));
const Badges = lazy(() => import('./components/Badges.jsx'));

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

function ViewFallback() {
  return (
    <div style={{ padding: 'var(--space-8)', textAlign: 'center', opacity: .6, fontSize: '13px' }}>
      Loading…
    </div>
  );
}

function Shell() {
  const { state } = useApp();
  const ViewComponent = VIEW_COMPONENTS[state.view] || Dashboard;
  useStudyReminders(state);

  return (
    <div className="no-print" style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
      <Sidebar />
      <main style={{ flex: '1 1 560px', minWidth: '320px', padding: 'var(--space-6) var(--space-8)', maxWidth: '1180px' }}>
        <Header />
        <QuoteBar />
        <Suspense fallback={<ViewFallback />}>
          <ViewComponent />
        </Suspense>
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
