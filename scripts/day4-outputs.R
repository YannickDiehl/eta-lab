# ---------------------------------------------------------------------------
# η Lab · Day 4: the R outputs the interactive script shows
#
# The course's measurement invariance procedure (Lugano 2025 code documentation, Essex 2023 R
# code Day 4, worksheet Day 4) on ESS round 2: tradition/conformity in Belgium, Luxembourg and
# the Netherlands. Same pipeline as Days 1–2 (sjlabelled/sjmisc, lavaan with MLR and FIML,
# semTools::compareFit). Belgium is the first group, so it is the reference group — as in the
# studio. Aggregates and model output only.
#
# Run from the app folder:  Rscript scripts/day4-outputs.R
# ---------------------------------------------------------------------------
suppressPackageStartupMessages({
  library(tidyverse); library(sjlabelled); library(sjmisc)
  library(lavaan); library(semTools); library(jsonlite)
})

dir <- "../../../Lugano 2025/Lugano2025Code/"
read_country <- function(f) read_spss(paste0(dir, f), convert.factors = F, drop.labels = T) %>%
  mutate(across(ipcrtiv:impfun, \(x) rec(x, rec = "rev")))
BE2 <- read_country("BE2.sav"); LU2 <- read_country("LU2.sav"); NL2 <- read_country("NL2.sav")
ESS <- bind_rows(BE2, LU2, NL2)
ESS_countries <- ESS %>% split(as.factor(.$cntry))

items <- c("ipmodst", "imptrad", "ipfrule", "ipbhprp")
groups <- c("BE", "LU", "NL")
model <- "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp"
out_text <- function(expr) paste(capture.output(expr), collapse = "\n")
FM <- c("chisq", "df", "chisq.scaled", "df.scaled", "pvalue.scaled", "chisq.scaling.factor",
        "cfi.robust", "tli.robust", "rmsea.robust", "cfi.scaled", "rmsea.scaled", "srmr", "aic", "bic")
fit_of <- function(fit) as.list(round(fitMeasures(fit, FM), 4))
est_of <- function(fit) parameterEstimates(fit, standardized = TRUE) %>%
  filter(op %in% c("=~", "~1", "~~")) %>%
  transmute(lhs, op, rhs, group = if ("group" %in% names(.)) group else 1L, est, se, z, pvalue, std = std.all)

# --- descriptives per country ---------------------------------------------------------
desc <- lapply(groups, \(g) {
  d <- ESS_countries[[g]]
  list(group = g, n = nrow(d), items = lapply(items, \(v) {
    x <- d[[v]]
    list(item = v, counts = as.integer(sapply(1:6, \(k) sum(x == k, na.rm = TRUE))), missing = sum(is.na(x)),
         mean = round(mean(x, na.rm = TRUE), 4), sd = round(sd(x, na.rm = TRUE), 4))
  }))
})

# --- step 1: the measurement model in each country -------------------------------------
tradition_conformity_fit_countries <- ESS_countries %>%
  map(~ cfa(model = model, data = ., estimator = "MLR", missing = "fiml.x"))
baseline <- lapply(groups, \(g) list(group = g, n = nobs(tradition_conformity_fit_countries[[g]]),
                                     fit = fit_of(tradition_conformity_fit_countries[[g]]),
                                     estimates = est_of(tradition_conformity_fit_countries[[g]])))

# --- steps 2–4: configural, metric, scalar ------------------------------------------------
tradition_conformity_fit_config <- cfa(model = model, data = ESS, estimator = "MLR", group = "cntry", missing = "fiml.x")
tradition_conformity_fit_metric <- cfa(model = model, data = ESS, estimator = "MLR", group = "cntry",
                                       group.equal = "loadings", missing = "fiml.x")
tradition_conformity_fit_scalar <- cfa(model = model, data = ESS, estimator = "MLR", group = "cntry",
                                       group.equal = c("loadings", "intercepts"), missing = "fiml.x")
stopifnot(identical(lavInspect(tradition_conformity_fit_config, "group.label"), groups))

cmp_fm <- c("chisq.scaled", "df.scaled", "pvalue.scaled", "rmsea.robust", "cfi.robust", "tli.robust", "srmr", "aic", "bic")
compFit.tradition_conformity <- compareFit(
  scalar = tradition_conformity_fit_scalar,
  metric = tradition_conformity_fit_metric,
  config = tradition_conformity_fit_config,
  argsLRT = list(method = "satorra.bentler.2001"))
lrt <- function(a, b) { l <- lavTestLRT(a, b, method = "satorra.bentler.2001"); list(dchisq = round(l$`Chisq diff`[2], 4), ddf = l$`Df diff`[2], p = l$`Pr(>Chisq)`[2]) }

