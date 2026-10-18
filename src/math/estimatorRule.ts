// One source for the course's rule of thumb on ordered answers (Day 2, section 9), so that the
// estimator chooser, the project step, the transfer answer and station 2.4 never disagree.
// After Rhemtulla, Brosseau-Liard & Savalei (2012) and Brown (2015): from five categories on,
// continuous with MLR; four categories a grey zone; two or three ordinal with WLSMV. "Piled up"
// is made concrete: more than 40 % of the answers in one end category.
export type Categories = '2–3' | '4' | '5–6' | '7+';
export const PILE_UP = 0.4;
export const PILE_UP_TEXT = 'more than 40 % of the answers in one end category';

export interface EstimatorAdvice { estimator: 'MLR' | 'WLSMV'; check: 'MLR' | 'WLSMV' | null; why: string }

export function chooseEstimator(cats: Categories, piledUp: boolean): EstimatorAdvice {
  if (cats === '2–3') return { estimator: 'WLSMV', check: null, why: 'With two or three categories the answers are clearly not continuous: model them as ordered categories.' };
  if (cats === '4') return piledUp
    ? { estimator: 'WLSMV', check: null, why: 'Four categories are a grey zone; with the answers piled up at one end, treat them as ordinal.' }
    : { estimator: 'MLR', check: 'WLSMV', why: 'Four categories are a grey zone. Without a pile-up, the continuous treatment with MLR is defensible (Brown, 2015) — report WLSMV as a check.' };
  if (cats === '5–6') return piledUp
    ? { estimator: 'WLSMV', check: 'MLR', why: 'Five or six categories are usually treated as continuous — but with the answers piled up at one end the correlations shrink noticeably: WLSMV, with MLR as a check.' }
    : { estimator: 'MLR', check: null, why: 'Five or six categories without a strong pile-up: continuous, with MLR for the remaining non-normality. The course’s value items are this case (at most 30 % in an end category).' };
  return { estimator: 'MLR', check: null, why: 'Seven or more categories: continuous. MLR corrects χ² and the standard errors for skew; with symmetric answers it costs nothing.' };
}

/** The rule in one sentence, for transfer answers and reference cards. */
export const ESTIMATOR_RULE = `Seven or more categories: continuous with MLR. Five or six: continuous with MLR, unless ${PILE_UP_TEXT} — then WLSMV. Four: a grey zone — WLSMV if the answers pile up, otherwise MLR with WLSMV as a check. Two or three: ordinal with WLSMV.`;
