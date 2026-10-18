// Results of the estimation: global fit with η's reading, the invariance ladder with
// nested tests, and the parameter table as lavaan's summary() prints it.
import type { ReactNode } from 'react';
import { Eta } from '../eta/Eta.tsx';
import type { FitError, Fitted } from '../math/sem.ts';
import { chisqP } from '../math/stats.ts';
import { CUTOFF_TEXT, CUTOFFS, light } from '../math/cutoffs.ts';
import type { Diagram } from '../model/diagram.ts';
import { LEVELS, type Level } from '../model/invariance.ts';
import { fmtNum } from './Canvas.tsx';
import type { ProbeRow } from './estimate.worker.ts';

export interface Estimation { main: Fitted | FitError; rungs: (Fitted | FitError)[] | null; ms: number }
const TITLE: Record<Level, string> = { configural: 'Configural', metric: 'Metric', scalar: 'Scalar', strict: 'Strict' };

const p3 = (p: number) => (!Number.isFinite(p) ? '–' : p < .001 ? '<.001' : p.toFixed(3).replace(/^0/, ''));
/** Traffic light for the usual cut-offs (Hu & Bentler, 1999). */


export function verdict(f: Fitted) {
  const poor = (['cfi', 'rmsea', 'srmr'] as const).filter(k => light(k, f[k]) === 'poor');
  const good = (['cfi', 'rmsea', 'srmr'] as const).every(k => light(k, f[k]) === 'good');
  if (f.df === 0) return 'The model uses every fact in the data: it reproduces them exactly, so fit cannot be judged.';
  if (good) return f.pvalue < .05 ? 'Close fit by every index. The χ² test still rejects exact fit — with this many respondents, even tiny misfit becomes “significant”.' : 'The model fits well: the χ² test does not reject it, and every index is in the good range.';
  if (poor.length) return `Fit is weak (${poor.map(k => k.toUpperCase()).join(', ')}). Look at the largest residual correlations and at items that load on more than they should — but change the model only for a reason you can defend.`;
  return 'Acceptable fit: the indices are in the grey zone between good and poor. Check where the misfit sits before trusting the numbers.';
}

const KIND_WORD: Partial<Record<Level, string>> = { metric: 'loading', scalar: 'intercept', strict: 'residual variance' };

