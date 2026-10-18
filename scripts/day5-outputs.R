# ---------------------------------------------------------------------------
# η Lab · Day 5: the R outputs the interactive script shows
#
# Latent means and beyond one factor, after the course's Day 5 slides (Essex 2024), the active
# session, the consolidation task, the R code Day 5 and the higher-order example: latent means
# against sum scores, the modification cascade (and whether it replicates), alignment, a
# second-order factor, a bifactor model, a multitrait-multimethod model, and the week-1 probe
# (two values across the Benelux). ESS round 2; MLR and FIML as on Days 1–4. Model output only;
# the MTMM data are simulated from a population model (as in the studio).
#
# Run from the app folder:  Rscript scripts/day5-outputs.R
# ---------------------------------------------------------------------------
suppressPackageStartupMessages({
  library(tidyverse); library(sjlabelled); library(sjmisc)
  library(lavaan); library(semTools); library(sirt); library(jsonlite)
})

dir <- "../../../Lugano 2025/Lugano2025Code/"
read_country <- function(f) read_spss(paste0(dir, f), convert.factors = F, drop.labels = T) %>%
  mutate(across(ipcrtiv:impfun, \(x) rec(x, rec = "rev")),
         across(imsmetn:impcntr, \(x) rec(x, rec = "rev")))   # allow items: higher = allow more
BE2 <- read_country("BE2.sav"); LU2 <- read_country("LU2.sav"); NL2 <- read_country("NL2.sav")
ESS <- bind_rows(BE2, LU2, NL2)
groups <- c("BE", "LU", "NL")

out_text <- function(expr) paste(capture.output(expr), collapse = "\n")
FM <- c("chisq.scaled", "df", "pvalue.scaled", "cfi.robust", "tli.robust", "rmsea.robust", "srmr", "aic", "bic")
fit_of <- function(fit) as.list(round(fitMeasures(fit, FM), 4))
std_of <- function(fit) parameterEstimates(fit, standardized = TRUE) %>% filter(op %in% c("=~", "~~", "~1")) %>%
  transmute(lhs, op, rhs, group = if ("group" %in% names(.)) group else 1L, est = round(est, 4), se = round(se, 4), std = round(std.all, 4))
lrt <- function(a, b) { l <- lavTestLRT(a, b, method = "satorra.bentler.2001")
  list(dchisq = round(l$`Chisq diff`[2], 4), ddf = l$`Df diff`[2], p = l$`Pr(>Chisq)`[2]) }
cmp_fm <- c("chisq.scaled", "df.scaled", "pvalue.scaled", "rmsea.robust", "cfi.robust", "tli.robust", "srmr", "aic", "bic")
trco <- "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp"
items <- c("ipmodst", "imptrad", "ipfrule", "ipbhprp")

# ---- 1 · latent means against the mean score ------------------------------------------------
score <- ESS %>% mutate(trco_score = rowMeans(across(all_of(items)), na.rm = TRUE)) %>%
  filter(!is.na(trco_score))
score_means <- score %>% group_by(cntry) %>% summarise(n = n(), mean = round(mean(trco_score), 4), sd = round(sd(trco_score), 4))
t_be_nl <- t.test(trco_score ~ cntry, data = score %>% filter(cntry %in% c("BE", "NL")))
d_be_nl <- (score_means$mean[3] - score_means$mean[1]) / sqrt((score_means$sd[1]^2 + score_means$sd[3]^2) / 2)
lat <- function(released) {
  fit <- \(...) cfa(trco, data = ESS, group = "cntry", group.equal = c("loadings", "intercepts"), group.partial = released,
                    estimator = "MLR", missing = "fiml.x", ...)
  std <- parameterEstimates(fit(std.lv = TRUE)) %>% filter(op == "~1", lhs == "TRCO") %>% transmute(group = groups[group], std = round(est, 4), se = round(se, 4), p = pvalue)
  eff <- parameterEstimates(fit(effect.coding = TRUE)) %>% filter(op == "~1", lhs == "TRCO") %>% transmute(group = groups[group], eff = round(est, 4))
  list(fit = fit_of(fit()), means = left_join(std, eff, by = "group"))
}
latent <- list(scalar = lat(character(0)), partial = lat(c("ipfrule~1", "ipmodst~1")))
# the item means: where the sum score and the latent mean part ways
item_means <- ESS %>% group_by(cntry) %>% summarise(across(all_of(items), \(x) round(mean(x, na.rm = T), 4)))