# --- score test: which equality breaks it ------------------------------------------------
score_tab <- function(fit) {
  st <- lavTestScore(fit)$uni
  pt <- parTable(fit)
  a <- match(st$lhs, pt$plabel); b <- match(st$rhs, pt$plabel)
  tibble(lhs = st$lhs, rhs = st$rhs, X2 = round(st$X2, 3), p = st$p.value,
         kind = ifelse(pt$op[a] == "=~", "loading", "intercept"),
         item = ifelse(pt$op[a] == "=~", pt$rhs[a], pt$lhs[a]),
         g1 = groups[pt$group[a]], g2 = groups[pt$group[b]]) %>% arrange(-X2)
}
score_scalar <- score_tab(tradition_conformity_fit_scalar)
score_total <- lavTestScore(tradition_conformity_fit_scalar)$test$X2
score_text <- out_text(lavTestScore(tradition_conformity_fit_scalar)$uni %>% as.data.frame() %>% arrange(-X2) %>% head(8))
partable_text <- out_text(tradition_conformity_fit_scalar %>% parTable() %>%
  select(lhs, op, rhs, group, label, plabel, est, se) %>% filter(plabel %in% c(".p12.", ".p40.")))

# --- partial scalar invariance (Lugano: ipfrule first, then ipmodst) ---------------------
tradition_conformity_fit_scalar_partial <- cfa(model = model, data = ESS, estimator = "MLR", group = "cntry",
  group.equal = c("loadings", "intercepts"), group.partial = c("ipfrule~1"), missing = "fiml.x")
tradition_conformity_fit_scalar_partial3 <- cfa(model = model, data = ESS, estimator = "MLR", group = "cntry",
  group.equal = c("loadings", "intercepts"), group.partial = c("ipfrule~1", "ipmodst~1"), missing = "fiml.x")
tradition_conformity_fit_scalar_partial2 <- cfa(model = model, data = ESS, estimator = "MLR", group = "cntry",
  group.equal = c("loadings", "intercepts"), group.partial = c("ipmodst~1"), missing = "fiml.x")
score_partial <- score_tab(tradition_conformity_fit_scalar_partial)
score_partial_text <- out_text(lavTestScore(tradition_conformity_fit_scalar_partial)$uni %>% as.data.frame() %>% arrange(-X2) %>% head(6))
# effects coding (Little, Slegers & Card, 2006): latent means on the 1-6 metric of the items
effect_means <- parameterEstimates(cfa(model = model, data = ESS, estimator = "MLR", group = "cntry",
  group.equal = c("loadings", "intercepts"), group.partial = c("ipfrule~1", "ipmodst~1"), missing = "fiml.x",
  effect.coding = TRUE)) %>% filter(op == "~1", lhs == "TRCO") %>% transmute(group = groups[group], est, se)

# --- your turn: universalism and benevolence (Lugano exercise 4) ------------------------
model_unbe <- "UNBE =~ ipeqopt + ipudrst + impenv + iphlppl + iplylfr"
unbe_fit <- function(eq = "", partial = "", std = FALSE) cfa(model = model_unbe, data = ESS, estimator = "MLR", group = "cntry",
  group.equal = eq, group.partial = partial, missing = "fiml.x", std.lv = std)
unbe <- list(config = unbe_fit(), metric = unbe_fit("loadings"), scalar = unbe_fit(c("loadings", "intercepts")))
unbe_score <- score_tab(unbe$scalar)
unbe$partial <- unbe_fit(c("loadings", "intercepts"), paste0(unbe_score$item[1], "~1"))
unbe_score2 <- score_tab(unbe$partial)
unbe$partial2 <- unbe_fit(c("loadings", "intercepts"), paste0(c(unbe_score$item[1], unbe_score2$item[unbe_score2$kind == "intercept"][1]), "~1"))
compFit.partial <- compareFit(scalar = tradition_conformity_fit_scalar_partial, metric = tradition_conformity_fit_metric,
  config = tradition_conformity_fit_config, argsLRT = list(method = "satorra.bentler.2001"))
compFit.partial3 <- compareFit(scalar = tradition_conformity_fit_scalar_partial3, metric = tradition_conformity_fit_metric,
  config = tradition_conformity_fit_config, argsLRT = list(method = "satorra.bentler.2001"))

# --- latent means: in the unit of ipmodst, and in SD of Belgium -----------------------------
latent_means <- function(fit) {
  raw <- parameterEstimates(fit) %>% filter(op == "~1", lhs == "TRCO") %>% transmute(group = groups[group], est, se, pvalue)
  std <- parameterEstimates(update(fit, std.lv = TRUE)) %>% filter(op == "~1", lhs == "TRCO") %>% transmute(group = groups[group], std = est, std_se = se)
  left_join(raw, std, by = "group")
}

