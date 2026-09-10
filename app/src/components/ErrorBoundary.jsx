import React from 'react';

// Phase 28: React error boundaries have no hook equivalent
// (getDerivedStateFromError/componentDidCatch only exist on class
// components) -- this is the one place in the app that has to be a class
// rather than a function component. Without this, an uncaught render error
// anywhere in the tree unmounts the whole app to a blank white screen with
// no way back short of a manual reload.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // No external error-reporting service exists in this app -- the
    // console is the only place a caught error is surfaced, same as every
    // other failure path here (e.g. cloudData.js's assertNoError()).
    console.error('[ErrorBoundary] caught a render error:', error, info.componentStack);
  }

  reset() {
    this.setState({ hasError: false });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" style={{
        padding: 'var(--space-6)', border: '1px solid var(--danger-ink)', borderRadius: 'var(--radius-md)',
        background: 'color-mix(in srgb, var(--danger-ink) 8%, transparent)', maxWidth: '480px'
      }}>
        <h3 style={{ margin: '0 0 var(--space-2)' }}>Something went wrong</h3>
        <p style={{ margin: '0 0 var(--space-4)', fontSize: '14px', opacity: .85 }}>
          This part of the app hit an unexpected error. Your study data is untouched — try again, or reload the page if that doesn't help.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="button" className="btn btn-primary" onClick={this.reset}>Try again</button>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </div>
    );
  }
}
