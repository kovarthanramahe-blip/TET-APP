import React from 'react';
import { useApp } from '../AppContext.jsx';
import { quoteFor } from '../lib/logic.js';
import { dayIndex } from '../lib/dates.js';

export default function QuoteBar() {
  const { state } = useApp();
  const showQuoteBar = (state.showQuotes ?? true) && (state.view === 'dash' || state.view === 'study' || state.view === 'badges');
  if (!showQuoteBar) return null;

  return (
    <p style={{
      fontFamily: 'var(--font-heading)', fontSize: '19px', fontStyle: 'italic',
      borderLeft: '2px solid var(--color-accent)', paddingLeft: 'var(--space-3)',
      margin: '0 0 var(--space-6)', maxWidth: '70ch'
    }}>
      {quoteFor(dayIndex())}
    </p>
  );
}
