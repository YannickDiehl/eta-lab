# ---------------------------------------------------------------------------
# η Lab · Day 3: the R outputs the interactive script shows
#
# Restrictions and simultaneous CFA, after the course's Day 3 slides (Essex 2024), the worksheet
# and homework Day 3, the R code Day 3 and the Lugano 2025 code documentation: the restriction
# ladder (congeneric → tau-equivalent → parallel → strictly parallel) for tradition/conformity
# and for universalism, reliability (alpha and omega), identification by hand, and the
# simultaneous CFA of tradition/conformity, universalism and attitudes toward immigration.
# ESS round 2, the Netherlands; MLR and FIML as on Days 1–2. Aggregates and model output only.
#
# Run from the app folder:  Rscript scripts/day3-outputs.R
# ---------------------------------------------------------------------------
suppressPackageStartupMessages({
  library(tidyverse); library(sjlabelled); library(sjmisc)
  library(lavaan); library(semTools); library(jsonlite)
})

NL2 <- read_spss("../../../Lugano 2025/Lugano2025Code/NL2.sav", convert.factors = F, drop.labels = T) %>%
  mutate(across(ipcrtiv:impfun, \(x) rec(x, rec = "rev")),
         across(imsmetn:impcntr, \(x) rec(x, rec = "rev")))   # allow items: higher = allow more

out_text <- function(expr) paste(capture.output(expr), collapse = "\n")
FM <- c("chisq.scaled", "df", "pvalue.scaled", "chisq.scaling.factor", "cfi.robust", "tli.robust",
        "rmsea.robust", "srmr", "aic", "bic")
fit_of <- function(fit) as.list(round(fitMeasures(fit, FM), 4))
est_of <- function(fit) parameterEstimates(fit, standardized = TRUE) %>%
  filter(op %in% c("=~", "~~", "~1")) %>%
  transmute(lhs, op, rhs, label = if ("label" %in% names(.)) label else "", est = round(est, 4), se = round(se, 4), std = round(std.all, 4))
lrt <- function(a, b) { l <- lavTestLRT(a, b, method = "satorra.bentler.2001")
  list(dchisq = round(l$`Chisq diff`[2], 4), ddf = l$`Df diff`[2], p = l$`Pr(>Chisq)`[2]) }
cmp_fm <- c("chisq.scaled", "df.scaled", "pvalue.scaled", "rmsea.robust", "cfi.robust", "tli.robust", "srmr", "aic", "bic")
cfa_nl <- function(model) cfa(model = model, data = NL2, estimator = "MLR", missing = "fiml.x")

