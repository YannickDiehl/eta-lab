# ---------------------------------------------------------------------------
# η Lab · Day 2: the R outputs the interactive script shows
#
# Same pipeline as Day 1 (tidyverse, sjlabelled/sjmisc, MVN, lavaan, semTools) on the course's
# NL2 file. The day's model: tradition/conformity and universalism in one two-factor CFA,
# estimated with ML, MLR and — treating the items as ordinal — WLSMV. Writes observed and
# model-implied matrices, fit, modification indices, Wald tests, nested comparisons and the
# homework on alternative identifications. Aggregates and model output only.
#
# Run from the app folder:  Rscript scripts/day2-outputs.R
# ---------------------------------------------------------------------------
suppressPackageStartupMessages({
  library(tidyverse); library(sjlabelled); library(sjmisc)
  library(MVN); library(lavaan); library(semTools); library(jsonlite)
})

NL2 <- read_spss("../../../Lugano 2025/Lugano2025Code/NL2.sav", convert.factors = F, drop.labels = T) %>%
  mutate(across(ipcrtiv:impfun, \(x) rec(x, rec = "rev")))

items <- c("ipmodst", "imptrad", "ipfrule", "ipbhprp", "ipeqopt", "ipudrst", "impenv")
out_text <- function(expr) paste(capture.output(expr), collapse = "\n")
mat <- function(m) { m <- unclass(m); m <- m[items, items]; unname(round(m, 4)) }

model_2f <- "
  TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp
  UNIV =~ ipeqopt + ipudrst + impenv
"
model_1f <- "
  VALUES =~ ipmodst + imptrad + ipfrule + ipbhprp + ipeqopt + ipudrst + impenv
"

# --- the two-factor model with ML and with MLR --------------------------------------------
trco_univ_fit_ml <- cfa(model = model_2f, data = NL2, estimator = "ML", missing = "fiml.x")
trco_univ_fit    <- cfa(model = model_2f, data = NL2, estimator = "MLR", missing = "fiml.x")

fit_of <- function(fit) {
  fm <- fitMeasures(fit)
  pick <- c("npar", "chisq", "df", "pvalue", "chisq.scaled", "df.scaled", "pvalue.scaled", "chisq.scaling.factor",
            "cfi", "tli", "rmsea", "rmsea.ci.lower", "rmsea.ci.upper", "srmr",
            "cfi.robust", "tli.robust", "rmsea.robust", "rmsea.ci.lower.robust", "rmsea.ci.upper.robust",
            "cfi.scaled", "rmsea.scaled", "aic", "bic")
  as.list(round(fm[intersect(pick, names(fm))], 4))
}
est_of <- function(fit) parameterEstimates(fit, standardized = TRUE) %>%
  filter(op %in% c("=~", "~~")) %>% transmute(lhs, op, rhs, est, se, z, pvalue, std = std.all)

# observed (unrestricted, FIML) and model-implied matrices
S     <- lavInspect(trco_univ_fit, "sampstat")$cov
Sigma <- fitted(trco_univ_fit)$cov
R_obs <- cov2cor(unclass(S)[items, items])
R_imp <- cov2cor(unclass(Sigma)[items, items])
res_std <- lavResiduals(trco_univ_fit, type = "cor")

# modification indices
mi <- modificationindices(trco_univ_fit, standardized = T, sort. = T) %>% as.data.frame() %>%
  transmute(lhs, op, rhs, mi, epc, sepc = sepc.all) %>% head(12)

# normality of the seven items (why MLR)
mv <- NL2 %>% select(all_of(items)) %>% mvn()
mv_text <- out_text(summary(mv, select = c("mvn", "univariate")))

# --- nested comparison: one value factor vs two -------------------------------------------
values_fit <- cfa(model = model_1f, data = NL2, estimator = "MLR", missing = "fiml.x")
lrt_1v2 <- lavTestLRT(values_fit, trco_univ_fit, method = "satorra.bentler.2001")
cmp_1v2 <- compareFit(values_fit, trco_univ_fit, argsLRT = list(method = "satorra.bentler.2001"))

# --- the largest MI freed, compared again ---------------------------------------------------
top <- mi[1, ]
model_2f_mod <- paste0(model_2f, "  ", top$lhs, " ", top$op, " ", top$rhs, "\n")
trco_univ_fit_mod <- cfa(model = model_2f_mod, data = NL2, estimator = "MLR", missing = "fiml.x")
lrt_mod <- lavTestLRT(trco_univ_fit, trco_univ_fit_mod, method = "satorra.bentler.2001")
cmp_mod <- compareFit(trco_univ_fit, trco_univ_fit_mod, argsLRT = list(method = "satorra.bentler.2001"))