# ---- 2 · the modification cascade, and whether it replicates ---------------------------------
two <- "
  TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp
  UNIV =~ ipeqopt + ipudrst + impenv
"
fit_scalar2 <- function(data, model, free) cfa(model = model, data = data, group = "cntry", group.equal = c("loadings", "intercepts"),
  group.partial = free, estimator = "MLR", missing = "fiml.x")
cascade <- function(data, steps = 6) {
  model <- two; free <- character(0); cur <- fit_scalar2(data, model, free)
  rows <- list(list(step = 0, what = "the scalar two-factor model", kind = "start", fit = fit_of(cur)))
  for (k in seq_len(steps)) {
    mi <- modindices(cur, sort. = TRUE) %>% filter(op %in% c("=~", "~~"), lhs != rhs) %>% head(1)
    st <- lavTestScore(cur)$uni %>% as_tibble() %>% arrange(-X2) %>% head(1)
    pt <- parTable(cur)
    if (nrow(st) && st$X2 > mi$mi) {
      p <- pt[pt$plabel == st$lhs, ]
      par <- if (p$op == "~1") paste0(p$lhs, "~1") else paste0(p$lhs, "=~", p$rhs)
      free <- c(free, par); what <- paste0("release the equality of ", if (p$op == "~1") paste0("the intercept of ", p$lhs) else paste0("the loading of ", p$rhs)); kind <- "release"; size <- st$X2
    } else {
      line <- paste0(mi$lhs, " ", mi$op, " ", mi$rhs)
      model <- paste0(model, "\n  ", line); what <- paste0("add ", line, " (in all groups)"); kind <- if (mi$op == "=~") "cross-loading" else "error covariance"; size <- mi$mi
    }
    cur <- fit_scalar2(data, model, free)
    rows[[k + 1]] <- list(step = k, what = what, kind = kind, index = round(size, 2), fit = fit_of(cur), model = model, free = free)
  }
  rows
}
casc <- cascade(ESS)
casc_final <- list(model = casc[[length(casc)]]$model, free = casc[[length(casc)]]$free)
# replication: find the cascade in one random half of every country, test the same steps in the other half
set.seed(2027)
ESS_split <- ESS %>% group_by(cntry) %>% mutate(half = sample(rep(c("A", "B"), length.out = n()))) %>% ungroup()
casc_a <- cascade(ESS_split %>% filter(half == "A"))
replicate_in <- function(data, steps) map(steps, \(s) {
  f <- if (s$step == 0) fit_scalar2(data, two, character(0)) else fit_scalar2(data, s$model, s$free)
  list(step = s$step, what = s$what, fit = fit_of(f))
})
casc_b <- replicate_in(ESS_split %>% filter(half == "B"), casc_a)

# ---- 3 · alignment: the countries' means without full scalar invariance -------------------------
config_std <- cfa(trco, data = ESS, group = "cntry", estimator = "MLR", missing = "fiml.x", std.lv = TRUE)
pe <- parameterEstimates(config_std)
lambda <- pe %>% filter(op == "=~") %>% select(group, rhs, est) %>% pivot_wider(names_from = rhs, values_from = est) %>% select(-group) %>% as.matrix()
nu <- pe %>% filter(op == "~1", lhs %in% items) %>% select(group, lhs, est) %>% pivot_wider(names_from = lhs, values_from = est) %>% select(-group) %>% as.matrix()
rownames(lambda) <- rownames(nu) <- groups
aligned <- invariance.alignment(lambda = lambda, nu = nu, wgt = matrix(sqrt(lavInspect(config_std, "nobs")), 3, 4))
alignment <- list(means = round(aligned$pars[, "alpha0"], 4), variances = round(aligned$pars[, "psi0"], 4),
                  r2 = round(aligned$es.invariance["R2", ], 4),
                  lambda_aligned = round(aligned$lambda.aligned, 4), nu_aligned = round(aligned$nu.aligned, 4),
                  lambda_config = round(lambda, 4), nu_config = round(nu, 4))

