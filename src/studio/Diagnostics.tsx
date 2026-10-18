// Where a model strains, and how two models compare (course day 2–3):
// modification indices with one-click additions, residual correlations, nested comparisons.
import { useState } from 'react';
import type { Eff, Fitted, ModIndex } from '../math/sem.ts';
import { MIN_REASON } from './logbook.ts';
import { chisqP } from '../math/stats.ts';
import type { Diagram } from '../model/diagram.ts';
import type { Snapshot } from '../state.ts';
import { fmtNum } from './Canvas.tsx';
import type { CompareRow } from './estimate.worker.ts';

const p3 = (p: number) => (!Number.isFinite(p) ? '–' : p < .001 ? '<.001' : p.toFixed(3).replace(/^0/, ''));

/** The parameter a modification index talks about, in words, and whether it already exists on the sheet. */
export function describeMI(q: ModIndex, d: Diagram) {
  const node = (id: string) => d.nodes.find(n => n.id === id);
  const L = (id: string) => node(id)?.label ?? id;
  const lat = (id: string) => node(id)?.kind === 'latent';
  if (q.op === '=~') {
    const e = d.edges.find(x => x.from === q.lhs && x.to === q.rhs && x.kind !== 'cov');
    return { text: e ? `Free the fixed loading ${L(q.lhs)} → ${L(q.rhs)}` : `${L(q.rhs)} also measures ${L(q.lhs)}`, kind: e ? 'free' : 'cross-loading', edge: e };
  }
  if (q.op === '~') {
    const e = d.edges.find(x => x.from === q.rhs && x.to === q.lhs && x.kind !== 'cov');
    return { text: e ? `Free the fixed path ${L(q.rhs)} → ${L(q.lhs)}` : `${L(q.rhs)} → ${L(q.lhs)}`, kind: e ? 'free' : 'path', edge: e };
  }
  const e = d.edges.find(x => x.kind === 'cov' && ((x.from === q.lhs && x.to === q.rhs) || (x.from === q.rhs && x.to === q.lhs)));
  const what = lat(q.lhs) && lat(q.rhs) ? 'the factors covary' : lat(q.lhs) || lat(q.rhs) ? 'covary' : 'their residuals covary';
  return { text: e ? `Free the fixed covariance ${L(q.lhs)} ↔ ${L(q.rhs)}` : `${L(q.lhs)} ↔ ${L(q.rhs)}: ${what}`, kind: e ? 'free' : 'covariance', edge: e };
}

