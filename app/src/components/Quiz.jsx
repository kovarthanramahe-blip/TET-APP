import React from 'react';
import { useApp } from '../AppContext.jsx';
import { isCorrect, bestScore, quoteFor } from '../lib/logic.js';
import { chip } from '../lib/styleHelpers.js';

const TYPE_OPTIONS = [['mcq', 'Multiple choice'], ['tf', 'True / false'], ['fib', 'Fill in the blank'], ['sa', 'Short answer']];
const PART_OPTIONS = ['Child Development & Pedagogy', 'Language I — Hindi', 'Language II — English', 'General Studies', 'Subject'];
const EXAM_MODES = ['Practice', 'Mock exam'];
const TYPE_LABEL = { mcq: 'multiple choice', tf: 'true / false', fib: 'fill in the blank', sa: 'short answer' };

function mm(secs) {
  secs = Math.max(0, secs);
  return String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
}

export default function Quiz() {
  const { state: s, actions } = useApp();

  if (s.quizStage === 'setup') return <QuizSetup s={s} actions={actions} />;
  if (s.quizStage === 'active') return <QuizActive s={s} actions={actions} />;
  if (s.quizStage === 'result') return <QuizResult s={s} actions={actions} />;
  return null;
}

function QuizSetup({ s, actions }) {
  const attempts = s.attempts.slice(0, 8).map(a => ({ when: a.when, mode: a.mode, score: a.correct + '/' + a.total + ' · ' + a.pct + '%' }));
  const attemptSummary = s.attempts.length
    ? 'Best ' + bestScore(s) + '% · average ' + Math.round(s.attempts.reduce((a, b) => a + b.pct, 0) / s.attempts.length) + '%'
    : 'No attempts yet — the first one sets your baseline.';
  const startLabel = s.quizMode === 'Mock exam' ? 'Begin timed mock exam' : 'Start practice set';
  const quizSetupNote = s.quizMode === 'Mock exam'
    ? 'Mock conditions: one minute per question, answers lock once chosen, no feedback until submission.'
    : 'Practice mode reveals the answer and explanation immediately after each response.';

  return (
    <section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'var(--space-8)', alignItems: 'start' }}>
        <div>
          <h4>Build a test</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-4)' }} />
          <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
            <label>Question types</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {TYPE_OPTIONS.map(t => (
                <button key={t[0]} type="button" aria-pressed={s.quizTypes.includes(t[0])} style={chip(s.quizTypes.includes(t[0]), true)}
                  onClick={() => actions.setQuizTypes(s.quizTypes.includes(t[0]) ? s.quizTypes.filter(x => x !== t[0]) : s.quizTypes.concat([t[0]]))}>
                  {t[1]}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
            <label>Parts of the paper</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {PART_OPTIONS.map(p => (
                <button key={p} type="button" aria-pressed={s.quizParts.includes(p)} style={chip(s.quizParts.includes(p), true)}
                  onClick={() => actions.setQuizParts(s.quizParts.includes(p) ? s.quizParts.filter(x => x !== p) : s.quizParts.concat([p]))}>
                  {p.replace(' & Pedagogy', '')}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
            <label>Mode</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {EXAM_MODES.map(m => (
                <button key={m} type="button" aria-pressed={s.quizMode === m} style={chip(s.quizMode === m, false)} onClick={() => actions.setQuizMode(m)}>{m}</button>
              ))}
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={actions.startQuiz}>{startLabel}</button>
          <p style={{ fontSize: '12px', opacity: .65, marginTop: 'var(--space-3)' }}>{quizSetupNote}</p>
        </div>
        <div>
          <h4>Attempt history</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
          <table className="table" style={{ width: '100%' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Test</th><th style={{ textAlign: 'left' }}>Mode</th><th style={{ textAlign: 'right' }}>Score</th></tr></thead>
            <tbody>
              {attempts.map((a, i) => (
                <tr key={i}><td>{a.when}</td><td style={{ opacity: .7 }}>{a.mode}</td><td style={{ textAlign: 'right', fontFeatureSettings: "'tnum'" }}>{a.score}</td></tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '12px', opacity: .6, marginTop: 'var(--space-3)' }}>{attemptSummary}</p>
        </div>
      </div>
    </section>
  );
}

function QuizActive({ s, actions }) {
  const quiz = s.quiz || [];
  const q = quiz[s.qIndex];
  const ans = s.answers[s.qIndex];
  const isMock = s.quizMode === 'Mock exam';
  const locked = isMock && ans !== undefined;
  const showFb = !isMock && s.revealed && ans !== undefined;

  const qOptions = q && (q.type === 'mcq' || q.type === 'tf') ? q.options.map((o, i) => {
    const picked = ans === i;
    const right = !isMock && s.revealed && i === q.answer;
    const wrong = !isMock && s.revealed && picked && i !== q.answer;
    return {
      key: 'ABCD'[i], text: o, flag: right ? 'correct' : wrong ? 'your pick' : '',
      style: {
        display: 'flex', gap: '10px', alignItems: 'center', width: '100%', cursor: locked ? 'default' : 'pointer',
        padding: '11px 14px', fontFamily: 'var(--font-body)', fontSize: '15px',
        background: right ? 'color-mix(in srgb, #3f7d4e 14%, transparent)' : wrong ? 'color-mix(in srgb, #b3392f 12%, transparent)' : picked ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
        color: 'var(--color-text)',
        border: '1px solid ' + (right ? '#3f7d4e' : wrong ? '#b3392f' : picked ? 'var(--color-accent)' : 'var(--color-divider)'),
        borderRadius: 'var(--radius-md)'
      },
      pick: () => { if (locked) return; actions.pickOption(s.qIndex, i, isMock); }
    };
  }) : [];

  const nextLabel = s.qIndex + 1 >= quiz.length ? 'Submit test'
    : (isMock ? 'Next question' : (s.revealed || !q || q.type === 'fib' || q.type === 'sa' ? 'Next question' : 'Skip'));
  const lockNote = isMock ? 'Answers lock once selected.' : (q && (q.type === 'fib' || q.type === 'sa') ? 'Type an answer, then check it.' : '');

  const nextQuestion = () => {
    if (!isMock && q && (q.type === 'fib' || q.type === 'sa') && !s.revealed && s.answers[s.qIndex] !== undefined) {
      actions.revealTextAnswer();
      return;
    }
    if (s.qIndex + 1 >= quiz.length) actions.submitQuiz();
    else actions.advanceQuestion();
  };

  const feedbackOk = q ? isCorrect(q, ans) : false;

  return (
    <section>
      <div style={{ maxWidth: '780px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '12px', letterSpacing: '.12em', textTransform: 'uppercase', opacity: .65, fontFeatureSettings: "'tnum'" }}>
            Question {s.qIndex + 1} of {quiz.length}{isMock ? ' · mock conditions' : ' · practice'}
          </div>
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: '22px', fontFeatureSettings: "'tnum'",
            color: isMock && s.mockLeft < 60 ? '#b3392f' : 'var(--color-text)',
            animation: isMock && s.mockLeft < 60 ? 'htetPulse 1.2s infinite' : 'none'
          }}>
            {isMock ? mm(s.mockLeft) : 'untimed'}
          </div>
        </div>
        <div style={{ height: '2px', background: 'var(--color-divider)', margin: 'var(--space-3) 0 var(--space-6)' }}>
          <div style={{ width: Math.round(((s.qIndex + 1) / Math.max(1, quiz.length)) * 100) + '%', height: '100%', background: 'var(--color-accent)' }}></div>
        </div>
        <div style={{ fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent-ink)' }}>
          {q ? q.part + ' · ' + TYPE_LABEL[q.type] : ''}
        </div>
        <h3 style={{ margin: 'var(--space-2) 0 var(--space-6)', maxWidth: '60ch', fontWeight: 400, textWrap: 'pretty' }}>{q ? q.q : ''}</h3>

        {q && (q.type === 'mcq' || q.type === 'tf') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {qOptions.map(o => (
              <button key={o.key} type="button" onClick={o.pick} style={o.style}>
                <span style={{ fontFeatureSettings: "'tnum'", opacity: .6, minWidth: '20px' }}>{o.key}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{o.text}</span>
                <span style={{ fontSize: '12px', color: 'var(--accent-ink)' }}>{o.flag}</span>
              </button>
            ))}
          </div>
        )}
        {q && (q.type === 'fib' || q.type === 'sa') && (
          <div className="field" style={{ maxWidth: '520px' }}>
            <label>
              {q.type === 'fib' ? 'Fill the blank' : 'Your answer'}
              <textarea className="input" value={ans === undefined ? '' : String(ans)}
                onChange={e => actions.setTextAnswer(s.qIndex, e.target.value)} placeholder="Type your answer"></textarea>
            </label>
          </div>
        )}

        {showFb && (
          <div style={{
            marginTop: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)',
            borderLeft: '2px solid ' + (feedbackOk ? '#3f7d4e' : '#b3392f'),
            background: 'color-mix(in srgb, var(--color-text) 4%, transparent)'
          }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '17px' }}>{feedbackOk ? 'Correct' : 'Not quite'}</div>
            <p style={{ margin: '6px 0 0', fontSize: '14px' }}>{q.explain}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-6)', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={nextQuestion}>{nextLabel}</button>
          <button type="button" className="btn btn-secondary" onClick={actions.abortQuiz}>Exit test</button>
          <span style={{ fontSize: '12px', opacity: .6, alignSelf: 'center' }}>{lockNote}</span>
        </div>
      </div>
    </section>
  );
}

function QuizResult({ s, actions }) {
  const quiz = s.quiz || [];
  const lastAttempt = s.attempts[0];
  const resCorrect = lastAttempt ? lastAttempt.correct : 0;

  const resByPart = (() => {
    const map = {};
    quiz.forEach((qq, i) => {
      const k = qq.part;
      map[k] = map[k] || { part: k, correct: 0, asked: 0 };
      map[k].asked++;
      if (isCorrect(qq, s.answers[i])) map[k].correct++;
    });
    return Object.keys(map).map(k => ({ part: k, correct: map[k].correct, asked: map[k].asked, pct: Math.round((map[k].correct / map[k].asked) * 100) + '%' }));
  })();

  const resReview = quiz.map((qq, i) => {
    const ok = isCorrect(qq, s.answers[i]);
    const given = s.answers[i];
    const yourText = given === undefined || given === '' ? 'Not answered'
      : (qq.type === 'mcq' || qq.type === 'tf') ? qq.options[given] : String(given);
    return {
      q: (i + 1) + '. ' + qq.q, yours: 'Your answer: ' + yourText,
      right: ok ? '✓ ' + qq.explain : '→ ' + ((qq.type === 'mcq' || qq.type === 'tf') ? qq.options[qq.answer] : qq.answer) + ' — ' + qq.explain,
      style: { padding: 'var(--space-3)', borderLeft: '2px solid ' + (ok ? '#3f7d4e' : '#b3392f'), background: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }
    };
  });

  const resVerdict = lastAttempt
    ? resCorrect + ' of ' + lastAttempt.total + ' correct in ' + lastAttempt.mode.toLowerCase() + ' mode. ' +
      (lastAttempt.pct >= 60 ? 'Above the 60% HTET qualifying line.' : 'Below the 60% qualifying line — target the weakest part below.')
    : '';
  const resQuote = (s.showQuotes ?? true) ? quoteFor(resCorrect + 3) : '';

  return (
    <section>
      <div style={{ maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase', opacity: .6 }}>Score</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '72px', lineHeight: 1, fontWeight: 400, fontFeatureSettings: "'tnum'" }}>
              {(lastAttempt ? lastAttempt.pct : 0) + '%'}
            </div>
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <p style={{ margin: 0, fontSize: '15px' }}>{resVerdict}</p>
            <p style={{ margin: 'var(--space-2) 0 0', fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '17px' }}>{resQuote}</p>
          </div>
        </div>
        <div>
          <h4>Diagnostics by part</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
          <table className="table" style={{ width: '100%' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Part</th><th style={{ textAlign: 'right' }}>Correct</th><th style={{ textAlign: 'right' }}>Asked</th><th style={{ textAlign: 'right' }}>Accuracy</th></tr></thead>
            <tbody>
              {resByPart.map(r => (
                <tr key={r.part}>
                  <td>{r.part}</td>
                  <td style={{ textAlign: 'right', fontFeatureSettings: "'tnum'" }}>{r.correct}</td>
                  <td style={{ textAlign: 'right', fontFeatureSettings: "'tnum'" }}>{r.asked}</td>
                  <td style={{ textAlign: 'right', fontFeatureSettings: "'tnum'" }}>{r.pct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h4>Answer review</h4>
          <hr className="hr" style={{ margin: 'var(--space-2) 0 var(--space-3)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {resReview.map((r, i) => (
              <div key={i} style={r.style}>
                <div style={{ fontSize: '14px' }}>{r.q}</div>
                <div style={{ fontSize: '13px', opacity: .8, marginTop: '4px' }}>{r.yours}</div>
                <div style={{ fontSize: '13px', color: 'var(--accent-ink)', marginTop: '2px' }}>{r.right}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="button" className="btn btn-primary" onClick={actions.backToSetup}>Build another test</button>
        </div>
      </div>
    </section>
  );
}
