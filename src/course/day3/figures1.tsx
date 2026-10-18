// Day 3 · the restriction ladder: what each level sets equal, how far apart the items are in
// exactly those parameters (the congeneric estimates against the restricted value), the fit of
// every rung, and the two ways of writing tau-equivalence.
import { useState } from 'react';
import { Tex } from '../../components/ui.tsx';
import { CUTOFFS } from '../../math/cutoffs.ts';
import { f3 } from '../day1/data.ts';
import { LEVEL_NAME, LEVELS, pick, sgn, TRCO_ITEMS, UNIV_ITEMS, type Day3, type Est, type Ladder, type Level } from './data.ts';

const MEANS: Record<Level, string> = {
  congeneric: 'All items measure the same construct — each with its own loading, error variance and intercept.',
  tau: 'Equal loadings: the items have the same relationship to the factor. One unit more of the construct moves every answer by the same amount.',
  parallel: 'Equal loadings and equal error variances: the items are equally reliable — interchangeable as measures.',
  strict: 'Equal loadings, error variances and intercepts: the items are also equally difficult — the same average answer.',
};
const SYNTAX = (items: string[], f: string): Record<Level, string> => ({
  congeneric: `${f} =~ ${items.join(' + ')}`,
  tau: `${f} =~ ${items.map(i => `1*${i}`).join(' + ')}`,
  parallel: `${f} =~ ${items.map(i => `1*${i}`).join(' + ')}\n${items.map(i => `${i} ~~ e*${i}`).join('\n')}`,
  strict: `${f} =~ ${items.map(i => `1*${i}`).join(' + ')}\n${items.map(i => `${i} ~~ e*${i}`).join('\n')}\n${items.map(i => `${i} ~ i*1`).join('\n')}`,
});
const pTxt = (p: number) => (p < 0.001 ? 'p < .001' : `p = ${p.toFixed(3).replace(/^0/, '')}`);

/** One row of dots: the congeneric estimate of each item, and the single value the restriction allows. */
function Strip({ title, values, items, restricted, on, fmt = (v: number) => v.toFixed(2) }: { title: string; values: number[]; items: string[]; restricted: number | null; on: boolean; fmt?: (v: number) => string }) {
  const lo = Math.min(...values, restricted ?? Infinity), hi = Math.max(...values, restricted ?? -Infinity), pad = (hi - lo) * 0.25 || 0.2;
  const X = (v: number) => `${((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100}%`;
  return (
    <div className={`lad-strip ${on ? 'on' : ''}`}>
      <span className="ls-title">{title}{on ? <b> — set equal</b> : <small> — free</small>}</span>
      <div className="ls-track">
        {on && restricted !== null && <i className="ls-eq" style={{ left: X(restricted) }} title={`the one value the restriction allows: ${fmt(restricted)}`} />}
        {values.map((v, k) => <b key={items[k]} className="ls-dot" style={{ left: X(v) }} title={`${items[k]}: ${fmt(v)}`}><em style={{ bottom: k % 2 ? 26 : 13 }}>{items[k]}</em></b>)}
      </div>
      <span className="ls-range">{fmt(Math.min(...values))} … {fmt(Math.max(...values))}{on && restricted !== null ? ` → all ${fmt(restricted)}` : ''}</span>
    </div>
  );
}

