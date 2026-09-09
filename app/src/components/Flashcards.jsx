import React from 'react';
import { useApp } from '../AppContext.jsx';
import {
  CARDS, dueCards as dueCardsFn, cardState, nextIntervalFor,
  dueCustomCards, modulesFor, topicKey
} from '../lib/logic.js';
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

  // Phase 6, step 3: custom cards get their own independent due-queue and
  // reveal state (customCardCurrentId/customCardRevealed), never mixed
  // into the seeded deck's cardIndex/cardRevealed -- same "keep it fully
  // separate from the shipped scheduler" choice made throughout logic.js.
  const customDue = dueCustomCards(s);
  const currentCustomCard = customDue.find(c => c.id === s.customCardCurrentId) || (customDue.length ? customDue[0] : null);
  const customCardRevealed = !!currentCustomCard && s.customCardRevealed;
  const customGradeButtons = currentCustomCard ? [[0, 'Again'], [1, 'Hard'], [2, 'Good'], [3, 'Easy']].map(g => ({
    label: g[1], next: nextIntervalFor(currentCustomCard, g[0]),
    style: { ...chip(g[0] === 2, false), flex: '1 1 90px', display: 'flex', flexDirection: 'column', gap: '2px', padding: '9px 10px' },
    go: () => actions.gradeCustomCard(currentCustomCard.id, g[0])
  })) : [];

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

      <div>
        <h4>Your flashcards</h4>
        <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
        {currentCustomCard && (
          <>
            <div className="card" style={{
              padding: 'var(--space-6)', minHeight: '200px', display: 'flex', flexDirection: 'column',
              justifyContent: 'center', textAlign: 'center', gap: 'var(--space-3)'
            }}>
              <div style={{ fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent-ink)' }}>
                {(currentCustomCard.category || 'Custom') + ' · ' + customDue.length + ' due · ease ' + currentCustomCard.ease.toFixed(2)}
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', lineHeight: 1.2, fontWeight: 400, textWrap: 'pretty' }}>
                {currentCustomCard.front}
              </div>
              {customCardRevealed && (
                <div>
                  <hr className="hr" />
                  <p style={{ margin: 0, fontSize: '14px', textWrap: 'pretty' }}>{currentCustomCard.back}</p>
                </div>
              )}
            </div>
            {customCardRevealed && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                {customGradeButtons.map(g => (
                  <button key={g.label} type="button" onClick={g.go} style={g.style}>
                    <span>{g.label}</span>
                    <span style={{ fontSize: '11px', opacity: .65, fontFeatureSettings: "'tnum'" }}>{g.next}</span>
                  </button>
                ))}
              </div>
            )}
            {!customCardRevealed && (
              <button type="button" className="btn btn-primary btn-block" onClick={() => actions.revealCustomCard(currentCustomCard.id)} style={{ marginTop: 'var(--space-3)' }}>
                Reveal answer
              </button>
            )}
          </>
        )}
        {!currentCustomCard && (
          <p style={{ fontSize: '13px', opacity: .6, margin: '0 0 var(--space-4)' }}>
            {s.customCards.length === 0 ? 'No custom flashcards yet — add one below.' : 'Nothing of yours is due right now.'}
          </p>
        )}

        <h4 style={{ marginTop: 'var(--space-6)' }}>Add a flashcard</h4>
        <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div className="field">
            <label>Front</label>
            <input className="input" type="text" value={s.customCardFront} onChange={e => actions.setCustomCardFront(e.target.value)} placeholder="Question or prompt" />
          </div>
          <div className="field">
            <label>Back</label>
            <input className="input" type="text" value={s.customCardBack} onChange={e => actions.setCustomCardBack(e.target.value)} placeholder="Answer" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label>Category</label>
              <input className="input" type="text" value={s.customCardCategory} onChange={e => actions.setCustomCardCategory(e.target.value)} placeholder="e.g. My weak spots" />
            </div>
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label>Link to topic</label>
              <select className="input" value={s.customCardTopicId || ''} onChange={e => actions.setCustomCardTopic(e.target.value)}>
                <option value="">— Not linked —</option>
                {modulesFor(s).map(m => (
                  <optgroup key={m.name} label={m.name}>
                    {m.topics.map(t => (
                      <option key={t[0]} value={topicKey(s.level, m.name, t[0])}>{t[0]}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-primary" onClick={actions.addCustomCard}>Add card</button>
          </div>
        </div>
      </div>

      <div>
        <h4>Manage your flashcards</h4>
        <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
        {s.customCards.length === 0 && <p style={{ fontSize: '13px', opacity: .6, margin: 0 }}>Cards you add appear here.</p>}
        {s.customCards.map(c => (
          <div key={c.id} style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-divider)' }}>
            <input className="input" style={{ flex: '1 1 140px' }} type="text" aria-label="Front" value={c.front} onChange={e => actions.updateCustomCard(c.id, { front: e.target.value })} />
            <input className="input" style={{ flex: '1 1 140px' }} type="text" aria-label="Back" value={c.back} onChange={e => actions.updateCustomCard(c.id, { back: e.target.value })} />
            <input className="input" style={{ flex: '1 1 100px' }} type="text" aria-label="Category" value={c.category} onChange={e => actions.updateCustomCard(c.id, { category: e.target.value })} placeholder="Category" />
            <button type="button" className="btn btn-secondary" onClick={() => actions.deleteCustomCard(c.id)}>Delete</button>
          </div>
        ))}
      </div>
    </section>
  );
}
