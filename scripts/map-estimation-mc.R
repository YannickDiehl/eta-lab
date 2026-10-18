# ---------------------------------------------------------------------------
# η Lab · The map of SEM: what happens to estimation when the data are small, non-normal or
# incomplete. Three small Monte Carlo studies; the populations are the course's own models,
# estimated on NL2 (ESS 2004). Only summaries are written — no data, simulated or real.
#
#   heywood  the workshop model (2 factors × 2 items) at n = 50 … 1000: how often does ML end
#            in a negative variance, or not at all?
#   mlr      the two-factor model of Day 2 under normal, moderately and severely non-normal data
#            (Curran, West & Finch, 1996: skewness 2 / kurtosis 7, skewness 3 / kurtosis 21):
#            standard errors and χ² of ML against MLR
#   fiml     the same model with the universalism block missing for 10–50 % of respondents,
#            completely at random, at random (depending on ipmodst), or not at random:
#            listwise deletion against FIML
#
# Run from the app folder (a few minutes):  Rscript scripts/map-estimation-mc.R
# ---------------------------------------------------------------------------
suppressPackageStartupMessages({
  library(tidyverse); library(sjlabelled); library(sjmisc); library(lavaan); library(jsonlite); library(parallel)
})
RNGkind("L'Ecuyer-CMRG"); set.seed(2027)
cores <- max(1, detectCores() - 1)
REPS <- 1000

NL2 <- read_spss("../../../Lugano 2025/Lugano2025Code/NL2.sav", convert.factors = F, drop.labels = T) %>%
  mutate(across(ipcrtiv:impfun, \(x) rec(x, rec = "rev")))

# a population model: the estimates of a fitted model, written as lavaan syntax with fixed values
population <- function(fit) {
  parameterEstimates(fit) %>% filter(op %in% c("=~", "~~", "~1")) %>%
    mutate(line = case_when(op == "~1" ~ paste0(lhs, " ~ ", est, "*1"),
                            TRUE ~ paste0(lhs, " ", op, " ", est, "*", rhs))) %>%
    pull(line) %>% paste(collapse = "\n")
}

# ---- heywood -------------------------------------------------------------------------------------
toy_model <- "
  TRCO =~ ipfrule + ipbhprp
  UNIV =~ ipeqopt + ipudrst
"
toy_fit <- cfa(model = toy_model, data = NL2, estimator = "ML")
toy_pop <- population(toy_fit)
heywood_one <- function(n) {
  d <- simulateData(toy_pop, sample.nobs = n)
  fit <- tryCatch(suppressWarnings(cfa(model = toy_model, data = d, estimator = "ML")), error = \(e) NULL)
  if (is.null(fit) || !lavInspect(fit, "converged")) return("noconv")
  pe <- parameterEstimates(fit)
  if (any(pe$est[pe$op == "~~" & pe$lhs == pe$rhs] < 0)) return("negative")
  r <- lavInspect(fit, "std")$psi[2, 1]
  if (abs(r) > 1) return("negative")   # a correlation beyond ±1 is the same problem in another place
  "ok"
}
heywood <- map(c(50, 100, 200, 500, 1000), \(n) {
  res <- unlist(mclapply(1:REPS, \(i) heywood_one(n), mc.cores = cores))
  list(n = n, ok = mean(res == "ok"), negative = mean(res == "negative"), noconv = mean(res == "noconv"))
})
# one example of a Heywood case, for the output box
example <- local({
  repeat {
    d <- simulateData(toy_pop, sample.nobs = 50)
    fit <- tryCatch(suppressWarnings(cfa(model = toy_model, data = d, estimator = "ML")), error = \(e) NULL)
    if (!is.null(fit) && lavInspect(fit, "converged")) {
      pe <- parameterEstimates(fit)
      if (any(pe$est[pe$op == "~~" & pe$lhs == pe$rhs] < 0)) break
    }
  }
  w <- tryCatch({ cfa(model = toy_model, data = d, estimator = "ML"); "" }, warning = \(w) conditionMessage(w))
  list(warning = w, table = parameterEstimates(fit) %>% filter(op == "~~") %>% transmute(par = paste(lhs, op, rhs), est = round(est, 3), se = round(se, 3)))
})

# ---- mlr -----------------------------------------------------------------------------------------
course_model <- "
  TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp
  UNIV =~ ipeqopt + ipudrst + impenv
