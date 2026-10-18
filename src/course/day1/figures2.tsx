// Day 1 · the course's figures, made interactive (part 2): assumptions and item statistics,
// identification, the annotated lavaan output, fit, misspecification and the mean structure.
import { useMemo, useState } from 'react';
import { Tex } from '../../components/ui.tsx';
import { chisqP } from '../../math/stats.ts';
import { CUTOFF_SOURCE, CUTOFFS } from '../../math/cutoffs.ts';

const d2 = (v: number) => v.toFixed(2).replace(/^0/, '');
import { f2, f3, loading, type ItemSet } from './data.ts';

const SCALE = ['not like me at all', 'not like me', 'a little like me', 'somewhat like me', 'like me', 'very much like me'];

// ---------------------------------------------------------------- step 4: the data
export function NqRule({ s, q }: { s: ItemSet; q: number }) {
  const ratio = s.n / q;
  return (
    <div className="nq">
      <div><span>n</span><b>{s.n.toLocaleString('en')}</b></div><i>:</i>
      <div><span>q (free parameters, counted in step 5)</span><b>{q}</b></div><i>=</i>
      <div className={ratio >= 20 ? 'ok' : ratio >= 10 ? 'mid' : 'bad'}><span>ratio</span><b>{Math.round(ratio)} : 1</b></div>
      <p>The N:q rule asks for at least 20:1 (or 10:1). {ratio >= 20 ? 'More than enough.' : ratio >= 10 ? 'Acceptable.' : 'Too few cases for this model.'}</p>
    </div>
  );
}