/** Adding from a modification index asks for a reason first: a little friction against index fishing. */
export function StrainList({ fit, d, groupLabels, onAdd }: { fit: Fitted; d: Diagram; groupLabels: string[]; onAdd: (q: ModIndex, reason: string) => void }) {
  const [asking, setAsking] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  // markers (first loadings fixed to 1) set a factor's scale; freeing one alone is not a model change
  const rows = fit.mi.filter(q => Number.isFinite(q.mi) && q.mi >= 3.84).filter(q => {
    const desc = describeMI(q, d);
    return !(desc.kind === 'free' && desc.edge && desc.edge.fix === undefined);
  }).slice(0, 8);
  if (!rows.length) return <p className="hint">No single added parameter would improve the fit noticeably (no modification index above 3.84).</p>;
  return (
    <>
      <table className="rp-table mi-table">
        <thead><tr><th>Freeing this would lower χ² by about</th><th>MI</th><th>Std. change</th><th></th></tr></thead>
        <tbody>
          {rows.map((q, i) => {
            const desc = describeMI(q, d);
            return [
              <tr key={i} className={asking === i ? 'on' : ''}>
                <td>{desc.text}{fit.G > 1 && <small> · {groupLabels[q.group]}</small>}</td>
                <td>{q.mi.toFixed(1)}</td>
                <td>{fmtNum(q.sepc, true)}</td>
                <td><button className="tool" aria-expanded={asking === i} onClick={() => { setAsking(asking === i ? null : i); setReason(''); }}>{desc.kind === 'free' ? 'Free' : 'Add'}…</button></td>
              </tr>,
              asking === i && (
                <tr key={`why${i}`} className="mi-why">
                  <td colSpan={4}>
                    <label>Why does this belong in the model? One sentence — it goes into your logbook, the code and the report.
                      <textarea autoFocus rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. both items ask about … in the same wording" />
                    </label>
                    <div className="row">
                      <button className="btn primary" disabled={reason.trim().length < MIN_REASON} onClick={() => { onAdd(q, reason.trim()); setAsking(null); setReason(''); }}>{desc.kind === 'free' ? 'Free it' : 'Add it'} with this reason</button>
                      <button className="tool" onClick={() => setAsking(null)}>Not now</button>
                    </div>
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
      <p className="hint">A modification index estimates how much χ² would drop if this one parameter were freed; “std. change” is how large it would become. Add a parameter only if you can say why it belongs in the model — chasing indices fits the sample, not the theory (MacCallum, Roznowski & Necowitz, 1992). Every addition can be undone.</p>
    </>
  );
}

/** Residual correlations: what the model does not reproduce. Blue: the model overstates, coral: it understates. */
export function ResidualMatrix({ fit, d, group }: { fit: Fitted; d: Diagram; group: number }) {
  const order = fit.residuals.order, R = fit.residuals.groups[group]?.cov;
  if (!R) return null;
  const L = (id: string) => d.nodes.find(n => n.id === id)?.label ?? id;
  const short = (s: string) => (s.length > 8 ? s.slice(0, 7) + '…' : s);
  const big: { a: string; b: string; r: number }[] = [];
  order.forEach((a, i) => order.forEach((b, j) => { if (j < i && Math.abs(R[i][j]) > .1) big.push({ a, b, r: R[i][j] }); }));
  big.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  const bg = (r: number) => {
    const t = Math.min(1, Math.abs(r) / .2);
    return r > 0 ? `rgba(216, 90, 48, ${0.08 + 0.55 * t})` : `rgba(85, 120, 220, ${0.08 + 0.5 * t})`;
  };
  return (
    <>
      <div className="resid-wrap">
        <table className="resid">
          <thead><tr><th />{order.map(v => <th key={v} title={L(v)}><span>{short(L(v))}</span></th>)}</tr></thead>
          <tbody>
            {order.map((a, i) => (
              <tr key={a}>
                <th title={L(a)}>{short(L(a))}</th>
                {order.map((b, j) => j < i
                  ? <td key={b} style={{ background: bg(R[i][j]) }} className={Math.abs(R[i][j]) > .1 ? 'big' : ''} title={`${L(a)} ↔ ${L(b)}: ${fmtNum(R[i][j], true)}`}>{Math.round(R[i][j] * 100)}</td>
                  : <td key={b} className="blank" />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Residual correlations × 100: data minus model. {big.length
        ? <>Above .10 (bold): {big.slice(0, 4).map(x => `${L(x.a)} ↔ ${L(x.b)} (${fmtNum(x.r, true)})`).join(', ')} — the model misses something these items share.</>
        : 'None is above .10 — the model reproduces every correlation closely (Kline, 2023).'}</p>
    </>
  );
}

export function CompareModels({ snapshots, rows, current, currentVars, onKeep, onRestore, onDelete }: {
  snapshots: Snapshot[]; rows: CompareRow[] | null; current: Fitted | null; currentVars: string[];
  onKeep: () => void; onRestore: (id: string) => void; onDelete: (id: string) => void;
}) {
  const same = (vars?: string[]) => !!vars && vars.join('|') === currentVars.join('|');
  const all = rows ?? [];
  const best = (k: 'aic' | 'bic') => {
    const vals = [...all.filter(r => r.ok && same(r.vars)).map(r => r[k]!), ...(current ? [current[k]] : [])];
    return vals.length > 1 ? Math.min(...vals) : NaN;
  };
  const bA = best('aic'), bB = best('bic');
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p className="hint" style={{ margin: 0 }}>Keep a model, change it, and compare: is the extra parameter worth it?</p>
        <button className="tool" onClick={onKeep} disabled={!current}>Keep this model as {String.fromCharCode(65 + snapshots.length)}</button>
      </div>
      {snapshots.length > 0 && current && (
        <table className="rp-table compare-table">
          <thead><tr><th>Model</th><th>χ²</th><th>df</th><th>CFI</th><th>RMSEA</th><th>AIC</th><th>BIC</th><th>Δχ² vs. now</th><th /></tr></thead>
          <tbody>
            {snapshots.map(snap => {
              const r = all.find(x => x.id === snap.id);
              if (!r) return <tr key={snap.id}><td>{snap.name}</td><td colSpan={8}>estimating…</td></tr>;
              if (!r.ok) return <tr key={snap.id}><td>{snap.name}</td><td colSpan={7}>{r.error}</td><td><button className="tool" onClick={() => onDelete(snap.id)}>×</button></td></tr>;
              const comparable = same(r.vars);
              const dch = Math.abs(r.chisq! - current.chisq), ddf = Math.abs(r.df! - current.df);
              return (
                <tr key={snap.id}>
                  <td>{snap.name}</td><td>{r.chisq!.toFixed(1)}</td><td>{r.df}</td><td>{fmtNum(r.cfi!, true)}</td><td>{fmtNum(r.rmsea!, true)}</td>
                  <td className={comparable && r.aic === bA ? 'good' : ''}>{r.aic!.toFixed(0)}</td>
                  <td className={comparable && r.bic === bB ? 'good' : ''}>{r.bic!.toFixed(0)}</td>
                  <td>{!comparable ? <small>other variables</small> : ddf === 0 ? <small>same df</small> : <>{dch.toFixed(1)} ({ddf}) <small>p {p3(chisqP(dch, ddf))}</small></>}</td>
                  <td className="nowrap"><button className="tool" onClick={() => onRestore(snap.id)} title="Put this model back on the sheet (undoable)">Restore</button> <button className="tool" onClick={() => onDelete(snap.id)} aria-label={`Remove ${snap.name}`}>×</button></td>
                </tr>
              );
            })}
            <tr className="on">
              <td>Now</td><td>{current.chisq.toFixed(1)}</td><td>{current.df}</td><td>{fmtNum(current.cfi, true)}</td><td>{fmtNum(current.rmsea, true)}</td>
              <td className={current.aic === bA ? 'good' : ''}>{current.aic.toFixed(0)}</td><td className={current.bic === bB ? 'good' : ''}>{current.bic.toFixed(0)}</td><td /><td />
            </tr>
          </tbody>
        </table>
      )}
      {snapshots.length > 0 && <p className="hint">The χ² difference test is valid only for nested models — one is the other with some parameters fixed or held equal — on the same data. AIC and BIC (green: lowest) also compare non-nested models with the same variables.</p>}
    </>
  );
}

/** Day 7: how each predictor works on each outcome — directly, through each mediator, in total. */
export function EffectsTable({ fit, d, group }: { fit: Fitted; d: Diagram; group: number }) {
  const L = (id: string) => d.nodes.find(n => n.id === id)?.label ?? id;
  const sets = fit.effects.filter(e => e.group === group);
  if (!sets.length) return <p className="hint">No variable reaches another through a mediator yet. Draw a chain X → M → Y to split an effect into direct and indirect parts.</p>;
  const row = (name: string, e: Eff, cls = '') => (
    <tr className={`${cls} ${e.p >= .05 ? 'weak' : ''}`} key={name}>
      <td>{name}</td><td>{fmtNum(e.est, false)}</td><td>{fmtNum(e.se, false)}</td><td>{p3(e.p)}</td><td>{fmtNum(e.std, true)}</td>
    </tr>
  );
  return (
    <>
      {sets.map((s, i) => {
        const share = s.total.est !== 0 && Math.sign(s.indirect.est) === Math.sign(s.total.est) ? s.indirect.est / s.total.est : NaN;
        return (
          <table className="rp-table effects-table" key={i}>
            <thead><tr><th>{L(s.from)} → {L(s.to)}{Number.isFinite(share) && share <= 1 && <small> · {Math.round(share * 100)} % through mediators</small>}</th><th>Est.</th><th>SE</th><th>p</th><th>Std.</th></tr></thead>
            <tbody>
              {s.direct && row('Direct', s.direct)}
              {s.specific.map(sp => row(`via ${sp.path.slice(1, -1).map(L).join(' → ')}`, sp, 'spec'))}
              {s.specific.length > 1 && row('Indirect, all paths', s.indirect)}
              {row('Total', s.total, 'tot')}
            </tbody>
          </table>
        );
      })}
      <p className="hint">Indirect effects are products of paths; their standard errors use the delta method — the multivariate Sobel test, as lavaan’s <code>:=</code>. It assumes the product is normally distributed, which it rarely is in small samples: report bootstrap intervals from R (the lavaan code includes them).</p>
    </>
  );
}

/** Day 5: latent means across groups — comparable only once the intercepts are equal. */
export function LatentMeans({ fit, d, labels, level, itemMeans, scalarDrop }: {
  fit: Fitted; d: Diagram; labels: string[]; level: string;
  itemMeans: (factor: string, g: number) => number;
  scalarDrop?: number;                                   // CFI change from metric to scalar on these data
}) {
  const L = (id: string) => d.nodes.find(n => n.id === id)?.label ?? id;
  if (fit.G < 2) return null;
  const scalar = level === 'scalar' || level === 'strict';
  const lat = [...new Set(fit.params.filter(q => q.op === '~1' && d.nodes.find(n => n.id === q.lhs)?.kind === 'latent').map(q => q.lhs))];
  if (!scalar) return <p className="hint">At the {level} level every factor mean is fixed to 0 in every group — means cannot be compared yet. Climb to the scalar level (equal intercepts) in the Groups tab; lavaan then frees the means in groups 2, 3, … against {labels[0]}.</p>;
  let biggest = { f: '', g: 0, std: 0 };
  return (
    <>
      {scalarDrop !== undefined && scalarDrop < -0.01 && <p className="rp-warn">Careful: equal intercepts do not hold on these data (CFI drops by {Math.abs(scalarDrop).toFixed(3).replace(/^0/, '')} from metric to scalar). Release the intercepts that differ — Results → “Find the intercept that breaks it” — before you read these means.</p>}
      <table className="rp-table">
        <thead><tr><th>Factor mean vs. {labels[0]}</th>{labels.slice(1).map(l => <th key={l}>{l}</th>)}</tr></thead>
        <tbody>
          {lat.map(f => (
            <tr key={f}>
              <td>{L(f)} <small>(items: {fmtNum(itemMeans(f, 0), false)})</small></td>
              {labels.slice(1).map((_, k) => {
                const q = fit.params.find(x => x.group === k + 1 && x.op === '~1' && x.lhs === f);
                if (!q) return <td key={k}>–</td>;
                if (Math.abs(q.std) > Math.abs(biggest.std)) biggest = { f, g: k + 1, std: q.std };
                const obs = itemMeans(f, k + 1) - itemMeans(f, 0);
                return <td key={k} className={q.p < .05 ? '' : 'weak'} title={`raw ${fmtNum(q.est, false)}, SE ${fmtNum(q.se, false)}, p ${p3(q.p)}; item average ${obs >= 0 ? '+' : ''}${fmtNum(obs, false)}`}>
                  <b>{q.std >= 0 ? '+' : ''}{fmtNum(q.std, true)}</b> SD<br /><small>items {obs >= 0 ? '+' : ''}{fmtNum(obs, false)}</small></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {biggest.f && <p className="hint">Largest difference: in {labels[biggest.g]}, {L(biggest.f)} lies {fmtNum(Math.abs(biggest.std), true)} SD {biggest.std > 0 ? 'above' : 'below'} {labels[0]}. “Items” is the plain difference of the item averages — it mixes the factor with every item’s own intercept, which is why it can mislead when invariance fails. These latent means are trustworthy only as far as (partial) scalar invariance holds.</p>}
    </>
  );
}