"
course_fit <- cfa(model = course_model, data = NL2, estimator = "ML", missing = "fiml", meanstructure = T)
course_pop <- population(course_fit)
target <- "TRCO=~ipbhprp"
truth_l <- parameterEstimates(course_fit) %>% filter(lhs == "TRCO", rhs == "ipbhprp") %>% pull(est)
DIST <- list(normal = c(0, 0), moderate = c(2, 7), severe = c(3, 21))
mlr_one <- function(n, sk, ku) {
  d <- simulateData(course_pop, sample.nobs = n, skewness = sk, kurtosis = ku)
  ml <- tryCatch(cfa(model = course_model, data = d, estimator = "ML"), error = \(e) NULL, warning = \(w) NULL)
  mlr <- tryCatch(cfa(model = course_model, data = d, estimator = "MLR"), error = \(e) NULL, warning = \(w) NULL)
  if (is.null(ml) || is.null(mlr)) return(NULL)   # samples where either estimation warns (no convergence, Heywood case) are left out
  a <- parameterEstimates(ml) %>% filter(lhs == "TRCO", rhs == "ipbhprp")
  b <- parameterEstimates(mlr) %>% filter(lhs == "TRCO", rhs == "ipbhprp")
  c(est = a$est, se_ml = a$se, se_mlr = b$se,
    p_ml = fitMeasures(ml, "pvalue")[[1]], p_mlr = fitMeasures(mlr, "pvalue.scaled")[[1]])
}
mlr <- list()
for (dn in names(DIST)) for (n in c(200, 500, 1000)) {
  res <- mclapply(1:REPS, \(i) mlr_one(n, DIST[[dn]][1], DIST[[dn]][2]), mc.cores = cores) %>% compact() %>% do.call(rbind, .)
  est <- res[, "est"]
  breaks <- seq(truth_l - 1.2, truth_l + 1.2, length.out = 49)
  mlr[[length(mlr) + 1]] <- list(
    dist = dn, n = n, reps = nrow(res), truth = truth_l,
    mean = mean(est), sd = sd(est), se_ml = mean(res[, "se_ml"]), se_mlr = mean(res[, "se_mlr"]),
    cover_ml = mean(abs(est - truth_l) <= 1.96 * res[, "se_ml"]), cover_mlr = mean(abs(est - truth_l) <= 1.96 * res[, "se_mlr"]),
    reject_ml = mean(res[, "p_ml"] < .05, na.rm = T), reject_mlr = mean(res[, "p_mlr"] < .05, na.rm = T),
    hist = hist(pmin(pmax(est, min(breaks) + 1e-9), max(breaks) - 1e-9), breaks = breaks, plot = F)$counts,
    lo = min(breaks), hi = max(breaks)
  )
  cat("mlr", dn, n, "done\n")
}

# ---- fiml ----------------------------------------------------------------------------------------
std_fit <- cfa(model = course_model, data = NL2, estimator = "ML", missing = "fiml", meanstructure = T)
truth_r <- lavInspect(std_fit, "std")$psi[2, 1]
truth_m <- lavInspect(std_fit, "implied")$mean[["impenv"]]
univ <- c("ipeqopt", "ipudrst", "impenv")
fiml_one <- function(n, share, mech) {
  d <- simulateData(course_pop, sample.nobs = n)
  z <- switch(mech, mcar = rnorm(n), mar = scale(d$ipmodst)[, 1] + rnorm(n, sd = 0.5), mnar = scale(d$impenv)[, 1] + rnorm(n, sd = 0.5))
  gone <- rank(z) > (1 - share) * n          # the respondents with the highest z skip the universalism block
  d[gone, univ] <- NA
  lw <- tryCatch(cfa(model = course_model, data = d, estimator = "ML", missing = "listwise", meanstructure = T), error = \(e) NULL, warning = \(w) NULL)
  fi <- tryCatch(cfa(model = course_model, data = d, estimator = "ML", missing = "fiml", meanstructure = T), error = \(e) NULL, warning = \(w) NULL)
  if (is.null(lw) || is.null(fi)) return(NULL)
  c(r_lw = lavInspect(lw, "std")$psi[2, 1], r_fi = lavInspect(fi, "std")$psi[2, 1],
    m_lw = lavInspect(lw, "implied")$mean[["impenv"]], m_fi = lavInspect(fi, "implied")$mean[["impenv"]],
    n_lw = lavInspect(lw, "nobs"), n_fi = lavInspect(fi, "nobs"))
}
fiml <- list()
for (mech in c("mcar", "mar", "mnar")) for (share in c(0.1, 0.3, 0.5)) {
  res <- mclapply(1:500, \(i) fiml_one(500, share, mech), mc.cores = cores) %>% compact() %>% do.call(rbind, .)
  fiml[[length(fiml) + 1]] <- c(list(mech = mech, share = share, reps = nrow(res)),
                                as.list(round(colMeans(res), 4)),
                                list(sd_r_lw = sd(res[, "r_lw"]), sd_r_fi = sd(res[, "r_fi"])))
  cat("fiml", mech, share, "done\n")
}

mc <- list(
  source = "Monte Carlo from the course models estimated on NL2 (ESS 2004); lavaan 0.6-21; simulateData() (Vale–Maurelli for non-normal data)",
  heywood = list(reps = REPS, pop = toy_pop, rows = heywood, example = example),
  mlr = list(reps = REPS, parameter = target, rows = mlr),
  fiml = list(reps = 500, n = 500, truth_r = truth_r, truth_m = truth_m, rows = fiml)
)
write_json(mc, "public/data/map-mc.json", auto_unbox = TRUE, digits = 5, pretty = FALSE)
cat("written: public/data/map-mc.json\n")
str(heywood); str(mlr[[1]]); str(fiml[[5]])
