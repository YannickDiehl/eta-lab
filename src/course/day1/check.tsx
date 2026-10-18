// Day 1's self-check: the eight steps in three questions.
import { Choose } from '../../components/ui.tsx';

export function CheckDay1() {
  return (
    <div className="check-day">
      <Choose question="Four items measure tradition and conformity. How many degrees of freedom does the one-factor model have (reference indicator method)?"
        options={['0 — it is just identified', '2 — p = 10 observations, q = 8 parameters', '4 — one per item']} answer={1}
        explain="p = 4 · 5 / 2 = 10 variances and covariances; q = 3 loadings + 4 error variances + 1 factor variance = 8. df = 2: the model is overidentified, and its fit can be tested." />
      <Choose question="You switch from the reference indicator to the fixed factor method. What changes?"
        options={['The fit gets better.', 'The unstandardized loadings and the factor variance — not the fit, not the standardized loadings.', 'Nothing at all.']} answer={1}
        explain="The two methods are statistically equivalent: the same model in another unit. Each fixed-factor loading is the reference loading times √ψ." />
      <Choose question="mvn() rejects multivariate normality for the four items. What do you do?"
        options={['Drop the most skewed item.', 'Estimate with MLR (and FIML for the missing values).', 'Nothing — ML is always fine with large samples.']} answer={1}
        explain="With non-normal items, ML’s χ² and standard errors are too optimistic. MLR keeps the estimates and corrects both; FIML uses every respondent with at least one answer." />
    </div>
  );
}