# ---- 4 · a second-order factor: conservation in Belgium -------------------------------------------
# Schwartz's higher-order value conservation: tradition, conformity and security. In Belgium the three
# first-order factors are distinct; in the Netherlands tradition and conformity correlate above 1 —
# the reason the course measures them as one factor (TRCO).
conservation_model <- "
  Tradition  =~ imptrad + ipmodst
  Conformity =~ ipfrule + ipbhprp
  Security   =~ impsafe + ipstrgv
"
conservation_first <- cfa(model = conservation_model, data = BE2, estimator = "MLR", missing = "fiml.x")
conservation_second <- cfa(model = paste0(conservation_model, "  Conservation =~ Tradition + Conformity + Security\n"),
  data = BE2, estimator = "MLR", missing = "fiml.x")
conservation_nl <- cfa(model = conservation_model, data = NL2, estimator = "MLR", missing = "fiml.x")
higher <- list(
  first = list(fit = fit_of(conservation_first), cor = unname(round(unclass(lavInspect(conservation_first, "std")$psi), 4))),
  second = list(fit = fit_of(conservation_second), est = std_of(conservation_second),
                r2 = round(lavInspect(conservation_second, "r2")[c("Tradition", "Conformity", "Security")], 4),
                disturbance = parameterEstimates(conservation_second) %>% filter(op == "~~", lhs %in% c("Tradition", "Conformity", "Security"), lhs == rhs) %>%
                  transmute(factor = lhs, est = round(est, 4), se = round(se, 4), p = round(pvalue, 3)),
                summary = out_text(summary(object = conservation_second, fit.measures = T, standardized = T))),
  nl = list(fit = fit_of(conservation_nl), cor = unname(round(unclass(lavInspect(conservation_nl, "std")$psi), 4)),
            warning = local({ w <- character(0)
              withCallingHandlers(cfa(model = conservation_model, data = NL2, estimator = "MLR", missing = "fiml.x"),
                                  warning = \(x) { w <<- c(w, conditionMessage(x)); invokeRestart("muffleWarning") })
              paste(w[!grepl("empty", w)], collapse = "\n") }))
)

# ---- 5 · a bifactor model: one general attitude, three facets -----------------------------------
facets <- "
  UNIV  =~ ipeqopt + ipudrst + impenv
  ALLOW =~ imsmetn + imdfetn + impcntr
  EFFECTS =~ imbgeco + imueclt + imwbcnt
