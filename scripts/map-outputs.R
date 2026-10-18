# ---------------------------------------------------------------------------
# η Lab · The map of SEM: the matrices lavaan keeps behind a model
#
# Two models of the course data (NL2, ESS 2004), estimated with the course's code, and the
# matrices lavInspect(fit, what = "est") returns: the CFA of Day 2 (lambda, theta, psi, nu,
# alpha) and a small full SEM of week 2 (the same plus beta). Model output only.
#
# Run from the app folder:  Rscript scripts/map-outputs.R
# ---------------------------------------------------------------------------
suppressPackageStartupMessages({
  library(tidyverse); library(sjlabelled); library(sjmisc); library(lavaan); library(jsonlite)
})

NL2 <- read_spss("../../../Lugano 2025/Lugano2025Code/NL2.sav", convert.factors = F, drop.labels = T) %>%
  mutate(across(ipcrtiv:impfun, \(x) rec(x, rec = "rev")),
         across(imsmetn:impcntr, \(x) rec(x, rec = "rev")))   # allow items: higher = allow more

out_text <- function(expr) paste(capture.output(expr), collapse = "\n")
mats <- function(fit) {
  m <- lavInspect(fit, what = "est")
  lapply(m, \(x) list(rows = rownames(x) %||% character(0), cols = colnames(x) %||% character(0),
                      values = unname(round(unclass(as.matrix(x)), 3))))
}