export function LadderExplorer({ d, showUniv = false }: { d: Day3; showUniv?: boolean }) {
  const [lv, setLv] = useState<Level>('tau');
  const [which, setWhich] = useState<'TRCO' | 'UNIV'>('TRCO');
  const w = showUniv ? which : 'TRCO';
  const L = w === 'TRCO' ? d.trco : d.univ, items = w === 'TRCO' ? TRCO_ITEMS : UNIV_ITEMS, f = w;
  const means = d.item_means[0];
  const i = LEVELS.indexOf(lv);
  const cong = L.estimates.congeneric, est = L.estimates[lv];
  // loadings in the metric of a standardized factor (lavaan's Std.lv): λ·√ψ — so the congeneric loadings
  // and the one common loading of the restricted models are on the same scale
  const sdCong = Math.sqrt(pick(cong, '~~', f, f)!.est);
  const lam = items.map(it => pick(cong, '=~', f, it)!.est * sdCong);
  const eqLam = i >= 1 ? Math.sqrt(pick(est, '~~', f, f)!.est) : null;
  const th = items.map(it => pick(cong, '~~', it, it)!.est);
  const tau = items.map(it => pick(cong, '~1', it, '')?.est ?? means[it]);
  const eqTh = i >= 2 ? pick(est, '~~', items[0], items[0])!.est : null;
  const eqTau = i >= 3 ? pick(est, '~1', items[0], '')!.est : null;
  const fit = L.fits[lv], prev = i ? L.fits[LEVELS[i - 1]] : null;
  const lrt = i ? L.lrt[LEVELS[i] as 'tau' | 'parallel' | 'strict'] : null;
  const dcfi = prev ? fit['cfi.robust'] - prev['cfi.robust'] : null;
  const saturated = !prev && fit.df === 0;
  return (
    <div className="fig">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {showUniv && <div className="seg" role="group" aria-label="Construct"><button aria-pressed={which === 'TRCO'} onClick={() => setWhich('TRCO')}>tradition/conformity</button><button aria-pressed={which === 'UNIV'} onClick={() => setWhich('UNIV')}>universalism (Your turn)</button></div>}
        <div className="seg wrap" role="group" aria-label="Level of restriction">{LEVELS.map(l => <button key={l} aria-pressed={lv === l} onClick={() => setLv(l)}>{LEVEL_NAME[l]}</button>)}</div>
      </div>
      <p className="lad-means"><b>{LEVEL_NAME[lv]}:</b> {MEANS[lv]}</p>
      <div className="fig-row">
        <div>
          <Strip title="loadings λ (factor standardized)" values={lam} items={items} restricted={eqLam} on={i >= 1} />
          <Strip title="error variances θ" values={th} items={items} restricted={eqTh} on={i >= 2} />
          <Strip title="intercepts τ (≈ item means)" values={tau} items={items} restricted={eqTau} on={i >= 3} />
          <p className="hint">Dots: the congeneric estimates of each item. Line: the one common value the restricted model estimates for all of them. The further the dots are from the line, the more the restriction costs. Loadings are shown with the factor standardized (lavaan’s <code>Std.lv</code>), so that they do not depend on which item is the marker.</p>
        </div>
        <div className="fig-text">
          <pre className="syntax"><code>{SYNTAX(items, f)[lv]}</code></pre>
          <div className={`lad-verdict ${dcfi === null ? '' : dcfi >= -CUTOFFS.deltaCfi ? 'good' : 'poor'}`}>
            <p>χ²<sub>scaled</sub>({fit.df}) = {fit['chisq.scaled'].toFixed(2)}{saturated ? ' — just identified: nothing to test' : <> · CFI {f3(fit['cfi.robust'])} · RMSEA {f3(fit['rmsea.robust'])} · SRMR {f3(fit.srmr)}</>}</p>
            {lrt && dcfi !== null && <p>Against {LEVEL_NAME[LEVELS[i - 1]]}: Δχ²<sub>SB</sub>({lrt.ddf}) = {lrt.dchisq.toFixed(2)}, {pTxt(lrt.p)} · ΔCFI {sgn(dcfi)} — {dcfi >= -CUTOFFS.deltaCfi ? 'the restriction costs little' : 'the restriction costs too much'}.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LadderTable({ L, note }: { L: Ladder; note?: string }) {
  return (
    <div className="fig">
      <table className="rp-table rung-tab">
        <thead><tr><th>model</th><th>χ² scaled (df)</th><th>CFI</th><th>RMSEA</th><th>SRMR</th><th>Δχ²<sub>SB</sub> (Δdf), p</th><th>ΔCFI<br /><small>≥ −.010</small></th></tr></thead>
        <tbody>{LEVELS.map((l, i) => {
          const f = L.fits[l], p = i ? L.fits[LEVELS[i - 1]] : null, lr = i ? L.lrt[l as 'tau' | 'parallel' | 'strict'] : null;
          const d = p ? f['cfi.robust'] - p['cfi.robust'] : null;
          return (
            <tr key={l}>
              <td><b>{LEVEL_NAME[l]}</b></td>
              <td>{f['chisq.scaled'].toFixed(2)} ({f.df})</td><td>{f3(f['cfi.robust'])}</td><td>{f3(f['rmsea.robust'])}</td><td>{f3(f.srmr)}</td>
              <td>{lr ? <>{lr.dchisq.toFixed(2)} ({lr.ddf}), {pTxt(lr.p)}</> : '—'}</td>
              <td className={d === null ? '' : d >= -CUTOFFS.deltaCfi ? 'good' : 'poor'}>{d === null ? '—' : sgn(d)}</td>
            </tr>
          );
        })}</tbody>
      </table>
      {note && <p className="hint">{note}</p>}
    </div>
  );
}

/** Option 1 (all loadings 1, factor variance free) and option 2 (equal labelled loadings, variance 1): the same model. */
export function TwoWaysTau({ d }: { d: Day3 }) {
  const psi = pick(d.trco.estimates.tau, '~~', 'TRCO', 'TRCO')!.est;
  const a = pick(d.trco.tau2_est, '=~', 'TRCO', 'ipmodst')!.est;
  const [opt, setOpt] = useState<1 | 2>(1);
  return (
    <div className="fig">
      <div className="seg" role="group" aria-label="Option"><button aria-pressed={opt === 1} onClick={() => setOpt(1)}>option 1: loadings fixed to 1</button><button aria-pressed={opt === 2} onClick={() => setOpt(2)}>option 2: equal labels, variance 1</button></div>
      <div className="fig-row">
        <pre className="syntax"><code>{opt === 1
          ? `tradition_conformity_tau <- cfa(\n  model = "TRCO =~ 1*ipmodst + 1*imptrad + 1*ipfrule + 1*ipbhprp",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)`
          : `tradition_conformity_tau2 <- cfa(\n  model = "\n    TRCO =~ NA*ipmodst + a*ipmodst + a*imptrad + a*ipfrule + a*ipbhprp\n    TRCO ~~ 1*TRCO\n  ",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)`}</code></pre>
        <div className="fig-text">
          {opt === 1
            ? <p>All four loadings are fixed to 1; the factor variance is estimated: <b>ψ = {psi.toFixed(3)}</b>. The 1s do two jobs at once — they make the loadings equal, and they give the factor its unit.</p>
            : <p>The label <code>a</code> makes the four loadings equal; <code>NA*</code> frees the first one, and <code>TRCO ~~ 1*TRCO</code> gives the factor its unit instead. Estimate: <b>a = {a.toFixed(3)}</b> — and a² = {(a * a).toFixed(3)} = ψ of option 1.</p>}
          <p>Both: χ²<sub>scaled</sub>({d.trco.fits.tau.df}) = {d.trco.fits.tau['chisq.scaled'].toFixed(2)}{d.trco.tau2_same ? ' — identical' : ''}. Identification (the unit) and restriction (the equality) are two different things; option 1 just does both with one number.</p>
          <p className="hint"><Tex>{'\\lambda_i = a \\;\\text{for all } i, \\; \\psi = 1 \\quad\\Leftrightarrow\\quad \\lambda_i = 1, \\; \\psi = a^2'}</Tex></p>
        </div>
      </div>
    </div>
  );
}

export const estOf = (e: Est[], op: string, lhs: string, rhs: string) => pick(e, op, lhs, rhs);