export function ItemHistograms({ s }: { s: ItemSet }) {
  const [normal, setNormal] = useState(true);
  const W = 190, H = 110;
  return (
    <div className="fig">
      <label className="chk"><input type="checkbox" checked={normal} onChange={e => setNormal(e.target.checked)} /> show the normal curve with the same mean and SD</label>
      <div className="hist-grid">
        {s.frq.map(f => {
          const total = f.counts.reduce((a, b) => a + b, 0), top = Math.max(...f.counts) / total;
          const desc = s.describe.find(d => d.Variable === f.item)!;
          const bw = (W - 20) / 6, x = (k: number) => 10 + (k - 0.5) * bw;   // k = 1…6
          const y = (p: number) => H - 18 - (p / (top * 1.15)) * (H - 30);
          const curve = Array.from({ length: 61 }, (_, i) => {
            const v = 0.5 + i * 0.1, dens = Math.exp(-0.5 * ((v - desc.Mean) / desc.SD) ** 2) / (desc.SD * Math.sqrt(2 * Math.PI));
            return `${i ? 'L' : 'M'}${x(v).toFixed(1)} ${y(dens).toFixed(1)}`;
          }).join(' ');
          return (
            <figure key={f.item} className="hist">
              <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${f.item}: answers ${f.counts.join(', ')}; mean ${f2(desc.Mean)}, skewness ${f2(desc.Skewness)}`}>
                {f.counts.map((c, k) => <rect key={k} x={x(k + 1) - bw / 2 + 2} y={y(c / total)} width={bw - 4} height={H - 18 - y(c / total)} rx="2" className="h-bar" />)}
                {normal && <path d={curve} className="h-curve" />}
                <line x1={x(desc.Mean)} x2={x(desc.Mean)} y1="6" y2={H - 18} className="h-mean" />
                {[1, 2, 3, 4, 5, 6].map(k => <text key={k} x={x(k)} y={H - 4} className="f-lbl c sm">{k}</text>)}
              </svg>
              <figcaption><b>{f.item}</b> · M {f2(desc.Mean)} · SD {f2(desc.SD)} · skew {f2(desc.Skewness)} · {f.missing} missing</figcaption>
            </figure>
          );
        })}
      </div>
      <p className="hint">1 = {SCALE[0]} … 6 = {SCALE[5]} (reversed with <code>rec(x, rec = "rev")</code>). All four items lean toward the “important” end, with a longer tail to the left — skewed, not normal. Most answers are 5 (“like me”), except for ipmodst, where 4 is the most frequent.</p>
    </div>
  );
}

export function CorrelationMatrix({ s }: { s: ItemSet }) {
  const r = (a: string, b: string) => s.correlation.find(c => (c.Parameter1 === a && c.Parameter2 === b) || (c.Parameter1 === b && c.Parameter2 === a));
  return (
    <div className="cmat" style={{ gridTemplateColumns: `90px repeat(${s.items.length}, 1fr)` }} role="table">
      <div />{s.items.map(i => <div key={i} className="h">{i}</div>)}
      {s.items.map((a, i) => [
        <div key={`row-${a}`} className="h l">{a}</div>,
        ...s.items.map((b, j) => {
          if (j > i) return <div key={`${a}-${b}`} />;
          if (i === j) return <div key={`${a}-${b}`} className="h">1</div>;
          const c = r(a, b)!;
          return <div key={`${a}-${b}`} className="cell" style={{ background: `rgba(127,119,221,${Math.min(0.85, c.r * 1.8)})` }} title={`95% CI ${f2(c.CI_low)} to ${f2(c.CI_high)}, n = ${c.n_Obs}`}>{f2(c.r)}</div>;
        }),
      ])}
    </div>
  );
}

export function ItemScaleTable({ s }: { s: ItemSet }) {
  const ok = (v: number, lo: number, hi: number) => (v >= lo && v <= hi ? 'good' : 'poor');
  const alphaMatch = /Cronbach's alpha = ([\d.]+)/.exec(s.itemscale_text);
  return (
    <>
      <table className="rp-table">
        <thead><tr><th>Item</th><th>Difficulty</th><th>Discrimination</th><th>α if deleted</th></tr></thead>
        <tbody>{s.itemscale.map(r => (
          <tr key={r.Item}><td>{r.Item}</td><td className={ok(r.Difficulty, 0.2, 0.8)}>{f2(r.Difficulty)}</td><td className={r.Discrimination >= 0.2 ? 'good' : 'poor'}>{f2(r.Discrimination)}</td><td>{f2(r['alpha if deleted'])}</td></tr>
        ))}</tbody>
      </table>
      <p className="hint">Mean inter-item correlation <b className={s.itemscale_alpha && s.itemscale_alpha >= 0.2 && s.itemscale_alpha <= 0.4 ? 'okc' : ''}>{s.itemscale_alpha ? f2(s.itemscale_alpha) : '–'}</b> (satisfactory between .20 and .40){alphaMatch ? <> · Cronbach’s α {alphaMatch[1].replace(/^0/, '')}</> : null}. Green: difficulty between .20 and .80, discrimination of .20 or more. Difficulty is the item mean divided by its maximum (for ipmodst 3.75 / 6 = .63): for value items, how strongly the item is endorsed.</p>
    </>
  );
}

// ---------------------------------------------------------------- step 5: identification
export function Identification({ initial = 4 }: { initial?: number }) {
  const [k, setK] = useState(initial);
  const j = k;
  const p = (j * (j + 1)) / 2, q = (j - 1) + j + 1, df = p - q;
  const verdict = df < 0 ? 'not identified — more unknowns than observations' : df === 0 ? 'just identified (saturated): it reproduces the data perfectly, its fit cannot be tested' : 'overidentified: with df > 0 we can test the fit of the model to the data';
  const names = Array.from({ length: j }, (_, i) => `y${'₁₂₃₄₅₆'[i]}`);
  return (
    <div className="fig">
      <label className="ctl"><span>Items k</span><input type="range" min={2} max={6} step={1} value={k} onChange={e => setK(+e.target.value)} /><output>{k}</output></label>
      <div className="fig-row">
        <div className="covgrid" style={{ gridTemplateColumns: `36px repeat(${j}, 1fr)` }} aria-label={`Covariance matrix with ${p} elements`}>
          <div />{names.map(n => <div key={n} className="h">{n}</div>)}
          {names.map((a, r) => [<div key={a} className="h">{a}</div>, ...names.map((_, c) => <div key={c} className={c > r ? '' : c === r ? 'var' : 'cov'}>{c > r ? '' : c === r ? 'var' : 'cov'}</div>)])}
        </div>
        <div className="fig-text">
          <p className="idrow"><Tex>{`p = k\\,(k+1)/2 = ${j}\\cdot${j + 1}/2 = ${p}`}</Tex></p>
          <p className="idrow"><Tex>{`q = ${j - 1}\\ \\text{loadings} + ${j}\\ \\text{errors} + 1\\ \\text{factor variance} = ${q}`}</Tex></p>
          <p className={`idrow big ${df < 0 ? 'poor' : df === 0 ? 'fair' : 'good'}`}><Tex>{`df = p - q = ${p} - ${q} = ${df}`}</Tex></p>
          <p>→ the model is <b>{verdict}</b>.</p>
        </div>
      </div>
      <p className="hint">p counts the pieces of information (variances and covariances), q the free parameters. With the reference indicator method one loading is fixed to 1.0, so k − 1 loadings are free. Try k = 3: the three-indicator model is exactly identified — the reason a fourth indicator matters.</p>
    </div>
  );
}

// ---------------------------------------------------------------- step 5: the annotated output
const NOTES: { re: RegExp; note: string }[] = [
  { re: /^\s*Estimator\s+ML/, note: 'MLR is ML with robust corrections: the estimates are ML estimates; standard errors and χ² are corrected for non-normal data. That is why there is a “Scaled” column below.' },
  { re: /Number of model parameters\s+\d+/, note: '12, not the 8 of the counting rule: with FIML, lavaan also estimates the 4 item intercepts (step 8). They come with 4 extra observations, the item means — so p = 10 + 4 = 14, q = 8 + 4 = 12, and df = 2 as counted.' },
  { re: /Number of observations\s+\d+\s+\d+/, note: 'FIML uses every respondent who answered at least one item: 1,860 of 1,881. The 21 left out answered none of the four.' },
  { re: /Number of missing patterns/, note: 'Respondents skipped different items: nine different patterns of answered and missing items. FIML uses each pattern’s information.' },
  { re: /^\s*Test Statistic\s+[\d.]+\s+[\d.]+/, note: 'χ² of the model: “Standard” is the plain ML value, “Scaled” the Yuan–Bentler corrected one. With MLR, report the scaled χ² — here 2.39 with 2 df.' },
  { re: /P-value \(Chi-square\)/, note: 'p = .303 for the scaled test: the model is not rejected. With 1,860 respondents that is not self-evident — χ² rejects almost anything in large samples.' },
  { re: /Scaling correction factor\s+[\d.]+$/, note: 'The scaled χ² is the standard χ² divided by this factor (3.181 / 1.333 = 2.387). Factors above 1 mean the data have heavier tails than a normal distribution.' },
  { re: /Robust Comparative Fit Index/, note: 'With MLR, read the robust CFI (and TLI): 1.000 — the model reproduces the correlations far better than a model in which nothing correlates.' },
  { re: /^\s*Robust RMSEA\s/, note: 'Robust RMSEA = .011, 90% CI from .000 to .056: misfit per degree of freedom is tiny.' },
  { re: /^\s*SRMR\s/, note: 'SRMR = .007: the average leftover correlation is below .01.' },
  { re: /Standard errors\s+Sandwich/, note: 'The “sandwich” (Huber–White) standard errors of MLR: robust to non-normality.' },
  { re: /^\s*TRCO =~/, note: 'Latent Variables: the loadings. Estimate is unstandardized — ipmodst is fixed to 1.000 (reference indicator), the others are in its unit. Std.lv is the fixed-factor solution of step 3 (factor variance 1); Std.all is fully standardized, items and factor — read it like a correlation.' },
  { re: /^\s*\.ipmodst\s+3\.754/, note: 'Intercepts: with FIML, lavaan estimates the mean structure automatically. With the latent mean fixed to 0, each intercept is the item’s mean (step 8).' },
  { re: /^\s*\.ipmodst\s+1\.302/, note: 'Variances with a dot are residual (error) variances. All are positive — no Heywood case. Std.all = 1 − R²: ipmodst keeps 78% of its variance as error.' },
  { re: /^\s*TRCO\s+0\.373/, note: 'The variance of the latent variable, ψ = 0.373, in the unit of ipmodst. Std.all is 1 by definition.' },
];

export function AnnotatedOutput({ text }: { text: string }) {
  const [open, setOpen] = useState<number | null>(null);
  // each note belongs to the first line it matches (the baseline model repeats several labels)
  const lines = useMemo(() => {
    const used = new Set<string>();
    return text.split('\n').map(l => {
      const n = NOTES.find(x => x.re.test(l) && !used.has(x.note));
      if (n) used.add(n.note);
      return { l, note: n?.note ?? null };
    });
  }, [text]);
  return (
    <div className="aout">
      <p className="hint" style={{ marginTop: 0 }}>The output of <code>summary()</code> as R prints it. Click a marked line ● for what it means.</p>
      <pre>{lines.map((x, i) => (
        <span key={i} className={`aline ${x.note ? 'has' : ''} ${open === i ? 'open' : ''}`} onClick={() => x.note && setOpen(open === i ? null : i)}>
          {x.note && <b className="adot" aria-hidden="true">●</b>}{x.l}{'\n'}
          {open === i && x.note && <em className="anote">{x.note}{'\n'}</em>}
        </span>
      ))}</pre>
    </div>
  );
}

// ---------------------------------------------------------------- step 6: fit
export function FitTable({ s }: { s: ItemSet }) {
  const f = s.fit, chiDf = f['chisq.scaled'] / f.df;
  const rows = [
    { idx: 'χ²/df', ask: 'How large is χ² for the df the model risks?', type: 'badness', cut: `≤ ${CUTOFFS.chiDf.good} (≤ ${CUTOFFS.chiDf.fair})`, n: 'yes', pen: 'no', v: chiDf, ok: chiDf <= CUTOFFS.chiDf.fair },
    { idx: 'CFI', ask: 'How much better than a model in which nothing correlates?', type: 'goodness', cut: `≥ ${d2(CUTOFFS.cfi.good)} (≥ ${d2(CUTOFFS.cfi.fair)})`, n: 'no', pen: 'no', v: f['cfi.robust'], ok: f['cfi.robust'] >= CUTOFFS.cfi.fair },
    { idx: 'TLI', ask: 'The same, with a penalty for extra parameters', type: 'goodness', cut: `≥ ${d2(CUTOFFS.tli.good)} (≥ ${d2(CUTOFFS.tli.fair)})`, n: 'no', pen: 'yes', v: f['tli.robust'], ok: f['tli.robust'] >= CUTOFFS.tli.fair },
    { idx: 'RMSEA', ask: 'How much misfit per degree of freedom?', type: 'badness', cut: `≤ ${d2(CUTOFFS.rmsea.good)} (≤ ${d2(CUTOFFS.rmsea.fair)})`, n: 'yes, inflated in small samples', pen: 'yes', v: f['rmsea.robust'], ok: f['rmsea.robust'] <= CUTOFFS.rmsea.fair },
    { idx: 'SRMR', ask: 'How large is the average leftover correlation?', type: 'badness', cut: `≤ ${d2(CUTOFFS.srmr.good)} (≤ ${d2(CUTOFFS.srmr.fair)})`, n: 'yes', pen: 'no', v: f.srmr, ok: f.srmr <= CUTOFFS.srmr.fair },
  ];
  return (
    <>
      <table className="rp-table fit-tab">
        <thead><tr><th>Index</th><th>Asks</th><th>Type</th><th>Good (acceptable)</th><th>Depends on N</th><th>Penalty for complexity</th><th>This model</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.idx}><td>{r.idx}</td><td>{r.ask}</td><td>{r.type}</td><td>{r.cut}</td><td>{r.n}</td><td>{r.pen}</td><td className={r.ok ? 'good' : 'poor'}>{r.idx === 'χ²/df' ? r.v.toFixed(2) : f3(r.v)}</td></tr>)}</tbody>
      </table>
      <p className="hint"><b>badness</b>: 0 is perfect, larger is worse · <b>goodness</b>: 1 is perfect · <b>depends on N</b>: the value changes with the sample size alone · <b>penalty</b>: the index gets worse when parameters are added without improving the fit. Cut-offs: {CUTOFF_SOURCE}; χ²/df after the course slides.</p>
    </>
  );
}

export function ChiSquareN({ s }: { s: ItemSet }) {
  const F = s.fit.chisq / (s.n - 1);
  const [n, setN] = useState(s.n);
  const chi = F * (n - 1), p = chisqP(chi, s.fit.df);
  return (
    <div className="fig">
      <p className="hint" style={{ marginTop: 0 }}><b>Try it:</b> move the sample size up. At which n does p drop below .05?</p>
      <label className="ctl"><span>Sample size n</span><input type="range" min={100} max={30000} step={100} value={n} onChange={e => setN(+e.target.value)} /><output>{n.toLocaleString('en')}</output></label>
      <div className="fig-row">
        <div className="fig-text">
          <p className="idrow"><Tex>{`\\chi^2_{ML} = F_{ML}\\,(n-1) = ${F.toFixed(5)} \\times ${(n - 1).toLocaleString('en')} = ${chi.toFixed(1)}`}</Tex></p>
          <p className={`idrow big ${p < 0.05 ? 'poor' : 'good'}`}>p = {p < 0.001 ? '< .001' : f3(p)} → {p < 0.05 ? 'exact fit rejected' : 'exact fit not rejected'}</p>
          <p className="hint">The discrepancy F<sub>ML</sub> between model and data stays the same; only the number of respondents changes. (The widget uses the plain ML χ² of 3.18; lavaan multiplies by N rather than n − 1 — with 1,860 respondents the difference is invisible.) With enough respondents, even this almost perfect model is “significantly” wrong — the χ² trap from step 4.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- step 7: misspecification
export function LoadingBars({ s }: { s: ItemSet }) {
  const lam = loading(s);
  return (
    <div className="lbars">
      {lam.map(l => (
        <div key={l.rhs} className="lbar"><span>{l.rhs}</span><i style={{ width: `${l.std * 100}%` }} className={l.std >= 0.4 ? 'ok' : 'low'} /><b>{f2(l.std)}</b></div>
      ))}
      <div className="lcut" style={{ left: 'calc(90px + (100% - 140px) * .4)' }}><span>.40</span></div>
    </div>
  );
}

const REASONS = ['method effects', 'item wording', 'acquiescence', 'social desirability', 'unaccounted theoretical common causes'];
export function ResidualCorrelation({ s, labels }: { s: ItemSet; labels: Record<string, string> }) {
  const cov = s.mi.filter(m => m.op === '~~');
  const [k, setK] = useState(0);
  const m = cov[k];
  const ia = m ? s.items.indexOf(m.lhs) : -1, ib = m ? s.items.indexOf(m.rhs) : -1;
  const Y = [40, 90, 140, 190];
  const big = (() => { let b = { v: 0, a: '', c: '' }; s.residuals.forEach((row, i) => row.forEach((v, j) => { if (j < i && Math.abs(v) > Math.abs(b.v)) b = { v, a: s.resid_names[i], c: s.resid_names[j] }; })); return b; })();
  return (
    <div className="fig">
      <div className="fig-row">
        <svg viewBox="0 0 420 230" className="fig-svg" role="img" aria-label={m ? `Residual covariance between ${m.lhs} and ${m.rhs}` : 'Residual covariances'}>
          <defs><marker id="d1-arr2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink)" /></marker></defs>
          <ellipse cx="80" cy="115" rx="46" ry="26" className="f-lat" />
          <text x="80" y="121" className="f-sym sm">{s.factor}</text>
          {s.items.map((it, i) => (
            <g key={it} className={i === ia || i === ib ? 'f-item on' : 'f-item'}>
              <line x1="126" y1="115" x2="246" y2={Y[i] + 16} className="f-arr" markerEnd="url(#d1-arr2)" />
              <rect x="248" y={Y[i]} width="84" height="32" rx="4" className="f-obs" />
              <text x="290" y={Y[i] + 21} className="f-lbl c b">{it}</text>
              <line x1="372" y1={Y[i] + 16} x2="335" y2={Y[i] + 16} className="f-arr" markerEnd="url(#d1-arr2)" />
              <text x="378" y={Y[i] + 21} className="f-sym sm">ε</text>
            </g>
          ))}
          {m && ia >= 0 && ib >= 0 && <path d={`M388 ${Y[ia] + 10} C 420 ${Y[ia] + 10} 420 ${Y[ib] + 22} 388 ${Y[ib] + 22}`} className="f-arr warm" markerStart="url(#d1-arr2)" markerEnd="url(#d1-arr2)" fill="none" />}
        </svg>
        <div className="fig-text">
          <table className="rp-table mi-pick">
            <thead><tr><th>lhs ~~ rhs</th><th>mi</th><th>sepc.all</th></tr></thead>
            <tbody>{cov.slice(0, 5).map((x, i) => <tr key={i} className={i === k ? 'on' : ''} onClick={() => setK(i)} style={{ cursor: 'pointer' }}><td>{x.lhs} ~~ {x.rhs}</td><td>{x.mi.toFixed(2)}</td><td>{f3(x.sepc)}</td></tr>)}</tbody>
          </table>
          {m && <p className="hint">An <b>error correlation</b> between “{labels[m.lhs]}” and “{labels[m.rhs]}” would be a new parameter: part of what the two share would come from something other than the factor. MI = {m.mi.toFixed(2)} — below the χ² critical value of 3.84 for one df, and far below the course’s threshold of 10; the expected correlation would be {f2(m.sepc)}.</p>}
        </div>
      </div>
      <p className="hint">Possible reasons for an error correlation: {REASONS.join(', ')}. The largest residual correlation in this model is {f3(big.v)} ({big.a}, {big.c}) — nothing the model leaves unexplained. Two different things: the <b>correlation residual</b> (observed minus model-implied correlation, from <code>residuals()</code>) shows what the model misses; the <b>error correlation</b> (what a modification index proposes) is a parameter you could add. The MIs come in identical pairs because with df = 2 two different changes can produce exactly the same fit — the data cannot tell them apart, only theory can.</p>
    </div>
  );
}

// ---------------------------------------------------------------- step 8: the mean structure
export function MeanStructure({ s }: { s: ItemSet }) {
  const [ident, setIdent] = useState<'lat' | 'ref'>('lat');
  const [shift, setShift] = useState(0);
  const lam = loading(s);
  const means = s.items.map(it => s.means.find(m => m.lhs === it)!.est);
  const kappa = ident === 'lat' ? 0 : means[0];
  const tau = means.map((m, i) => (ident === 'lat' ? m : m - lam[i].est * means[0]));
  const k = kappa + shift;
  const pred = tau.map((t, i) => t + lam[i].est * k);
  const W = 420, x = (v: number) => 110 + ((v - 1) / 5) * (W - 130);
  return (
    <div className="fig">
      <div className="row" style={{ gap: 12 }}>
        <div className="seg" role="group" aria-label="Identifying the mean structure">
          <button aria-pressed={ident === 'lat'} onClick={() => setIdent('lat')}>latent mean fixed to 0</button>
          <button aria-pressed={ident === 'ref'} onClick={() => setIdent('ref')}>reference intercept fixed to 0</button>
        </div>
      </div>
      <div className="fig-row">
        <svg viewBox={`0 0 ${W} 200`} className="fig-svg" role="img" aria-label="Item means reproduced from intercepts, loadings and the latent mean">
          {[1, 2, 3, 4, 5, 6].map(v => <g key={v}><line x1={x(v)} x2={x(v)} y1="20" y2="176" className="h-grid" /><text x={x(v)} y="192" className="f-lbl c sm">{v}</text></g>)}
          {s.items.map((it, i) => (
            <g key={it}>
              <text x="8" y={44 + i * 38} className="f-lbl b">{it}</text>
              <circle cx={x(means[i])} cy={40 + i * 38} r="6" className="ms-obs" />
              <circle cx={x(pred[i])} cy={40 + i * 38} r="4.5" className="ms-pred" style={{ transition: 'cx .3s' }} />
            </g>
          ))}
        </svg>
        <div className="fig-text">
          <p className="idrow"><Tex>{'E(y_i) = \\tau_i + \\lambda_i\\,\\kappa'}</Tex></p>
          <table className="rp-table"><thead><tr><th>item</th><th>τ</th><th>λ</th><th>E(y)</th></tr></thead>
            <tbody>{s.items.map((it, i) => <tr key={it}><td>{it}</td><td>{f2(tau[i])}</td><td>{f2(lam[i].est)}</td><td>{f2(pred[i])}</td></tr>)}</tbody></table>
          <p>κ = <b>{f2(k)}</b> {ident === 'lat' ? '(fixed to 0: every intercept is the item’s mean)' : '(the latent mean takes the mean of ipmodst, whose intercept is 0)'}</p>
        </div>
      </div>
      <label className="ctl"><span>What if κ were higher by</span><input type="range" min={-1} max={1} step={0.05} value={shift} onChange={e => setShift(+e.target.value)} /><output>{f2(shift)}</output></label>
      <p className="hint">Large dots: the observed item means; small dots: the means the model implies. Both identifications reproduce the means exactly — they only distribute them differently between τ and κ. Raise κ and every item mean moves by its loading: ipbhprp most, ipmodst least.</p>
    </div>
  );
}
