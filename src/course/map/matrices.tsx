// The map of SEM · the matrix workshop: a small CFA (two factors, four items) whose every arrow
// is a cell of Λ, Ψ or Θ. Click an arrow or a cell; change a value; watch Σ = ΛΨΛ′ + Θ change.
// A selected cell of Σ is traced back to its paths (Wright's tracing rules); the full matrix
// multiplication can be unfolded step by step. A guide of four small steps leads the first visit;
// the identification of every variant (df, and what df cannot tell) is said in words.
import { useMemo, useState, type KeyboardEvent } from 'react';
import { Tex } from '../../components/ui.tsx';

type M = number[][];
const mul = (a: M, b: M) => a.map(r => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const tr = (a: M) => a[0].map((_, j) => a.map(r => r[j]));
const add = (a: M, b: M) => a.map((r, i) => r.map((v, j) => v + b[i][j]));
const f2 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2));

interface P { l21: number; l42: number; l22: number; p11: number; p22: number; p21: number; t1: number; t2: number; t3: number; t4: number; t32: number }
type Cell = { m: 'L' | 'P' | 'T' | 'S'; r: number; c: number } | null;
const ITEMS = ['y₁', 'y₂', 'y₃', 'y₄'], ETAS = ['η₁', 'η₂'];

function build(p: P, cross: boolean, ecov: boolean) {
  const L: M = [[1, 0], [p.l21, cross ? p.l22 : 0], [0, 1], [0, p.l42]];
  const Ps: M = [[p.p11, p.p21], [p.p21, p.p22]];
  const T: M = [[p.t1, 0, 0, 0], [0, p.t2, ecov ? p.t32 : 0, 0], [0, ecov ? p.t32 : 0, p.t3, 0], [0, 0, 0, p.t4]];
  const LP = mul(L, Ps), LPL = mul(LP, tr(L)), S = add(LPL, T);
  return { L, Ps, T, LP, LPL, S };
}

/** Which parameter sits in a cell — fixed (1 or 0) or free (its key). */
function cellParam(m: 'L' | 'P' | 'T', r: number, c: number, cross: boolean, ecov: boolean): keyof P | 'one' | 'zero' {
  if (m === 'L') {
    if ((r === 0 && c === 0) || (r === 2 && c === 1)) return 'one';
    if (r === 1 && c === 0) return 'l21';
    if (r === 3 && c === 1) return 'l42';
    if (r === 1 && c === 1) return cross ? 'l22' : 'zero';
    return 'zero';
  }
  if (m === 'P') return r === c ? (r === 0 ? 'p11' : 'p22') : 'p21';
  if (r === c) return (['t1', 't2', 't3', 't4'] as const)[r];
  if ((r === 1 && c === 2) || (r === 2 && c === 1)) return ecov ? 't32' : 'zero';
  return 'zero';
}

