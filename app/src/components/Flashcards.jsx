import React from 'react';
import { useApp } from '../AppContext.jsx';
import { CARDS, dueCards as dueCardsFn, cardState, nextIntervalFor } from '../lib/logic.js';
import { dayIndex } from '../lib/dates.js';
import { chip } from '../lib/styleHelpers.js';

export default function Flashcards() {
  const { state: s, actions } = useApp();

  const due = dueCardsFn(s);
  const cardIdx = s.cardIndex >= 0 && due.indexOf(s.cardIndex) >= 0 ? s.cardIndex : (due.length ? due[0] : -1);
  const card = cardIdx >= 0 ? CARDS[cardIdx] : null;
  const cs = cardIdx >= 0 ? cardState(s, cardIdx) : null;
  const cardRevealed = !!card && s.cardRevealed;
  const cardHidden = !!card && !s.cardRevealed;

  const gradeButtons = [[0, 'Again'], [1, 'Hard'], [2, 'Good'], [3, 'Easy']].map(g => ({
    label: g[1], next: nextIntervalFor(cs, g[0]),
    style: { ...chip(g[0] === 2, false), flex: '1 1 90px', display: 'flex', flexDirection: 'column', gap: '2px', padding: '9px 10px' },
    go: () => actions.grade(cardIdx, g[0])
  }));

  const srsStats = [
    { label: 'Due now', value: due.length },
    { label: 'Reviews', value: s.reviews },
    { label: 'Cards', value: CARDS.length }
  ];

  const deckRows = CARDS.map((c, i) => {
    const st = cardState(s, i);
    const d = st.due - dayIndex();
    return { front: c[0], ease: st.ease.toFixed(2), due: d <= 0 ? 'now' : d + 'd' };
  });

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 'var(--space-8)', alignItems: 'start' }}>
      <div>
        {card && (
          <>
            <div className="card" style={{
              padding: 'var(--space-8)', minHeight: '280px', display: 'flex', flexDirection: 'column',
              justifyContent: 'center', textAlign: 'center', gap: 'var(--space-4)'
            }}>
              <div style={{ fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent-ink)' }}>
                {card[2] + ' · ' + due.length + ' due · ease ' + cs.ease.toFixed(2)}
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '27px', lineHeight: 1.2, fontWeight: 400, textWrap: 'pretty' }}>
                {card[0]}
              </div>
              {cardRevealed && (
                <div>
                  <hr className="hr" />
                  <p style={{ margin: 0, fontSize: '15px', textWrap: 'pretty' }}>{card[1]}</p>
                </div>
              )}
            </div>
            {cardRevealed && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
                {gradeButtons.map(g => (
                  <button key={g.label} type="button" onClick={g.go} style={g.style}>
                    <span>{g.label}</span>
                    <span style={{ fontSize: '11px', opacity: .65, fontFeatureSettings: "'tnum'" }}>{g.next}</span>
                  </button>
                ))}
              </div>
            )}
            {cardHidden && (
              <button type="button" className="btn btn-primary btn-block" onClick={() => actions.revealCard(cardIdx)} style={{ marginTop: 'var(--space-4)' }}>
                Reveal answer
              </button>
            )}
          </>
        )}
        {!card && (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <h4>Queue cleared</h4>
            <p style={{ margin: 0, opacity: .75 }}>Nothing is due right now. The scheduler will bring these back on their next interval.</p>
            <button type="button" className="btn btn-secondary" onClick={actions.resetSrs} style={{ marginTop: 'var(--space-4)' }}>Reset scheduling</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div>
          <h4>Scheduler</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
          <p style={{ fontSize: '13px', opacity: .8, margin: '0 0 var(--space-3)' }}>
            SM-2 spaced repetition. Each grade updates the card's ease factor and pushes the next review out: 1 day, 3 days, then interval × ease.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-3)' }}>
            {srsStats.map(st => (
              <div key={st.label}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontFeatureSettings: "'tnum'" }}>{st.value}</div>
                <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', opacity: .6 }}>{st.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4>Deck</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
          <table className="table" style={{ width: '100%' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Card</th><th style={{ textAlign: 'right' }}>Ease</th><th style={{ textAlign: 'right' }}>Due in</th></tr></thead>
            <tbody>
              {deckRows.map((d, i) => (
                <tr key={i}>
                  <td style={{ fontSize: '13px' }}>{d.front}</td>
                  <td style={{ textAlign: 'right', fontFeatureSettings: "'tnum'" }}>{d.ease}</td>
                  <td style={{ textAlign: 'right', fontFeatureSettings: "'tnum'" }}>{d.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