export function ResultsPanel({ est, d, group, setGroup, std, setStd, groupLabels, level, hasData, probe, probing, onProbe, onRelease, children }: {
  est: Estimation | null; d: Diagram; group: number; setGroup: (g: number) => void; std: boolean; setStd: (v: boolean) => void;
  groupLabels: string[]; level: Level; hasData: boolean;
  probe?: ProbeRow[] | null; probing?: boolean; onProbe?: () => void; onRelease?: (key: string) => void;
  children?: ReactNode;
}) {
  if (!hasData) return <p className="hint">Choose data in the <b>Data</b> tab — the course data from the ESS or your own file — and the model is estimated as you draw.</p>;
  if (!est) return <p className="hint">Estimating…</p>;
  const m = est.main;
  if (!m.ok) return (
    <div className="st-eta"><Eta size={64} mood="worried" />
      <p style={{ fontSize: 15 }}>{m.error}{m.missing && <> Not in the data: {m.missing.map(x => <code key={x} style={{ marginRight: 6 }}>{x}</code>)}</>}</p>
    </div>
  );
  const label = (id: string) => d.nodes.find(n => n.id === id)?.label ?? id;
  const rows = m.params.filter(q => q.group === group);
  const sections: [string, (q: typeof rows[number]) => boolean][] = [
    ['Loadings', q => q.op === '=~'], ['Regressions', q => q.op === '~'],
    ['Covariances', q => q.op === '~~' && q.lhs !== q.rhs], ['Intercepts and means', q => q.op === '~1'], ['Variances', q => q.op === '~~' && q.lhs === q.rhs],
  ];
  const rel = (q: typeof rows[number]) => q.op === '=~' ? `${label(q.lhs)} → ${label(q.rhs)}` : q.op === '~' ? `${label(q.rhs)} → ${label(q.lhs)}`
    : q.op === '~1' ? label(q.lhs) : q.lhs === q.rhs ? label(q.lhs) : `${label(q.lhs)} ↔ ${label(q.rhs)}`;
  const rungs = est.rungs;

  return (
    <div className="rp">
      <div className="st-eta"><Eta size={64} mood={(['cfi', 'rmsea', 'srmr'] as const).some(k => light(k, m[k]) === 'poor') ? 'worried' : 'pleased'} />
        <p style={{ fontSize: 15.5 }}>{(() => {
          // with groups, the story is the ladder: up to which rung does the measurement hold?
          if (!est.rungs) return verdict(m);
          const ok = est.rungs.map((r, i) => r.ok && (i === 0 ? r.cfi >= CUTOFFS.cfi.fair : (est.rungs![i - 1].ok && r.cfi - (est.rungs![i - 1] as Fitted).cfi >= -CUTOFFS.deltaCfi)));
          const last = ok.indexOf(false) === -1 ? 3 : ok.indexOf(false) - 1;
          if (last < 0) return 'Even the configural model fits poorly: the factor does not have the same shape in every group. Fix the measurement model first.';
          const allow = ['the same pattern', 'relations (correlations, regression paths)', 'factor means — and the means of sum scores, since every item is invariant', 'the variances and reliabilities of sum scores too'][last];
          return `Invariance holds up to the ${LEVELS[last]} level: across these groups you can compare ${allow}.${last < 3 ? ` The ${LEVELS[last + 1]} step fails.` : ''}`;
        })()}</p></div>
      {!m.converged && <p className="hint" style={{ color: 'var(--neg)' }}>The estimation did not fully converge — treat the numbers with care.</p>}
      {m.heywood.length > 0 && <p className="hint" style={{ color: 'var(--neg)' }}>Negative variance for {m.heywood.map(label).join(', ')} (a Heywood case): the model asks for something the data cannot give.</p>}

      <div className="rp-fit">
        <div><span>χ²({m.df})</span><b>{m.chisq.toFixed(1)}</b><small>p {p3(m.pvalue)}</small></div>
        {(['cfi', 'tli', 'rmsea', 'srmr'] as const).map(k => <div key={k} className={light(k, m[k])}><span>{k.toUpperCase()}</span><b>{fmtNum(m[k], true).replace('–', '0')}</b></div>)}
        <div><span>N</span><b>{m.N.toLocaleString('en')}</b><small>{m.G > 1 ? `${m.G} groups` : 'complete cases'}</small></div>
      </div>
      <p className="hint" style={{ marginTop: 4 }}>Rules of thumb, not laws — {CUTOFF_TEXT}.</p>

      {rungs && (
        <>
          <p className="st-h">The invariance ladder on your data</p>
          <table className="rp-table ladder-table">
            <thead><tr><th>Level</th><th>χ²</th><th>df</th><th>CFI</th><th>RMSEA</th><th>Δχ² (Δdf)</th><th>ΔCFI</th></tr></thead>
            <tbody>
              {rungs.map((r, i) => {
                if (!r.ok) return <tr key={i}><td>{TITLE[LEVELS[i]]}</td><td colSpan={6}>{r.error}</td></tr>;
                const prev = i > 0 ? rungs[i - 1] : null;
                const dch = prev?.ok ? r.chisq - prev.chisq : NaN, ddf = prev?.ok ? r.df - prev.df : NaN;
                const dcfi = prev?.ok ? r.cfi - prev.cfi : NaN;
                return (
                  <tr key={i} className={LEVELS[i] === level ? 'on' : ''}>
                    <td>{TITLE[LEVELS[i]]}</td><td>{r.chisq.toFixed(1)}</td><td>{r.df}</td>
                    <td className={light('cfi', r.cfi)}>{fmtNum(r.cfi, true)}</td><td className={light('rmsea', r.rmsea)}>{fmtNum(r.rmsea, true)}</td>
                    <td>{prev ? <>{dch.toFixed(1)} ({ddf}) <small>p {p3(chisqP(dch, ddf))}</small></> : '–'}</td>
                    <td className={prev ? (dcfi < -0.01 ? 'poor' : 'good') : ''}>{prev ? dcfi.toFixed(3).replace(/^(-?)0\./, '$1.') : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint">A drop in CFI of more than .01 from one level to the next (red) says the added equalities do not hold (Cheung & Rensvold, 2002). The χ² difference test is strict with large samples.</p>
          {(() => {
            const i = LEVELS.indexOf(level), cur = rungs[i], prev = rungs[i - 1];
            if (!KIND_WORD[level] || !cur?.ok || !prev?.ok) return null;
            const breaks = cur.cfi - prev.cfi < -0.01;
            return (
              <div className="rp-probe">
                <p>{breaks
                  ? <>From {TITLE[LEVELS[i - 1]].toLowerCase()} to {level}, CFI drops by {(prev.cfi - cur.cfi).toFixed(3).replace(/^0/, '')}: at least one {KIND_WORD[level]} differs between the groups.</>
                  : <>The {level} equalities hold on these data — no {KIND_WORD[level]} needs to be released.</>}</p>
                {breaks && onProbe && !probe && <button className="btn" onClick={onProbe} disabled={probing}>{probing ? 'Testing each one…' : `Find the ${KIND_WORD[level]} that breaks it`}</button>}
                {probe && probe.length > 0 && (() => {
                  const rows = [...probe].sort((a, b) => a.chisq - b.chisq).slice(0, 6);
                  return (
                    <table className="rp-table">
                      <thead><tr><th>Release one equality</th><th>χ² drops by</th><th>CFI</th><th></th></tr></thead>
                      <tbody>{rows.map((r, k) => (
                        <tr key={r.key} className={k === 0 ? 'on' : ''}>
                          <td><code>{r.partial}</code></td><td>{(cur.chisq - r.chisq).toFixed(1)}</td><td>{fmtNum(r.cfi, true)}</td>
                          <td><button className="tool" onClick={() => onRelease?.(r.key)}>Release</button></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  );
                })()}
                {probe && <p className="hint">Each row re-estimates the {level} model with that single equality freed. Release one at a time, from the top — and only if you can explain why this item works differently across the groups (Byrne, Shavelson & Muthén, 1989).</p>}
              </div>
            );
          })()}
        </>
      )}

      {children}

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
        <p className="st-h" style={{ margin: 0 }}>Estimates</p>
        <div className="row">
          {groupLabels.length > 1 && <select value={group} onChange={e => setGroup(+e.target.value)} aria-label="Group">{groupLabels.map((g, i) => <option key={i} value={i}>{g}</option>)}</select>}
          <span className="seg" role="group" aria-label="Scale">
            <button aria-pressed={std} onClick={() => setStd(true)}>standardized</button>
            <button aria-pressed={!std} onClick={() => setStd(false)}>raw</button>
          </span>
        </div>
      </div>
      {sections.map(([title, f]) => {
        const sec = rows.filter(f);
        if (!sec.length) return null;
        return (
          <table key={title} className="rp-table">
            <thead><tr><th>{title}</th><th>Est.</th><th>SE</th><th>p</th><th>Std.</th></tr></thead>
            <tbody>
              {sec.map((q, i) => (
                <tr key={i} className={q.free && q.p >= .05 ? 'weak' : ''}>
                  <td>{rel(q)}{q.equal && <span className="eq" title="held equal across groups">=</span>}</td>
                  <td>{fmtNum(q.est, false)}</td>
                  <td>{q.free ? fmtNum(q.se, false) : <small>fixed</small>}</td>
                  <td>{q.free ? p3(q.p) : ''}</td>
                  <td>{q.op === '~1' ? '' : fmtNum(q.std, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
      {Object.keys(m.r2[group] ?? {}).length > 0 && (
        <table className="rp-table">
          <thead><tr><th>Explained variance</th><th>R²</th></tr></thead>
          <tbody>{Object.entries(m.r2[group]).map(([id, v]) => <tr key={id}><td>{label(id)}</td><td>{fmtNum(v, true)}</td></tr>)}</tbody>
        </table>
      )}
      <p className="hint">Maximum likelihood, standard errors from the expected information — the defaults of lavaan’s <code>sem()</code>. Checked against lavaan on the course data. {est.ms < 1000 ? `Estimated in ${Math.max(1, Math.round(est.ms))} ms.` : ''}</p>
    </div>
  );
}