trco_univ_fit <- cfa(model = "
  TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp
  UNIV =~ ipeqopt + ipudrst + impenv
", data = NL2, estimator = "MLR", missing = "fiml.x")

values_allow_fit <- sem(model = "
  TRCO  =~ ipmodst + imptrad + ipfrule + ipbhprp
  UNIV  =~ ipeqopt + ipudrst + impenv
  ALLOW =~ imsmetn + imdfetn + impcntr
  ALLOW ~ TRCO + UNIV
", data = NL2, estimator = "MLR", missing = "fiml.x")

# ---- how a model is estimated: the small model of the matrix workshop, on real data -------------
# TRCO =~ ipfrule + ipbhprp, UNIV =~ ipeqopt + ipudrst (y1..y4 of the workshop), plain ML, listwise:
# so that F_ML in the browser is exactly the function lavaan minimises (lavaan prints fmin = F_ML / 2).
toy_model <- "
  TRCO =~ ipfrule + ipbhprp
  UNIV =~ ipeqopt + ipudrst
"
trace_text <- capture.output(toy_fit <- cfa(model = toy_model, data = NL2, estimator = "ML", verbose = T))
toy_trace <- trace_text %>% str_subset("objective function") %>% str_extract("[0-9.]+$") %>% as.numeric() %>% unique()
toy_pe <- parameterEstimates(toy_fit) %>% filter(op %in% c("=~", "~~"))
toy_start <- parTable(toy_fit) %>% filter(op %in% c("=~", "~~")) %>% pull(start)
toy_short <- cfa(model = toy_model, data = NL2, estimator = "ML", control = list(iter.max = 3)) %>%
  tryCatch(warning = \(w) conditionMessage(w))
# the workshop's cross-loading: df = 0, and still not identified
cross_text <- local({
  S <- lavInspect(toy_fit, "implied")$cov
  tryCatch(cfa(model = "TRCO =~ ipfrule + ipbhprp\n UNIV =~ ipeqopt + ipudrst + ipbhprp", sample.cov = S, sample.nobs = 1845),
           warning = \(w) conditionMessage(w))
})
info <- lavInspect(toy_fit, "information.expected")

# the course model of Day 2 with plain ML: the likelihood behind χ², and FIML against listwise
course_model <- "
  TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp
  UNIV =~ ipeqopt + ipudrst + impenv
"
course_ml <- cfa(model = course_model, data = NL2, estimator = "ML")
course_fiml <- cfa(model = course_model, data = NL2, estimator = "ML", missing = "fiml")
course_mlr <- cfa(model = course_model, data = NL2, estimator = "MLR", missing = "fiml.x")
items7 <- c("ipmodst", "imptrad", "ipfrule", "ipbhprp", "ipeqopt", "ipudrst", "impenv")
answered <- NL2 %>% select(all_of(items7)) %>% mutate(k = rowSums(!is.na(across(everything())))) %>% count(k)

# ordinal data: thresholds and the polychoric correlation of two skewed items (aggregates only)
ord_items <- c("ipeqopt", "impenv")
poly <- lavCor(NL2 %>% select(all_of(ord_items)), ordered = ord_items, missing = "pairwise", output = "cor")
pears <- cor(NL2$ipeqopt, NL2$impenv, use = "pairwise.complete.obs")

est <- list(
  toy = list(
    items = lavNames(toy_fit), n = lavInspect(toy_fit, "nobs"),
    S = unname(round(unclass(lavInspect(toy_fit, "sampstat")$cov), 6)),
    par = paste(toy_pe$lhs, toy_pe$op, toy_pe$rhs), est = round(toy_pe$est, 6), se = round(toy_pe$se, 6),
    start = round(toy_start, 6), fmin = fitMeasures(toy_fit, "fmin")[[1]], chisq = fitMeasures(toy_fit, "chisq")[[1]],
    iterations = lavInspect(toy_fit, "iterations"), trace = round(2 * toy_trace, 8),
    resid_z = unname(round(unclass(lavResiduals(toy_fit)$cov.z), 3)),
    mi = round(max(modindices(toy_fit)$mi), 3),
    short_warning = toy_short, cross_warning = cross_text,
    se_expected = round(sqrt(diag(solve(info)) / lavInspect(toy_fit, "nobs")), 6)
  ),
  course = list(
    n = lavInspect(course_ml, "nobs"), logl = fitMeasures(course_ml, "logl")[[1]],
    unrestricted = fitMeasures(course_ml, "unrestricted.logl")[[1]], chisq = fitMeasures(course_ml, "chisq")[[1]],
    df = fitMeasures(course_ml, "df")[[1]], fmin = fitMeasures(course_ml, "fmin")[[1]],
    iterations = lavInspect(course_ml, "iterations"),
    fiml_n = lavInspect(course_fiml, "nobs"), fiml_chisq = fitMeasures(course_fiml, "chisq")[[1]],
    total = nrow(NL2), answered = setNames(as.list(answered$n), answered$k),
    scaling = fitMeasures(course_mlr, "chisq.scaling.factor")[[1]]
  ),
  ord = list(items = ord_items,
             counts = map(ord_items, \(v) as.vector(table(NL2[[v]]))),
             thresholds = map(ord_items, \(v) as.vector(lavCor(NL2 %>% select(all_of(v)), ordered = v, output = "th"))),
             poly = poly[2, 1], pearson = pears)
)

map <- list(
  source = "ESS round 2 (2004), the Netherlands (course file NL2.sav); lavaan 0.6-21, MLR, missing = \"fiml.x\"",
  cfa = list(matrices = mats(trco_univ_fit), text = out_text(lavInspect(trco_univ_fit, what = "est")),
             implied = unname(round(unclass(fitted(trco_univ_fit)$cov), 3)), names = rownames(fitted(trco_univ_fit)$cov)),
  sem = list(matrices = mats(values_allow_fit), text = out_text(lavInspect(values_allow_fit, what = "est")),
             fit = as.list(round(fitMeasures(values_allow_fit, c("chisq.scaled", "df", "cfi.robust", "rmsea.robust", "srmr")), 3)),
             std = parameterEstimates(values_allow_fit, standardized = TRUE) %>% filter(op == "~") %>% transmute(lhs, rhs, est = round(est, 3), std = round(std.all, 3)),
             chisq = round(fitMeasures(values_allow_fit, "chisq"), 3)),
  est = est
)
write_json(map, "public/data/map.json", auto_unbox = TRUE, digits = NA, pretty = FALSE)   # full precision: fmin is small
cat("written: public/data/map.json\n")
print(lavInspect(trco_univ_fit, what = "est")[c("lambda", "psi")])
print(lavInspect(values_allow_fit, what = "est")[c("beta", "psi")])
print(map$sem$fit); print(map$sem$std)
str(est)