# --- every pair of anchors (the other two intercepts released): the sensitivity table of the
# Day 4 live session. Which items one trusts decides the Dutch mean.
anchor_pairs <- list()
for (pair in combn(items, 2, simplify = FALSE)) {
  released_now <- paste0(setdiff(items, pair), "~1")
  f <- cfa(model = model, data = ESS, estimator = "MLR", group = "cntry", group.equal = c("loadings", "intercepts"),
    group.partial = released_now, missing = "fiml.x")
  fm <- fitMeasures(f, c("cfi.robust", "rmsea.robust", "srmr"))
  m <- latent_means(f)
  anchor_pairs[[length(anchor_pairs) + 1]] <- list(anchors = pair, free = setdiff(items, pair),
    cfi = unname(fm["cfi.robust"]), rmsea = unname(fm["rmsea.robust"]), srmr = unname(fm["srmr"]),
    nl = m$std[m$group == "NL"], lu = m$std[m$group == "LU"])
}

models <- list(
  config = tradition_conformity_fit_config, metric = tradition_conformity_fit_metric, scalar = tradition_conformity_fit_scalar,
  partial = tradition_conformity_fit_scalar_partial, partial2 = tradition_conformity_fit_scalar_partial2,
  partial3 = tradition_conformity_fit_scalar_partial3)

day4 <- list(
  source = "ESS round 2 (2004), Belgium, Luxembourg, the Netherlands (course files BE2/LU2/NL2.sav); value items reversed with sjmisc::rec(rec = \"rev\"); lavaan 0.6-21, MLR, missing = \"fiml.x\"",
  versions = list(lavaan = as.character(packageVersion("lavaan")), semTools = as.character(packageVersion("semTools"))),
  groups = groups, items = items, model = model, desc = desc, baseline = baseline,
  baseline_summary = out_text(tradition_conformity_fit_countries %>% map(~ summary(object = ., fit.measures = T, standardized = T))),
  fits = lapply(models, fit_of), estimates = lapply(models, est_of), n = nobs(tradition_conformity_fit_config),
  n_group = lavInspect(tradition_conformity_fit_config, "nobs"),
  lrt = list(metric = lrt(tradition_conformity_fit_config, tradition_conformity_fit_metric),
             scalar = lrt(tradition_conformity_fit_metric, tradition_conformity_fit_scalar),
             partial = lrt(tradition_conformity_fit_metric, tradition_conformity_fit_scalar_partial),
             partial2 = lrt(tradition_conformity_fit_metric, tradition_conformity_fit_scalar_partial2),
             partial3 = lrt(tradition_conformity_fit_metric, tradition_conformity_fit_scalar_partial3)),
  compare_text = out_text(summary(object = compFit.tradition_conformity, fit.measures = cmp_fm)),
  compare_partial_text = out_text(summary(object = compFit.partial, fit.measures = cmp_fm)),
  compare_partial3_text = out_text(summary(object = compFit.partial3, fit.measures = cmp_fm)),
  config_summary = out_text(summary(object = tradition_conformity_fit_config, fit.measures = T, standardized = T)),
  scalar_summary = out_text(summary(object = tradition_conformity_fit_scalar, fit.measures = T, standardized = T)),
  score_scalar = head(score_scalar, 12), score_partial = head(score_partial, 8), score_total = round(score_total, 3),
  score_partial_text = score_partial_text, effect_means = effect_means,
  score_text = score_text, partable_text = partable_text,
  means = lapply(list(scalar = tradition_conformity_fit_scalar, partial = tradition_conformity_fit_scalar_partial,
                      partial2 = tradition_conformity_fit_scalar_partial2, partial3 = tradition_conformity_fit_scalar_partial3), latent_means),
  anchors = anchor_pairs,
  unbe = list(fits = lapply(unbe, fit_of), score = head(unbe_score, 6), score2 = head(unbe_score2, 6),
              freed = c(unbe_score$item[1], unbe_score2$item[unbe_score2$kind == "intercept"][1]),
              means = list(
                scalar = unbe_fit(c("loadings", "intercepts"), std = TRUE),
                partial = unbe_fit(c("loadings", "intercepts"), paste0(unbe_score$item[1], "~1"), std = TRUE),
                partial2 = unbe_fit(c("loadings", "intercepts"), paste0(c(unbe_score$item[1], unbe_score2$item[unbe_score2$kind == "intercept"][1]), "~1"), std = TRUE)
              ) %>% map(\(f) parameterEstimates(f) %>% filter(op == "~1", lhs == "UNBE") %>% transmute(group = groups[group], std = est, std_se = se)))
)
write_json(day4, "public/data/day4.json", auto_unbox = TRUE, digits = 6, pretty = FALSE, na = "null")
cat("written: public/data/day4.json\n")
print(sapply(day4$fits, \(f) unlist(f[c("chisq.scaled", "df", "cfi.robust", "rmsea.robust", "srmr")])))
print(sapply(day4$baseline, \(b) unlist(b$fit[c("chisq.scaled", "df", "cfi.robust", "rmsea.robust", "srmr")])))
print(day4$lrt); print(head(score_scalar, 6)); print(head(score_partial, 4)); print(day4$means); print(day4$n_group)
print(sapply(day4$unbe$fits, \(f) unlist(f[c("chisq.scaled", "df", "cfi.robust", "rmsea.robust", "srmr")]))); print(day4$unbe$freed); print(day4$unbe$means); print(day4$unbe$score)
