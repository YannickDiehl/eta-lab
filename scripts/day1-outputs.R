# ---------------------------------------------------------------------------
# η Lab · Day 1: the R outputs the interactive script shows
#
# Runs the course's own pipeline (tidyverse, sjlabelled/sjmisc, easystats, MVN, lavaan with
# MLR and FIML) on the course's NL2 file (ESS round 2, the Netherlands) and writes what the
# day page displays: frequency tables, descriptives, normality tests, correlations, item
# statistics, the lavaan summary and its parts. Aggregates and model output only — no answers
# of any respondent leave this script.
#
# Run from the app folder:  Rscript scripts/day1-outputs.R
# ---------------------------------------------------------------------------
suppressPackageStartupMessages({
  library(tidyverse); library(sjlabelled); library(sjmisc)
  library(MVN); library(easystats); library(lavaan); library(jsonlite)
})

NL2 <- read_spss("../../../Lugano 2025/Lugano2025Code/NL2.sav", convert.factors = F, drop.labels = T) %>%
  mutate(across(ipcrtiv:impfun, \(x) rec(x, rec = "rev")))   # 1 = not like me at all … 6 = very much like me

labels <- c(
  ipmodst = "Important to be humble and modest, not draw attention",
  imptrad = "Important to follow traditions and customs",
  ipfrule = "Important to do what is told and follow rules",
  ipbhprp = "Important to behave properly",
  ipeqopt = "Important that people are treated equally and have equal opportunities",
  ipudrst = "Important to understand different people",
  impenv  = "Important to care for nature and environment"
)

out_text <- function(expr) paste(capture.output(expr), collapse = "\n")

analyse_set <- function(items, model, factor) {
  d <- NL2 %>% select(all_of(items))
  frq_tab <- lapply(items, \(v) {
    x <- d[[v]]
    list(item = v, label = labels[[v]], counts = as.integer(sapply(1:6, \(k) sum(x == k, na.rm = TRUE))), missing = sum(is.na(x)))
  })
  desc <- d %>% describe_distribution() %>% as.data.frame()
  mv <- d %>% mvn()
  mv_text <- out_text(summary(mv, select = c("mvn", "univariate")))
  cors <- d %>% correlation() %>% as.data.frame()
  isc <- d %>% principal_components(n = 1) %>% check_itemscale()
  isc_text <- out_text(print(isc))
  isc_tab <- as.data.frame(isc[[1]])
  fit <- cfa(model = model, data = NL2, estimator = "MLR", missing = "fiml.x")
  fm <- fitMeasures(fit, c("chisq", "df", "pvalue", "chisq.scaled", "pvalue.scaled", "chisq.scaling.factor",
                           "cfi.robust", "tli.robust", "rmsea.robust", "rmsea.ci.lower.robust", "rmsea.ci.upper.robust", "srmr"))
  pe <- parameterEstimates(fit, standardized = TRUE) %>% filter(op %in% c("=~", "~~")) %>%
    transmute(lhs, op, rhs, est, se, z, pvalue, std = std.all)
  mi <- tryCatch(modificationindices(fit, standardized = T, sort. = T) %>% as.data.frame() %>%
                   transmute(lhs, op, rhs, mi, epc, sepc = sepc.all) %>% head(8), error = \(e) data.frame())
  resid <- residuals(fit, type = "cor")$cov
  mean_fit <- cfa(model = model, data = NL2, estimator = "MLR", missing = "fiml.x", meanstructure = T)
  means <- parameterEstimates(mean_fit) %>% filter(op == "~1") %>% transmute(lhs, est, se)
  list(
    factor = factor, items = items, n = nobs(fit), model = model,
    frq = frq_tab, describe = desc, mvn = mv_text, correlation = cors,
    itemscale = isc_tab, itemscale_text = isc_text,
    itemscale_alpha = attr(isc[[1]], "item_intercorrelation") %||% NA,
    summary = out_text(summary(object = fit, fit.measures = T, standardized = T)),
    fit = as.list(round(unclass(fm), 4)), estimates = pe, mi = mi,
    residuals = unclass(resid), resid_names = rownames(resid),
    means = means, mean_summary = out_text(summary(object = mean_fit, fit.measures = F, standardized = T)),
    item_means = colMeans(d, na.rm = TRUE)
  )
}

day1 <- list(
  source = "ESS round 2 (2004), the Netherlands (course file NL2.sav); value items reversed with sjmisc::rec(rec = \"rev\"); lavaan 0.6-21, MLR, missing = \"fiml.x\"",
  versions = list(lavaan = as.character(packageVersion("lavaan")), MVN = as.character(packageVersion("MVN")), easystats = as.character(packageVersion("easystats"))),
  trco = analyse_set(c("ipmodst", "imptrad", "ipfrule", "ipbhprp"), "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp", "TRCO"),
  univ = analyse_set(c("ipeqopt", "ipudrst", "impenv"), "UNIV =~ ipeqopt + ipudrst + impenv", "UNIV")
)
dir.create("public/data", showWarnings = FALSE)
write_json(day1, "public/data/day1.json", auto_unbox = TRUE, digits = 6, pretty = FALSE, na = "null")
cat("written: public/data/day1.json\n")
