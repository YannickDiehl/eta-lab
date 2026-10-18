// How the R code estimates: estimator and missing data. The studio itself always uses ML on
// complete cases; η says what changes when the same model runs in R with another choice.
import { orderedItems, type Diagram, type ROptions } from '../model/diagram.ts';

const WHY: Record<ROptions['estimator'], string> = {
  ML: 'ML assumes roughly normal items — the same as the studio, so R will show the numbers you see here.',
  MLR: 'MLR gives the same estimates as the studio, but standard errors and χ² corrected for non-normal answers (Yuan–Bentler). Report the robust CFI and RMSEA.',
  WLSMV: 'WLSMV treats the items as ordinal: it fits their polychoric correlations, so loadings and fit in R will differ from the studio’s ML numbers. Best for Likert items with few categories.',
};

export function ROptionsBar({ r, set, d }: { r: ROptions; set: (r: ROptions) => void; d: Diagram }) {
  const items = orderedItems(d);
  return (
    <div className="ropts">
      <div className="ropts-row" role="group" aria-label="Estimator in R">
        <span>Estimator</span>
        <span className="seg">
          {(['ML', 'MLR', 'WLSMV'] as const).map(e => <button key={e} aria-pressed={r.estimator === e} onClick={() => set({ ...r, estimator: e })}>{e}</button>)}
        </span>
      </div>
      <div className="ropts-row" role="group" aria-label="Missing data in R">
        <span>Missing</span>
        <span className="seg">
          <button aria-pressed={r.missing === 'listwise'} onClick={() => set({ ...r, missing: 'listwise' })}>listwise</button>
          <button aria-pressed={r.missing === 'fiml'} onClick={() => set({ ...r, missing: 'fiml' })}>{r.estimator === 'WLSMV' ? 'pairwise' : 'FIML'}</button>
        </span>
      </div>
      <p className="ropts-why"><b>η:</b> {WHY[r.estimator]}
        {r.estimator === 'WLSMV' && (items.length ? ` Ordinal here: ${items.join(', ')}; covariates stay continuous.` : ' Your model has no factor items yet.')}
        {r.missing === 'fiml' && (r.estimator === 'WLSMV'
          ? ' WLSMV cannot use FIML; lavaan uses every pair of answers instead (pairwise).'
          : ' FIML lets every person count with the answers they gave; the studio uses complete cases only.')}
      </p>
    </div>
  );
}