# ---- the restriction ladder: tradition/conformity -----------------------------------------
tradition_conformity_congeneric <- cfa_nl("
  TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp
")
tradition_conformity_tau <- cfa_nl("
  TRCO =~ 1*ipmodst + 1*imptrad + 1*ipfrule + 1*ipbhprp
")
tradition_conformity_tau2 <- cfa_nl("
  TRCO =~ NA*ipmodst + a*ipmodst + a*imptrad + a*ipfrule + a*ipbhprp
  TRCO ~~ 1*TRCO
")
tradition_conformity_parallel <- cfa_nl("
  TRCO =~ 1*ipmodst + 1*imptrad + 1*ipfrule + 1*ipbhprp
  ipmodst ~~ e*ipmodst
  imptrad ~~ e*imptrad
  ipfrule ~~ e*ipfrule
  ipbhprp ~~ e*ipbhprp
")
tradition_conformity_strictly_parallel <- cfa_nl("
  TRCO =~ 1*ipmodst + 1*imptrad + 1*ipfrule + 1*ipbhprp
  ipmodst ~~ e*ipmodst
  imptrad ~~ e*imptrad
  ipfrule ~~ e*ipfrule
  ipbhprp ~~ e*ipbhprp
  ipmodst ~ i*1
  imptrad ~ i*1
  ipfrule ~ i*1
  ipbhprp ~ i*1
")
# the tau-equivalent model with one loading released (the "adapted" model of the worksheet)
tradition_conformity_tau_adapted <- cfa_nl("
  TRCO =~ 1*ipmodst + 1*imptrad + 1*ipfrule + ipbhprp
")
trco <- list(congeneric = tradition_conformity_congeneric, tau = tradition_conformity_tau,
             parallel = tradition_conformity_parallel, strict = tradition_conformity_strictly_parallel)
compFit.tradition_conformity <- compareFit(
  congeneric = tradition_conformity_congeneric, tau = tradition_conformity_tau,
  parallel = tradition_conformity_parallel, strictly_parallel = tradition_conformity_strictly_parallel,
  argsLRT = list(method = "satorra.bentler.2001"))

# ---- the same ladder for universalism (homework Day 3) ---------------------------------------
universalism_congeneric <- cfa_nl("UNIV =~ ipeqopt + ipudrst + impenv")
universalism_tau <- cfa_nl("UNIV =~ 1*ipeqopt + 1*ipudrst + 1*impenv")
universalism_parallel <- cfa_nl("
  UNIV =~ 1*ipeqopt + 1*ipudrst + 1*impenv
  ipeqopt ~~ e*ipeqopt
  ipudrst ~~ e*ipudrst
  impenv ~~ e*impenv
")
universalism_strictly_parallel <- cfa_nl("
  UNIV =~ 1*ipeqopt + 1*ipudrst + 1*impenv
  ipeqopt ~~ e*ipeqopt
  ipudrst ~~ e*ipudrst
  impenv ~~ e*impenv
  ipeqopt ~ i*1
  ipudrst ~ i*1
  impenv ~ i*1
")
univ <- list(congeneric = universalism_congeneric, tau = universalism_tau,
             parallel = universalism_parallel, strict = universalism_strictly_parallel)
compFit.universalism <- compareFit(   # the congeneric model has df = 0: nothing to compare against
  tau = universalism_tau,
  parallel = universalism_parallel, strictly_parallel = universalism_strictly_parallel,
  argsLRT = list(method = "satorra.bentler.2001"))
# which equality breaks the strictly parallel model? the score test for each constraint
univ_score <- lavTestScore(universalism_strictly_parallel)$uni %>% as_tibble() %>% arrange(-X2) %>%
  left_join(parTable(universalism_strictly_parallel) %>% select(plabel, lhs_item = lhs, op_par = op), by = c("lhs" = "plabel")) %>%
  left_join(parTable(universalism_strictly_parallel) %>% select(plabel, rhs_item = lhs), by = c("rhs" = "plabel")) %>%
  transmute(par = paste(lhs_item, if_else(op_par == "~1", "intercept", "variance")), with = rhs_item, X2 = round(X2, 3), p = p.value)
universalism_strict_partial <- cfa_nl("
  UNIV =~ 1*ipeqopt + 1*ipudrst + 1*impenv
  ipeqopt ~~ e*ipeqopt
  ipudrst ~~ e*ipudrst
  impenv ~~ e*impenv
  ipeqopt ~ i*1
  ipudrst ~ 1
  impenv ~ i*1
")
item_means <- NL2 %>% summarise(across(c(ipmodst, imptrad, ipfrule, ipbhprp, ipeqopt, ipudrst, impenv),
                                      \(x) round(mean(x, na.rm = T), 4)))

# ---- reliability: alpha and omega ---------------------------------------------------------
rel <- function(fit) round(unname(unlist(compRelSEM(fit))), 4)
rel_tau <- function(fit) round(unname(unlist(compRelSEM(fit, tau.eq = TRUE))), 4)
reliability <- list(
  trco = list(omega_congeneric = rel(tradition_conformity_congeneric), alpha = rel_tau(tradition_conformity_congeneric),
              omega_tau = rel(tradition_conformity_tau)),
  univ = list(omega_congeneric = rel(universalism_congeneric), alpha = rel_tau(universalism_congeneric),
              omega_tau = rel(universalism_tau))
)
# omega by hand, with labels and := (after the course's MODEL CONSTRAINT)
omega_fit <- cfa_nl("
  TRCO =~ NA*ipmodst + l1*ipmodst + l2*imptrad + l3*ipfrule + l4*ipbhprp
  TRCO ~~ 1*TRCO
  ipmodst ~~ e1*ipmodst
  imptrad ~~ e2*imptrad
  ipfrule ~~ e3*ipfrule
  ipbhprp ~~ e4*ipbhprp
  omega := (l1 + l2 + l3 + l4)^2 / ((l1 + l2 + l3 + l4)^2 + e1 + e2 + e3 + e4)
")
omega_def <- parameterEstimates(omega_fit) %>% filter(op == ":=") %>% transmute(est = round(est, 4), se = round(se, 4))

# ---- identification by hand: three items, one factor ----------------------------------------
# just identified: the standardized loadings follow from the three correlations alone
S_univ <- lavInspect(universalism_congeneric, "sampstat")$cov
R_univ <- cov2cor(S_univ)
by_hand <- list(
  r = unname(round(R_univ, 4)), items = rownames(R_univ),
  lambda = round(c(sqrt(R_univ[1, 2] * R_univ[1, 3] / R_univ[2, 3]),
                   sqrt(R_univ[1, 2] * R_univ[2, 3] / R_univ[1, 3]),
                   sqrt(R_univ[1, 3] * R_univ[2, 3] / R_univ[1, 2])), 4),
  lavaan = parameterEstimates(universalism_congeneric, standardized = TRUE) %>% filter(op == "=~") %>% pull(std.all) %>% round(4)
)

# ---- the information matrix: correlations of the estimates ------------------------------------
max_cor <- function(fit) {
  r <- cov2cor(lavInspect(fit, "vcov")); diag(r) <- 0
  k <- which(abs(r) == max(abs(r)), arr.ind = TRUE)[1, ]
  list(r = round(r[k[1], k[2]], 3), a = rownames(r)[k[1]], b = colnames(r)[k[2]])
}
# ---- the simultaneous CFA: values and attitudes toward immigration ---------------------------
model_scfa <- "
  TRCO  =~ ipmodst + imptrad + ipfrule + ipbhprp
  UNIV  =~ ipeqopt + ipudrst + impenv
  ALLOW =~ imsmetn + imdfetn + impcntr
"
values_immigration_fit <- cfa_nl(model_scfa)
separate <- list(trco = tradition_conformity_congeneric, univ = universalism_congeneric,
                 allow = cfa_nl("ALLOW =~ imsmetn + imdfetn + impcntr"))
mi_scfa <- modificationindices(values_immigration_fit, standardized = T, sort. = T) %>%
  as_tibble() %>% filter(op %in% c("=~", "~~")) %>% head(10) %>%
  transmute(lhs, op, rhs, mi = round(mi, 3), epc = round(epc, 3), sepc = round(sepc.all, 3))
top_cross <- mi_scfa %>% filter(op == "=~") %>% slice(1)
top_cov <- mi_scfa %>% filter(op == "~~") %>% slice(1)
values_immigration_fit_cross <- cfa_nl(paste0(model_scfa, "\n", top_cross$lhs, " =~ ", top_cross$rhs))
values_immigration_fit_cov <- cfa_nl(paste0(model_scfa, "\n", top_cov$lhs, " ~~ ", top_cov$rhs))
compFit.scfa <- compareFit(scfa = values_immigration_fit, cross = values_immigration_fit_cross,
                           argsLRT = list(method = "satorra.bentler.2001"))
factor_cor <- lavInspect(values_immigration_fit, "std")$psi
resid_z <- lavResiduals(values_immigration_fit)$cov.z
top_resid <- which(abs(resid_z) > 2 & lower.tri(resid_z), arr.ind = TRUE)
top_resid <- tibble(a = rownames(resid_z)[top_resid[, 1]], b = colnames(resid_z)[top_resid[, 2]], z = round(resid_z[top_resid], 2)) %>% arrange(-abs(z))

# ---- the studio's sample: complete answers on all course variables, plain ML ------------------
NL2_studio <- NL2 %>%
  mutate(agea = 2004 - yrbrn, female = as.numeric(gndr == 2)) %>%
  drop_na(ipcrtiv:impfun, imsmetn:impcntr, imbgeco, imueclt, imwbcnt, agea, female, eduyrs)
studio_fit <- cfa(model = model_scfa, data = NL2_studio, estimator = "ML")
studio <- list(n = nrow(NL2_studio), fit = as.list(round(fitMeasures(studio_fit, c("chisq", "df", "cfi", "rmsea", "srmr")), 3)),
               mi = modificationindices(studio_fit, sort. = T) %>% filter(op %in% c("=~", "~~")) %>% head(4) %>%
                 transmute(lhs, op, rhs, mi = round(mi, 2)))
day3 <- list(
  source = "ESS round 2 (2004), the Netherlands (course file NL2.sav); value items reversed, allow items reversed (higher = allow more) with sjmisc::rec(rec = \"rev\"); lavaan 0.6-21, MLR, missing = \"fiml.x\"",
  versions = list(lavaan = as.character(packageVersion("lavaan")), semTools = as.character(packageVersion("semTools"))),
  n = nobs(tradition_conformity_congeneric), item_means = item_means,
  trco = list(fits = lapply(trco, fit_of), estimates = lapply(trco, est_of),
              tau_adapted = fit_of(tradition_conformity_tau_adapted), tau_adapted_est = est_of(tradition_conformity_tau_adapted),
              tau2_same = isTRUE(all.equal(fitMeasures(tradition_conformity_tau, "chisq.scaled"), fitMeasures(tradition_conformity_tau2, "chisq.scaled"))),
              tau2_est = est_of(tradition_conformity_tau2),
              lrt = list(tau = lrt(tradition_conformity_congeneric, tradition_conformity_tau),
                         parallel = lrt(tradition_conformity_tau, tradition_conformity_parallel),
                         strict = lrt(tradition_conformity_parallel, tradition_conformity_strictly_parallel),
                         adapted = lrt(tradition_conformity_congeneric, tradition_conformity_tau_adapted)),
              compare_text = out_text(summary(object = compFit.tradition_conformity, fit.measures = cmp_fm)),
              strict_summary = out_text(summary(object = tradition_conformity_strictly_parallel, fit.measures = T, standardized = T))),
  univ = list(fits = lapply(univ, fit_of), estimates = lapply(univ, est_of),
              lrt = list(tau = lrt(universalism_congeneric, universalism_tau),
                         parallel = lrt(universalism_tau, universalism_parallel),
                         strict = lrt(universalism_parallel, universalism_strictly_parallel)),
              compare_text = out_text(summary(object = compFit.universalism, fit.measures = cmp_fm))),
  reliability = reliability, omega_def = omega_def, by_hand = by_hand,
  univ_score = univ_score,
  univ_plabels = parTable(universalism_strictly_parallel) %>% filter(op == "~1", lhs %in% c("ipeqopt", "ipudrst", "impenv")) %>% transmute(item = lhs, plabel),
  univ_release = map(c("ipeqopt", "ipudrst", "impenv"), \(it) {
    m <- paste0("UNIV =~ 1*ipeqopt + 1*ipudrst + 1*impenv\n", paste0(c("ipeqopt", "ipudrst", "impenv"), " ~~ e*", c("ipeqopt", "ipudrst", "impenv"), collapse = "\n"), "\n",
                paste0(c("ipeqopt", "ipudrst", "impenv"), ifelse(c("ipeqopt", "ipudrst", "impenv") == it, " ~ 1", " ~ i*1"), collapse = "\n"))
    list(item = it, chisq = round(fitMeasures(cfa_nl(m), "chisq.scaled")[[1]], 3))
  }),
  n_scfa = lavInspect(values_immigration_fit, "nobs"), univ_strict_partial = fit_of(universalism_strict_partial),
  univ_strict_partial_lrt = lrt(universalism_parallel, universalism_strict_partial),
  vcov_max = list(trco = max_cor(tradition_conformity_congeneric), scfa = max_cor(values_immigration_fit)),
  scfa = list(fit = fit_of(values_immigration_fit), estimates = est_of(values_immigration_fit),
              separate = lapply(separate, fit_of),
              resid = top_resid, n_resid = nrow(top_resid),
              factor_cor = list(names = rownames(factor_cor), values = unname(round(unclass(factor_cor), 4))),
              summary = out_text(summary(object = values_immigration_fit, fit.measures = T, standardized = T)),
              mi = mi_scfa, mi_text = out_text(modificationindices(values_immigration_fit, standardized = T, sort. = T) %>% head(10)),
              cross = list(par = paste(top_cross$lhs, "=~", top_cross$rhs), fit = fit_of(values_immigration_fit_cross),
                           est = est_of(values_immigration_fit_cross) %>% filter(lhs == top_cross$lhs, rhs == top_cross$rhs),
                           lrt = lrt(values_immigration_fit, values_immigration_fit_cross)),
              cov = list(par = paste(top_cov$lhs, "~~", top_cov$rhs), fit = fit_of(values_immigration_fit_cov),
                         lrt = lrt(values_immigration_fit, values_immigration_fit_cov)),
              compare_text = out_text(summary(object = compFit.scfa, fit.measures = cmp_fm))),
  studio = studio
)
write_json(day3, "public/data/day3.json", auto_unbox = TRUE, digits = NA, pretty = FALSE, na = "null")
cat("written: public/data/day3.json\n")
print(sapply(day3$trco$fits, \(f) unlist(f[c("chisq.scaled", "df", "cfi.robust", "rmsea.robust", "srmr")])))
print(sapply(day3$univ$fits, \(f) unlist(f[c("chisq.scaled", "df", "cfi.robust", "rmsea.robust", "srmr")])))
print(day3$trco$lrt); print(day3$univ$lrt); print(reliability); print(omega_def); print(by_hand)
print(unlist(day3$scfa$fit)); print(mi_scfa); print(day3$scfa$cross$est); print(day3$scfa$cross$lrt); print(day3$scfa$cov$lrt)
print(round(factor_cor, 3)); print(univ_score); print(unlist(day3$univ_strict_partial)); print(day3$vcov_max); print(day3$univ_plabels); print(day3$univ_release); print(day3$n_scfa); print(top_resid)