lrt_tab <- function(l) as.data.frame(l) %>% rownames_to_column("model") %>%
  transmute(model, df = Df, aic = AIC, bic = BIC, chisq = Chisq, dchisq = `Chisq diff`, ddf = `Df diff`, p = `Pr(>Chisq)`)

# --- ordinal: the same model with WLSMV ---------------------------------------------------
trco_univ_fit_ord <- cfa(model = model_2f, data = NL2, estimator = "WLSMV", ordered = T, missing = "pairwise")
R_poly <- lavInspect(trco_univ_fit_ord, "sampstat")$cov
th <- lavInspect(trco_univ_fit_ord, "th")
th_tab <- tibble(name = names(th), value = round(as.numeric(th), 4)) %>%
  separate(name, c("item", "t"), sep = "\\|t") %>% mutate(t = as.integer(t))

frq_tab <- lapply(items, \(v) {
  x <- NL2[[v]]
  list(item = v, counts = as.integer(sapply(1:6, \(k) sum(x == k, na.rm = TRUE))), missing = sum(is.na(x)))
})

# --- homework: one factor, three identifications (Essex 2023, Day 2) -----------------------
tradition_conformity_fit <- cfa(
  model = "TraditionConformity =~ ipmodst + imptrad + ipfrule + ipbhprp",
  data = NL2, estimator = "MLR", missing = "fiml.x")
tradition_conformity_fit2 <- cfa(
  model = "TraditionConformity =~ NA*ipmodst + imptrad + ipfrule + 1*ipbhprp",
  data = NL2, estimator = "MLR", missing = "fiml.x")
tradition_conformity_fit3 <- cfa(
  model = "
  TraditionConformity =~ NA*ipmodst + imptrad + ipfrule + ipbhprp
  TraditionConformity ~~ 1*TraditionConformity
  ",
  data = NL2, estimator = "MLR", missing = "fiml.x")
ident <- lapply(list(first = tradition_conformity_fit, fourth = tradition_conformity_fit2, fixed = tradition_conformity_fit3),
                \(f) list(estimates = est_of(f), chisq = round(fitMeasures(f, "chisq.scaled"), 4)))

day2 <- list(
  source = "ESS round 2 (2004), the Netherlands (course file NL2.sav); value items reversed with sjmisc::rec(rec = \"rev\"); lavaan 0.6-21",
  versions = list(lavaan = as.character(packageVersion("lavaan")), semTools = as.character(packageVersion("semTools"))),
  items = items, model = model_2f,
  n = nobs(trco_univ_fit), n_ord = nobs(trco_univ_fit_ord),
  frq = frq_tab, mvn = mv_text,
  S = mat(S), Sigma = mat(Sigma), R_obs = unname(round(R_obs, 4)), R_imp = unname(round(R_imp, 4)),
  resid_cor = mat(res_std$cov), resid_z = mat(lavResiduals(trco_univ_fit, type = "cor")$cov.z),
  ml  = list(fit = fit_of(trco_univ_fit_ml), estimates = est_of(trco_univ_fit_ml),
             summary = out_text(summary(object = trco_univ_fit_ml, fit.measures = T, standardized = T))),
  mlr = list(fit = fit_of(trco_univ_fit), estimates = est_of(trco_univ_fit),
             summary = out_text(summary(object = trco_univ_fit, fit.measures = T, standardized = T))),
  mi = mi, mi_text = out_text(modificationindices(trco_univ_fit, standardized = T, sort. = T) %>% head(8)),
  one = list(fit = fit_of(values_fit), estimates = est_of(values_fit)),
  lrt_1v2 = lrt_tab(lrt_1v2), lrt_1v2_text = out_text(lrt_1v2), cmp_1v2_text = out_text(summary(cmp_1v2)),
  freed = paste(top$lhs, top$op, top$rhs), mod = list(fit = fit_of(trco_univ_fit_mod), estimates = est_of(trco_univ_fit_mod)),
  lrt_mod = lrt_tab(lrt_mod), lrt_mod_text = out_text(lrt_mod), cmp_mod_text = out_text(summary(cmp_mod)),
  ord = list(fit = fit_of(trco_univ_fit_ord), estimates = est_of(trco_univ_fit_ord), R_poly = mat(R_poly), thresholds = th_tab,
             summary = out_text(summary(object = trco_univ_fit_ord, fit.measures = T, standardized = T))),
  ident = ident
)
write_json(day2, "public/data/day2.json", auto_unbox = TRUE, digits = 6, pretty = FALSE, na = "null")
cat("written: public/data/day2.json\n")
cat("n", nobs(trco_univ_fit), " freed:", day2$freed, "\n")
print(unlist(day2$mlr$fit)); print(unlist(day2$ml$fit[c("chisq","df")])); print(day2$lrt_1v2); print(day2$lrt_mod); print(unlist(day2$ord$fit[c("chisq.scaled","df","cfi.scaled","rmsea.scaled")]))