"
correlated_fit <- cfa(model = facets, data = NL2, estimator = "MLR", missing = "fiml.x", std.lv = T)
bifactor_fit <- cfa(model = paste0("
  GENERAL =~ ipeqopt + ipudrst + impenv + imsmetn + imdfetn + impcntr + imbgeco + imueclt + imwbcnt", facets),
  data = NL2, estimator = "MLR", missing = "fiml.x", std.lv = T, orthogonal = T)
bstd <- parameterEstimates(bifactor_fit, standardized = TRUE) %>% filter(op == "=~")
g <- bstd %>% filter(lhs == "GENERAL"); spec <- bstd %>% filter(lhs != "GENERAL")
theta_b <- parameterEstimates(bifactor_fit, standardized = TRUE) %>% filter(op == "~~", lhs == rhs, lhs %in% g$rhs)
total_var <- sum(g$std.all)^2 + sum(map_dbl(unique(spec$lhs), \(f) sum(spec$std.all[spec$lhs == f])^2)) + sum(theta_b$std.all)
bifactor <- list(fit = fit_of(bifactor_fit), correlated = fit_of(correlated_fit),
                 cor = unname(round(unclass(lavInspect(correlated_fit, "std")$psi), 4)),
                 general = g %>% transmute(item = rhs, std = round(std.all, 4)),
                 specific = spec %>% transmute(factor = lhs, item = rhs, std = round(std.all, 4)),
                 omega_h = round(sum(g$std.all)^2 / total_var, 4), omega_total = round(1 - sum(theta_b$std.all) / total_var, 4),
                 lrt = lrt(correlated_fit, bifactor_fit),
                 omega_h_raw = round(unname(unlist(compRelSEM(bifactor_fit, true = list(GENERAL = "GENERAL"), obs.var = FALSE)))[1], 4))

# ---- 6 · multitrait-multimethod: the studio's simulated data -------------------------------------
set.seed(2028)
mtmm_pop <- '
Parl =~ 0.75*parl_a + 0.7*parl_b + 0.7*parl_c
Legal =~ 0.75*legal_a + 0.7*legal_b + 0.7*legal_c
Police =~ 0.75*police_a + 0.7*police_b + 0.7*police_c
Scale11 =~ 0.35*parl_a + 0.35*legal_a + 0.35*police_a
Agree4 =~ 0.45*parl_b + 0.45*legal_b + 0.45*police_b
Scale5 =~ 0.3*parl_c + 0.3*legal_c + 0.3*police_c
Parl ~~ 1*Parl; Legal ~~ 1*Legal; Police ~~ 1*Police; Scale11 ~~ 1*Scale11; Agree4 ~~ 1*Agree4; Scale5 ~~ 1*Scale5
Parl ~~ 0.6*Legal + 0.45*Police; Legal ~~ 0.55*Police
Scale11 ~~ 0*Parl + 0*Legal + 0*Police + 0*Agree4 + 0*Scale5; Agree4 ~~ 0*Parl + 0*Legal + 0*Police + 0*Scale5; Scale5 ~~ 0*Parl + 0*Legal + 0*Police
'
mtmm <- simulateData(mtmm_pop, sample.nobs = 1000, standardized = TRUE)
traits_only <- "
  Parl   =~ parl_a + parl_b + parl_c
  Legal  =~ legal_a + legal_b + legal_c
  Police =~ police_a + police_b + police_c
"
ctcm <- paste0(traits_only, "
  Scale11 =~ parl_a + legal_a + police_a
  Agree4  =~ parl_b + legal_b + police_b
  Scale5  =~ parl_c + legal_c + police_c
  Scale11 ~~ 0*Parl + 0*Legal + 0*Police + 0*Agree4 + 0*Scale5
  Agree4  ~~ 0*Parl + 0*Legal + 0*Police + 0*Scale5
  Scale5  ~~ 0*Parl + 0*Legal + 0*Police
")
cu <- paste0(traits_only, "
  parl_a ~~ legal_a + police_a
  legal_a ~~ police_a
  parl_b ~~ legal_b + police_b
  legal_b ~~ police_b
  parl_c ~~ legal_c + police_c
  legal_c ~~ police_c
")
mt <- list(traits = cfa(traits_only, data = mtmm, std.lv = T), ctcm = cfa(ctcm, data = mtmm, std.lv = T), cu = cfa(cu, data = mtmm, std.lv = T))
ctcm_true <- cfa(sub("  Scale11 ~~ 0\\*Parl.*", "", ctcm) %>% paste0("\n  Scale11 ~~ 0*Parl + 0*Legal + 0*Police\n  Agree4 ~~ 0*Parl + 0*Legal + 0*Police\n  Scale5 ~~ 0*Parl + 0*Legal + 0*Police\n"), data = mtmm, std.lv = T)
mtmm_out <- list(
  fits = lapply(mt, \(f) as.list(round(fitMeasures(f, c("chisq", "df", "pvalue", "cfi", "tli", "rmsea", "srmr", "aic", "bic")), 4))),
  trait_cor = lapply(mt, \(f) round(lavInspect(f, "std")$psi[c("Parl", "Legal", "Police"), c("Parl", "Legal", "Police")][lower.tri(diag(3))], 4)),
  ctcm_std = std_of(mt$ctcm) %>% filter(op == "=~"),
  r = unname(round(cor(mtmm), 3)), names = names(mtmm),
  true_cor = c(0.6, 0.45, 0.55),
  ctcm_true = list(fit = as.list(round(fitMeasures(ctcm_true, c("chisq", "df", "cfi", "rmsea")), 4)),
                   trait_cor = round(lavInspect(ctcm_true, "std")$psi[c("Parl", "Legal", "Police"), c("Parl", "Legal", "Police")][lower.tri(diag(3))], 4),
                   method_cor = round(lavInspect(ctcm_true, "std")$psi[c("Scale11", "Agree4", "Scale5"), c("Scale11", "Agree4", "Scale5")][lower.tri(diag(3))], 4))
)
# a method factor for one instrument: all 21 PVQ items, four higher values, equal method loadings
values21 <- "
  OPENNESS      =~ ipcrtiv + impfree + impdiff + ipadvnt + ipgdtim + impfun
  ENHANCEMENT   =~ imprich + iprspot + ipshabt + ipsuces
  CONSERVATION  =~ impsafe + ipstrgv + ipfrule + ipbhprp + imptrad + ipmodst
  TRANSCENDENCE =~ ipeqopt + ipudrst + impenv + iphlppl + iplylfr
"
values21_items <- c("ipcrtiv", "impfree", "impdiff", "ipadvnt", "ipgdtim", "impfun", "imprich", "iprspot", "ipshabt", "ipsuces",
                    "impsafe", "ipstrgv", "ipfrule", "ipbhprp", "imptrad", "ipmodst", "ipeqopt", "ipudrst", "impenv", "iphlppl", "iplylfr")
values21_method <- paste0(values21, "  METHOD =~ ", paste0("m*", values21_items, collapse = " + "),
                          "\n  METHOD ~~ 0*OPENNESS + 0*ENHANCEMENT + 0*CONSERVATION + 0*TRANSCENDENCE\n")
vf0 <- cfa(values21, data = NL2, estimator = "MLR", missing = "fiml.x", std.lv = T)
vf1 <- cfa(values21_method, data = NL2, estimator = "MLR", missing = "fiml.x", std.lv = T)
method_factor <- list(
  without = list(fit = fit_of(vf0), cor = unname(round(unclass(lavInspect(vf0, "std")$psi), 4))),
  with = list(fit = fit_of(vf1), cor = unname(round(unclass(lavInspect(vf1, "std")$psi[1:4, 1:4]), 4)),
              loadings = round(range(parameterEstimates(vf1, standardized = TRUE) %>% filter(lhs == "METHOD", op == "=~") %>% pull(std.all)), 4)),
  names = c("OPENNESS", "ENHANCEMENT", "CONSERVATION", "TRANSCENDENCE"))

# ---- 7 · the week-1 probe: attitudes toward immigration across the Benelux ---------------------------
attitudes <- "
  ALLOW   =~ imsmetn + imdfetn + impcntr
  EFFECTS =~ imbgeco + imueclt + imwbcnt
"
probe_base <- ESS %>% split(as.factor(.$cntry)) %>% map(~ cfa(model = attitudes, data = ., estimator = "MLR", missing = "fiml.x"))
probe_fit <- function(eq = character(0), released = character(0), ...) cfa(model = attitudes, data = ESS, group = "cntry", group.equal = eq,
  group.partial = released, estimator = "MLR", missing = "fiml.x", ...)
probe <- list(config = probe_fit(), metric = probe_fit("loadings"), scalar = probe_fit(c("loadings", "intercepts")))
score_probe <- lavTestScore(probe$scalar)$uni %>% as_tibble() %>% arrange(-X2) %>%
  left_join(parTable(probe$scalar) %>% select(plabel, plhs = lhs, par_op = op, prhs = rhs), by = c("lhs" = "plabel")) %>% mutate(item = if_else(par_op == "=~", prhs, plhs))
probe_release <- c("imbgeco~1", "imsmetn~1")
probe$partial <- probe_fit(c("loadings", "intercepts"), probe_release)
omega_by_country <- map(probe_base, \(f) round(unlist(compRelSEM(f)), 4))
probe_means <- parameterEstimates(probe_fit(c("loadings", "intercepts"), probe_release, std.lv = TRUE)) %>% filter(op == "~1", lhs %in% c("ALLOW", "EFFECTS")) %>%
  transmute(factor = lhs, group = groups[group], std = round(est, 4), p = pvalue)
probe_compare <- compareFit(scalar = probe$partial, metric = probe$metric, config = probe$config, argsLRT = list(method = "satorra.bentler.2001"))
# the Day 3 element: is ALLOW tau-equivalent in the Netherlands?
allow_nl <- list(congeneric = cfa("ALLOW =~ imsmetn + imdfetn + impcntr", data = NL2, estimator = "MLR", missing = "fiml.x"),
                 tau = cfa("ALLOW =~ 1*imsmetn + 1*imdfetn + 1*impcntr", data = NL2, estimator = "MLR", missing = "fiml.x"))

day5 <- list(
  source = "ESS round 2 (2004), Belgium, Luxembourg, the Netherlands (course files BE2/LU2/NL2.sav); value items reversed, allow items reversed (higher = allow more) with sjmisc::rec(rec = \"rev\"); lavaan 0.6-21, MLR, missing = \"fiml.x\"; sirt for alignment; MTMM data simulated (seed 2028)",
  versions = list(lavaan = as.character(packageVersion("lavaan")), semTools = as.character(packageVersion("semTools")), sirt = as.character(packageVersion("sirt"))),
  groups = groups,
  means = list(score = score_means, item_means = item_means,
               t = list(t = round(unname(t_be_nl$statistic), 3), df = round(unname(t_be_nl$parameter), 1), p = t_be_nl$p.value, d = round(d_be_nl, 4)),
               latent = latent),
  cascade = list(full = casc %>% map(\(r) r[c("step", "what", "kind", "index", "fit")]),
                 half_a = casc_a %>% map(\(r) r[c("step", "what", "kind", "index", "fit")]), half_b = casc_b),
  alignment = alignment,
  higher = higher, bifactor = bifactor, mtmm = mtmm_out,
  probe = list(base = lapply(probe_base, fit_of), fits = lapply(probe, fit_of),
               lrt = list(metric = lrt(probe$config, probe$metric), scalar = lrt(probe$metric, probe$scalar), partial = lrt(probe$metric, probe$partial)),
               score = score_probe %>% head(8) %>% transmute(item, op = par_op, X2 = round(X2, 2)), released = probe_release,
               omega = omega_by_country, means = probe_means,
               tau = list(fit = fit_of(allow_nl$tau), lrt = list(dchisq = round(fitMeasures(allow_nl$tau, "chisq.scaled")[[1]], 4), ddf = 2, p = fitMeasures(allow_nl$tau, "pvalue.scaled")[[1]])),
               compare_text = out_text(summary(object = probe_compare, fit.measures = cmp_fm))),
  cascade_final = casc_final, method_factor = method_factor
)
write_json(day5, "public/data/day5.json", auto_unbox = TRUE, digits = NA, pretty = FALSE, na = "null")
cat("written: public/data/day5.json\n")
print(score_means); print(day5$means$t); print(latent$scalar$means); print(latent$partial$means)
walk(casc, \(r) cat(r$step, r$what, unlist(r$fit[c("chisq.scaled", "df", "cfi.robust")]), "\n"))
cat("half A / B\n"); walk2(casc_a, casc_b, \(a, b) cat(a$step, a$what, a$fit$chisq.scaled, "|", b$fit$chisq.scaled, "\n"))
print(alignment$means); print(alignment$r2)
print(unlist(higher$first$fit[c("chisq.scaled", "df", "cfi.robust")])); print(higher$first$cor); print(higher$second$est %>% filter(op == "=~", lhs == "Conservation")); print(higher$nl$cor); cat(higher$nl$warning, "\n")
print(unlist(bifactor$fit[c("chisq.scaled", "df", "cfi.robust")])); print(unlist(bifactor$correlated[c("chisq.scaled", "df", "cfi.robust")])); print(bifactor[c("omega_h", "omega_total")])
print(sapply(mtmm_out$fits, unlist)); print(mtmm_out$trait_cor)
print(sapply(day5$probe$fits, \(f) unlist(f[c("chisq.scaled", "df", "cfi.robust", "rmsea.robust")]))); print(day5$probe$score); print(omega_by_country); print(probe_means); print(day5$probe$tau); print(sapply(day5$probe$base, \(f) unlist(f[c("chisq.scaled", "df", "cfi.robust", "rmsea.robust")]))); print(mtmm_out$ctcm_true); print(method_factor$with$fit$cfi.robust); print(bifactor$omega_h_raw); print(higher$second$disturbance); cat(casc_final$model, casc_final$free, "\n")