function Grid({ name, m, rows, cols, kind, sel, onSel, hot, guess, cross, ecov, lower }: {
  name: string; m: M; rows: string[]; cols: string[]; kind: 'L' | 'P' | 'T' | 'S'; sel: Cell; onSel: (c: Cell) => void; hot?: Set<string>; guess?: Set<string>; cross: boolean; ecov: boolean; lower?: boolean;
}) {
  return (
    <div className="mw-grid">
      <div className="mw-name"><Tex>{name}</Tex></div>
      <table>
        <thead><tr><th />{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{m.map((row, r) => (
          <tr key={r}><th>{rows[r]}</th>{row.map((v, c) => {
            if (lower && c > r) return <td key={c} className="mw-empty" />;
            const prm = kind === 'S' ? null : cellParam(kind, r, c, cross, ecov);
            const isSel = sel && sel.m === kind && ((sel.r === r && sel.c === c) || (kind !== 'L' && sel.r === c && sel.c === r));
            const cls = [prm === 'one' ? 'fixed1' : prm === 'zero' ? 'fixed0' : kind === 'S' ? 'sigma' : 'free', isSel ? 'sel' : '', hot?.has(`${r},${c}`) ? 'hot' : '', guess?.has(`${r},${c}`) ? 'guess' : ''].join(' ');
            return <td key={c}><button className={cls} onClick={() => onSel({ m: kind, r, c })} aria-label={`${name.replace(/\\/g, '')} row ${rows[r]} column ${cols[c]}: ${f2(v)}`}>{f2(v)}</button></td>;
          })}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

const DEF: P = { l21: 1.2, l42: 0.8, l22: 0.4, p11: 0.6, p22: 0.9, p21: 0.3, t1: 0.5, t2: 0.7, t3: 0.4, t4: 0.6, t32: 0.2 };
const LABEL: Record<keyof P, string> = { l21: 'λ₂₁', l42: 'λ₄₂', l22: 'λ₂₂', p11: 'ψ₁₁', p22: 'ψ₂₂', p21: 'ψ₂₁', t1: 'θ₁₁', t2: 'θ₂₂', t3: 'θ₃₃', t4: 'θ₄₄', t32: 'θ₃₂' };
const RANGE: Record<keyof P, [number, number]> = { l21: [0, 2], l42: [0, 2], l22: [-1, 1], p11: [0.1, 1.5], p22: [0.1, 1.5], p21: [-0.6, 0.6], t1: [0.05, 1.5], t2: [0.05, 1.5], t3: [0.05, 1.5], t4: [0.05, 1.5], t32: [-0.4, 0.4] };

// the four steps of the first visit
const GUIDE = [
  'Click the arrow λ₂₁ — from η₁ to y₂ — or its cell in Λ.',
  'Predict: which cells of Σ change when λ₂₁ moves? Click them in Σ, then check.',
  'Click the cell σ₃₁ of Σ (row y₃, column y₁): where does the covariance of y₃ and y₁ come from?',
  'Make σ₃₁ zero. Which parameter do you have to change — and to what?',
];
const key = (k: KeyboardEvent, f: () => void) => { if (k.key === 'Enter' || k.key === ' ') { k.preventDefault(); f(); } };

export function MatrixWorkshop() {
  const [p, setP] = useState<P>(DEF);
  const [step, setStep] = useState(0);              // guide: 0–3, 4 = done, -1 = skipped
  const [guess, setGuess] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);
  const [cross, setCross] = useState(false);
  const [ecov, setEcov] = useState(false);
  const [sel, setSel] = useState<Cell>(null);
  const B = useMemo(() => build(p, cross, ecov), [p, cross, ecov]);
  // which Σ cells move when the selected parameter moves (numerical derivative)
  const selParam = sel && sel.m !== 'S' ? cellParam(sel.m, sel.r, sel.c, cross, ecov) : null;
  const hot = useMemo(() => {
    const out = new Set<string>();
    if (!selParam || selParam === 'one' || selParam === 'zero') return out;
    const B2 = build({ ...p, [selParam]: p[selParam] + 0.01 }, cross, ecov);
    B.S.forEach((row, i) => row.forEach((v, j) => { if (Math.abs(B2.S[i][j] - v) > 1e-9) out.add(`${i},${j}`); }));
    return out;
  }, [selParam, p, cross, ecov, B]);
  const free = (Object.keys(p) as (keyof P)[]).filter(k => (k !== 'l22' || cross) && (k !== 't32' || ecov));
  const q = free.length, df = 10 - q;
  // what λ₂₁ moves — the truth behind the prediction of guide step 2 (lower triangle of Σ)
  const hotL21 = useMemo(() => {
    const B2 = build({ ...p, l21: p.l21 + 0.01 }, cross, ecov), out = new Set<string>();
    B.S.forEach((row, i) => row.forEach((v, j) => { if (j <= i && Math.abs(B2.S[i][j] - v) > 1e-9) out.add(`${i},${j}`); }));
    return out;
  }, [p, cross, ecov, B]);
  const hits = [...guess].filter(g => hotL21.has(g)).length, wrong = guess.size - hits;
  // guide progress follows what the learner does
  const select = (c: Cell) => {
    if (step === 1 && !checked && c && c.m === 'S') {
      const k = `${Math.max(c.r, c.c)},${Math.min(c.r, c.c)}`;
      setGuess(g => { const n = new Set(g); if (n.has(k)) n.delete(k); else n.add(k); return n; });
      return;
    }
    setSel(c);
    if (step === 0 && c && c.m === 'L' && c.r === 1 && c.c === 0) setStep(1);
    if (step === 2 && c && c.m === 'S' && Math.max(c.r, c.c) === 2 && Math.min(c.r, c.c) === 0) setStep(3);
  };
  const setParam = (k: keyof P, v: number) => {
    setP(o => ({ ...o, [k]: v }));
    if (step === 3 && k === 'p21' && Math.abs(v) < 0.01) setStep(4);
  };
  const ident = cross && ecov
    ? { cls: 'bad', text: <>df = −1: eleven free parameters, but Σ holds only ten numbers. No software can estimate this model.</> }
    : cross
      ? { cls: 'bad', text: <>df = 0 — and still <b>not identified</b>. With two items per factor, one relation among the covariances holds whatever the values (σ₄₂·σ₃₁ = σ₄₁·σ₃₂), so Σ carries only nine independent pieces of information for ten parameters. lavaan says: “Could not compute standard errors! The information matrix could not be inverted.” Counting is necessary, not sufficient (Day 1, step 5).</> }
      : ecov
        ? { cls: '', text: <>df = 0: just identified. The model can reproduce Σ exactly — and so there is nothing left to test.</> }
        : Math.abs(p.p21) < 0.05
          ? { cls: 'warn', text: <>df = 1 on paper — but with ψ₂₁ near 0 the model falls apart into two factors with two items each, and neither λ₂₁ nor λ₄₂ can be estimated any more: <b>empirically not identified</b>.</> }
          : { cls: '', text: <>df = 1: one testable claim. The model could be wrong — and the data can tell.</> };

  // tracing a cell of Σ back to its paths
  const trace = sel && sel.m === 'S' ? (() => {
    const i = Math.max(sel.r, sel.c), j = Math.min(sel.r, sel.c);
    const terms: { tex: string; v: number; words: string; k: number; l: number }[] = [];
    for (let k = 0; k < 2; k++) for (let l = 0; l < 2; l++) {
      const v = B.L[i][k] * B.Ps[k][l] * B.L[j][l];
      if (Math.abs(v) < 1e-9) continue;
      const pk = k === l ? `\\psi_{${k + 1}${k + 1}}` : `\\psi_{21}`;
      terms.push({ tex: `\\lambda_{${i + 1}${k + 1}} \\cdot ${pk} \\cdot \\lambda_{${j + 1}${l + 1}}`, v, words: `${ITEMS[i]} ← ${ETAS[k]}${k === l ? '' : ` ↔ ${ETAS[l]}`} → ${ITEMS[j]}`, k, l });
    }
    const th = B.T[i][j];
    return { i, j, terms, th, total: B.S[i][j] };
  })() : null;

  const pick = (m: 'L' | 'P' | 'T', r: number, c: number) => select({ m, r, c });
  const btn = (m: 'L' | 'P' | 'T', r: number, c: number, label: string) => ({ role: 'button', tabIndex: 0, 'aria-label': label, onClick: () => pick(m, r, c), onKeyDown: (k: KeyboardEvent) => key(k, () => pick(m, r, c)) });
  const isOn = (m: 'L' | 'P' | 'T', r: number, c: number) => !!sel && sel.m === m && ((sel.r === r && sel.c === c) || (m !== 'L' && sel.r === c && sel.c === r));
  // light up exactly the arrows the traced paths run through
  const traceOn = (m: 'L' | 'P' | 'T', r: number, c: number) => {
    if (!trace) return false;
    if (m === 'L') return trace.terms.some(t => (r === trace.i && c === t.k) || (r === trace.j && c === t.l));
    if (m === 'P') return trace.terms.some(t => (t.k === r && t.l === c) || (t.k === c && t.l === r));
    return Math.abs(trace.th) > 1e-9 && ((r === trace.i && c === trace.j) || (r === trace.j && c === trace.i));
  };
  const Y = [40, 100, 160, 220], EY = [70, 190];
  const arrowCls = (m: 'L' | 'P' | 'T', r: number, c: number) => `mw-path ${isOn(m, r, c) ? 'sel' : ''} ${traceOn(m, r, c) ? 'trace' : ''}`;

  return (
    <div className="fig mw">
      {step >= 0 && step < 4 && (
        <div className="mw-guide" role="status">
          <ol>{GUIDE.map((g, i) => <li key={i} className={i < step ? 'done' : i === step ? 'now' : ''}>{i < step ? '✓ ' : ''}{g}</li>)}</ol>
          {step === 1 && (
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="hint" style={{ margin: 0 }}>{guess.size ? `${guess.size} cell${guess.size > 1 ? 's' : ''} marked` : 'No cell marked yet'}</span>
              {!checked && <button className="btn" disabled={!guess.size} onClick={() => { setChecked(true); setSel({ m: 'L', r: 1, c: 0 }); }}>Check my prediction</button>}
              {checked && <>
                <span>{hits} of {hotL21.size} right{wrong ? `, ${wrong} too many` : ''}. λ₂₁ is a road to and from y₂ — it changes every cell in the row and column of y₂ (orange), and nothing else.</span>
                <button className="btn primary" onClick={() => setStep(2)}>Next</button>
              </>}
            </div>
          )}
          <button className="linklike" onClick={() => setStep(-1)}>skip the guide</button>
        </div>
      )}
      {step === 4 && <div className="mw-guide ok" role="status"><p><b>✓ Guide complete.</b> With ψ₂₁ = 0 the only road between y₁ and y₃ is closed: two items of different factors can only covary through the covariance of their factors. Now play freely — draw the cross-loading or the error covariance below and watch what happens to df.</p></div>}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="tool" aria-pressed={cross} onClick={() => setCross(v => !v)}>{cross ? '✓ ' : '+ '}cross-loading η₂ → y₂</button>
        <button className="tool" aria-pressed={ecov} onClick={() => setEcov(v => !v)}>{ecov ? '✓ ' : '+ '}error covariance y₂ ↔ y₃</button>
        <button className="tool" onClick={() => { setP(DEF); setCross(false); setEcov(false); }}>reset</button>
      </div>
      <p className={`mw-ident ${ident.cls}`}><b>Σ holds p = 10 numbers · the model has q = {q} free parameters · df = p − q = {df}.</b> {ident.text}</p>
      <div className="mw-row">
        <svg viewBox="0 0 330 270" className="mw-svg" role="img" aria-label="Path diagram of two factors with four items; every arrow is a matrix cell">
          <defs><marker id="mw-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor" /></marker></defs>
          {/* factor covariance and variances */}
          <g className={arrowCls('P', 1, 0)} {...btn('P', 1, 0, 'factor covariance ψ21')}><path d="M48 92 C 10 120 10 140 48 168" fill="none" markerStart="url(#mw-a)" markerEnd="url(#mw-a)" /><text x="8" y="134">ψ₂₁</text></g>
          {[0, 1].map(k => (
            <g key={k} className={arrowCls('P', k, k)} {...btn('P', k, k, `factor variance ψ${k + 1}${k + 1}`)}>
              <path d={`M64 ${EY[k] - 22} C 50 ${EY[k] - 50} 100 ${EY[k] - 50} 86 ${EY[k] - 22}`} fill="none" markerEnd="url(#mw-a)" />
              <text x="60" y={EY[k] - 44}>ψ{k ? '₂₂' : '₁₁'}</text>
            </g>
          ))}
          {ETAS.map((e, k) => <g key={e}><ellipse cx="75" cy={EY[k]} rx="32" ry="20" className="f-lat" /><text x="75" y={EY[k] + 6} className="f-sym sm">{e}</text></g>)}
          {/* loadings */}
          {B.L.map((row, r) => row.map((_v, c) => {
            const prm = cellParam('L', r, c, cross, ecov);
            if (prm === 'zero') return null;
            return (
              <g key={`${r}${c}`} className={arrowCls('L', r, c)} {...btn('L', r, c, prm === 'one' ? `loading of y${r + 1} on η${c + 1}, fixed to 1` : `loading λ${r + 1}${c + 1}`)}>
                <line x1="107" y1={EY[c]} x2="196" y2={Y[r] + 14} markerEnd="url(#mw-a)" />
                <text x={150 + (r - 1.5) * 2} y={(EY[c] + Y[r] + 14) / 2 - 4}>{prm === 'one' ? '1' : `λ${'₁₂₃₄'[r]}${'₁₂'[c]}`}</text>
              </g>
            );
          }))}
          {ITEMS.map((it, r) => <g key={it}><rect x="198" y={Y[r]} width="44" height="28" rx="4" className="f-obs" /><text x="220" y={Y[r] + 19} className="f-lbl c b">{it}</text></g>)}
          {/* errors */}
          {ITEMS.map((_, r) => (
            <g key={r} className={arrowCls('T', r, r)} {...btn('T', r, r, `error ε${r + 1}, its variance θ${r + 1}${r + 1}`)}>
              <line x1="290" y1={Y[r] + 14} x2="245" y2={Y[r] + 14} markerEnd="url(#mw-a)" />
              <text x="294" y={Y[r] + 15}>ε{'₁₂₃₄'[r]}</text>
              <text x="294" y={Y[r] + 27} className="mw-sub">θ{'₁₂₃₄'[r]}{'₁₂₃₄'[r]}</text>
            </g>
          ))}
          {ecov && <g className={arrowCls('T', 2, 1)} {...btn('T', 2, 1, 'error covariance θ32')}><path d={`M312 ${Y[1] + 10} C 334 ${Y[1] + 30} 334 ${Y[2]} 312 ${Y[2] + 18}`} fill="none" markerStart="url(#mw-a)" markerEnd="url(#mw-a)" /><text x="304" y={Y[1] + 48}>θ₃₂</text></g>}
        </svg>
        <div className="mw-mats">
          <Grid name="\Lambda" m={B.L} rows={ITEMS} cols={ETAS} kind="L" sel={sel} onSel={select} cross={cross} ecov={ecov} />
          <Grid name="\Psi" m={B.Ps} rows={ETAS} cols={ETAS} kind="P" sel={sel} onSel={select} cross={cross} ecov={ecov} lower />
          <Grid name="\Theta" m={B.T} rows={ITEMS} cols={ITEMS} kind="T" sel={sel} onSel={select} cross={cross} ecov={ecov} lower />
        </div>
      </div>
      <div className="mw-row">
        <div>
          <p className="mw-eq"><Tex>{'\\Sigma(\\theta) = \\Lambda\\,\\Psi\\,\\Lambda^{\\prime} + \\Theta'}</Tex></p>
          <Grid name="\Sigma" m={B.S} rows={ITEMS} cols={ITEMS} kind="S" sel={sel} onSel={select} hot={step === 1 && !checked ? undefined : hot} guess={step === 1 ? guess : undefined} cross={cross} ecov={ecov} lower />
        </div>
        <div className="mw-side">
          {selParam && selParam !== 'one' && selParam !== 'zero' && (
            <>
              <p><b>{LABEL[selParam]}</b> — {selParam.startsWith('l') ? 'a loading' : selParam.startsWith('p') ? (selParam === 'p21' ? 'the covariance of the factors' : 'a factor variance') : selParam === 't32' ? 'an error covariance' : 'an error variance'}. The highlighted cells of Σ change when you move it:</p>
              <label className="ctl"><span>{LABEL[selParam]}</span><input type="range" min={RANGE[selParam][0]} max={RANGE[selParam][1]} step={0.05} value={p[selParam]} onChange={e => setParam(selParam, +e.target.value)} /><output>{p[selParam].toFixed(2)}</output></label>
            </>
          )}
          {step === 1 && !checked && <p className="hint">Prediction mode: clicks on Σ mark cells. Check your prediction to see the answer.</p>}
          {selParam === 'one' && <p><b>Fixed to 1</b>: this loading gives the factor its unit (Day 1, step 3). Not a parameter — nothing to estimate.</p>}
          {selParam === 'zero' && <p><b>Fixed to 0</b>: an arrow you did not draw. It is an assumption — and it costs nothing, it <i>gains</i> a degree of freedom. Draw it with the buttons above and see what changes.</p>}
          {trace && (
            <>
              <p><b>σ{'₁₂₃₄'[trace.i]}{'₁₂₃₄'[trace.j]} = {f2(trace.total)}</b>{trace.i === trace.j ? ' — the variance of ' + ITEMS[trace.i] : ` — the covariance of ${ITEMS[trace.i]} and ${ITEMS[trace.j]}`}. Where does it come from? Trace every way from one item to the other through the factors:</p>
              <ul className="mw-terms">
                {trace.terms.map((t, n) => <li key={n}><Tex>{`${t.tex} = ${f2(t.v)}`}</Tex><small>{t.words}</small></li>)}
                {Math.abs(trace.th) > 1e-9 && <li><Tex>{`\\theta_{${trace.i + 1}${trace.j + 1}} = ${f2(trace.th)}`}</Tex><small>{trace.i === trace.j ? 'the item’s own error' : 'the error covariance'}</small></li>}
                {!trace.terms.length && Math.abs(trace.th) < 1e-9 && <li>No way leads from one item to the other — the model says their covariance is 0.</li>}
              </ul>
              <p className="hint">Each term is one path: up from an item to its factor, across the factor (co)variance, down to the other item. Sewall Wright’s tracing rule (1921) — and exactly what the matrix product computes, for all cells at once.</p>
            </>
          )}
          {!sel && <p className="hint">Click an arrow in the diagram or a cell in a matrix.</p>}
        </div>
      </div>
      <details className="deeper">
        <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>The multiplication, step by step</span></summary>
        <div className="deeper-body">
          <p>A matrix product multiplies rows by columns: the cell in row i and column j of A·B is the sum over k of a<sub>ik</sub>·b<sub>kj</sub>. Σ is built in three steps:</p>
          <div className="mw-steps">
            <div><p><b>1 · ΛΨ</b>: each item’s loadings, weighted by the factor (co)variances.</p><Grid name="\Lambda\Psi" m={B.LP} rows={ITEMS} cols={ETAS} kind="S" sel={null} onSel={() => undefined} cross={cross} ecov={ecov} /></div>
            <div><p><b>2 · (ΛΨ)Λ′</b>: times the loadings of the other item — the part of Σ the factors explain.</p><Grid name="\Lambda\Psi\Lambda^{\prime}" m={B.LPL} rows={ITEMS} cols={ITEMS} kind="S" sel={null} onSel={() => undefined} cross={cross} ecov={ecov} lower /></div>
            <div><p><b>3 · + Θ</b>: plus the errors — on the diagonal each item’s own error variance, off the diagonal only error covariances you drew.</p><Grid name="\Sigma" m={B.S} rows={ITEMS} cols={ITEMS} kind="S" sel={null} onSel={() => undefined} cross={cross} ecov={ecov} lower /></div>
          </div>
          <p>For one cell, written out:</p>
          <div className="sc-formula"><Tex block>{`\\sigma_{31} = \\sum_k \\sum_l \\lambda_{3k}\\,\\psi_{kl}\\,\\lambda_{1l} + \\theta_{31} = ${B.L[2].map((_, k) => [0, 1].map(l => `${f2(B.L[2][k])}\\cdot${f2(B.Ps[k][l])}\\cdot${f2(B.L[0][l])}`).join(' + ')).join(' + ')} + ${f2(B.T[2][0])} = ${f2(B.S[2][0])}`}</Tex></div>
          <p className="hint">Estimation turns this around: it searches the values in Λ, Ψ and Θ that make Σ(θ) as close as possible to the observed S — the next part of this page.</p>
        </div>
      </details>
    </div>
  );
}
