import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AppProvider, useApp } from './AppContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import QuoteBar from './components/QuoteBar.jsx';
import MigrationBanner from './components/MigrationBanner.jsx';
import PwaUpdateBanner from './components/PwaUpdateBanner.jsx';
import StorageWarning from './components/StorageWarning.jsx';
import { useStudyReminders } from './hooks/useStudyReminders.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';

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
const Planner = lazy(() => import('./components/Planner.jsx'));
const Quiz = lazy(() => import('./components/Quiz.jsx'));
const Flashcards = lazy(() => import('./components/Flashcards.jsx'));
const Notes = lazy(() => import('./components/Notes.jsx'));
const Badges = lazy(() => import('./components/Badges.jsx'));

const VIEW_COMPONENTS = {
  dash: Dashboard,
  study: StudySessions,
  syllabus: Syllabus,
  tasks: TasksView,
  planner: Planner,
  quiz: Quiz,
  cards: Flashcards,
  notes: Notes,
  badges: Badges
};

function ViewFallback() {
  return (
    <div role="status" style={{ padding: 'var(--space-8)', textAlign: 'center', opacity: .65, fontSize: '13px' }}>
      Loading…
    </div>
  );
}

function Shell() {
  const { state } = useApp();
  const ViewComponent = VIEW_COMPONENTS[state.view] || Dashboard;
  useStudyReminders(state);

  // Phase 27: below the mobile breakpoint, Sidebar becomes an off-canvas
  // drawer (see .app-sidebar in styles.css) instead of the always-visible
  // column it is on desktop -- sidebarOpen/menuBtnRef only ever matter
  // there, since the hamburger button that's the sole way to set
  // sidebarOpen true is itself hidden above the breakpoint.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuBtnRef = useRef(null);

  // Picking a view is the natural "done with the menu" signal on mobile --
  // closing it here means every nav button doubles as its own close
  // action, instead of requiring a second tap on the backdrop.
  useEffect(() => {
    setSidebarOpen(false);
  }, [state.view]);

  const closeSidebar = () => {
    setSidebarOpen(false);
    // Returns focus to the button that opened the drawer -- without this a
    // keyboard user's focus would silently fall back to <body> once the
    // drawer (and everything inside it) leaves the accessibility tree.
    menuBtnRef.current?.focus();
  };

  return (
    <div className="no-print app-shell">
      <div className="mobile-topbar">
        <button
          type="button"
          ref={menuBtnRef}
          className="mobile-menu-btn"
          aria-label="Open menu"
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>
        <span className="mobile-topbar-title">HTET Study Desk</span>
      </div>
      <div
        className={'sidebar-backdrop' + (sidebarOpen ? ' open' : '')}
        onClick={closeSidebar}
        aria-hidden="true"
      ></div>
      <Sidebar open={sidebarOpen} onRequestClose={closeSidebar} />
      <main className="app-main" style={{ flex: '1 1 560px', minWidth: '320px', padding: 'var(--space-6) var(--space-8)', maxWidth: '1180px' }}>
        <Header />
        <QuoteBar />
        {/* Phase 28: keyed by view so navigating away from a broken view
            (via Sidebar, which lives outside this boundary and stays
            usable) remounts a fresh boundary for the next one, rather than
            needing its own explicit reset wiring. */}
        <ErrorBoundary key={state.view}>
          <Suspense fallback={<ViewFallback />}>
            <ViewComponent />
          </Suspense>
        </ErrorBoundary>
      </main>
      <MigrationBanner />
      <PwaUpdateBanner />
      <StorageWarning />
    </div>
  );
}

export default function App() {
  return (
    // Phase 28: a second, outer boundary -- the one around each view above
    // only ever catches errors from inside <main>, so a crash in
    // AppProvider's own hooks, or in Sidebar/Header/QuoteBar, would
    // otherwise still take down the entire app with nothing left standing
    // to navigate away with.
    <ErrorBoundary>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ErrorBoundary>
  );
}
