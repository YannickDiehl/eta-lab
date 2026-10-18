# ---------------------------------------------------------------------------
# lavaan reference values for the studio's estimator (src/math/sem.ts)
#
# Fits course models with lavaan on exactly the summary statistics the app ships
# (public/data/course-data.json) and writes src/math/sem-reference.json.
# src/math/sem.test.ts fits the same models in JavaScript and compares.
#
# Run from the app folder:  Rscript scripts/sem-reference.R
# ---------------------------------------------------------------------------
suppressPackageStartupMessages({ library(lavaan); library(jsonlite) })

cd <- fromJSON("public/data/course-data.json", simplifyVector = FALSE)
unpack <- function(tri, vn) { k <- length(vn); M <- matrix(0, k, k); M[lower.tri(M, diag = TRUE)] <- unlist(tri); M <- M + t(M) - diag(diag(M)); dimnames(M) <- list(vn, vn); M }
groups_for <- function(round, sample, grouping) {
  r <- Filter(\(x) x$id == round, cd$rounds)[[1]]
  vn <- vapply(if (is.null(r$variables)) cd$variables else r$variables, \(v) v$name, "")
  block <- function(b) list(n = b$n, S = unpack(b$cov, vn), m = setNames(unlist(b$means), vn))
  s <- Filter(\(x) x$id == sample, r$samples)[[1]]
  if (grouping == "none") list(block(s$all)) else lapply(s$groups[[grouping]], block)
}

cases <- list(
  list(id = "day1-one-factor", round = "ess2004", sample = "NL", grouping = "none",
       model = "TC =~ imptrad + ipmodst + ipfrule + ipbhprp"),
  list(id = "day2-two-factors", round = "ess2004", sample = "NL", grouping = "none",
       model = "Tradition =~ imptrad + ipmodst\nConformity =~ ipfrule + ipbhprp"),
  list(id = "day3-three-factors-residual", round = "ess2004", sample = "pooled", grouping = "none",
       model = "TC =~ imptrad + ipmodst + ipfrule + ipbhprp\nUN =~ ipeqopt + ipudrst + impenv\nAllow =~ imsmetn + imdfetn + impcntr\nimsmetn ~~ imdfetn"),
  list(id = "day5-higher-order", round = "ess2004", sample = "BE", grouping = "none",
       model = "Conservation =~ Tradition + Conformity + Security\nTradition =~ imptrad + ipmodst\nConformity =~ ipfrule + ipbhprp\nSecurity =~ impsafe + ipstrgv"),
  list(id = "day6-full-sem", round = "ess2004", sample = "pooled", grouping = "none",
       model = "TC =~ imptrad + ipmodst + ipfrule + ipbhprp\nUN =~ ipeqopt + ipudrst + impenv\nAllow =~ imsmetn + imdfetn + impcntr\nAllow ~ TC + UN + agea + female + eduyrs"),
  list(id = "day7-mimic", round = "ess2023", sample = "DE", grouping = "none",
       model = "Effects =~ imbgeco + imueclt + imwbcnt\nEffects ~ agea + female + eduyrs"),
  list(id = "day4-configural", round = "ess2004", sample = "pooled", grouping = "country", equal = character(0),
       model = "TC =~ imptrad + ipmodst + ipfrule + ipbhprp"),
  list(id = "day4-metric", round = "ess2004", sample = "pooled", grouping = "country", equal = "loadings",
       model = "TC =~ imptrad + ipmodst + ipfrule + ipbhprp"),
  list(id = "day4-scalar", round = "ess2004", sample = "pooled", grouping = "country", equal = c("loadings", "intercepts"),
       model = "TC =~ imptrad + ipmodst + ipfrule + ipbhprp"),
  list(id = "day4-strict", round = "ess2004", sample = "pooled", grouping = "country", equal = c("loadings", "intercepts", "residuals"),
       model = "TC =~ imptrad + ipmodst + ipfrule + ipbhprp"),
  list(id = "day4-partial", round = "ess2004", sample = "pooled", grouping = "country", equal = c("loadings", "intercepts"),
       partial = c("ipmodst~1", "TC=~ipbhprp"), model = "TC =~ imptrad + ipmodst + ipfrule + ipbhprp"),
  list(id = "day8-mg-sem-age", round = "ess2023", sample = "NL", grouping = "age", equal = "loadings",
       model = "UN =~ ipeqopt + ipudrst + impenv\nEffects =~ imbgeco + imueclt + imwbcnt\nEffects ~ UN + eduyrs"),
  list(id = "day3-congeneric-stdlv", round = "ess2004", sample = "NL", grouping = "none", stdlv = TRUE,
       model = "TC =~ imptrad + ipmodst + ipfrule + ipbhprp"),
  list(id = "day3-tau-equivalent", round = "ess2004", sample = "NL", grouping = "none", stdlv = TRUE,
       model = "TC =~ l*imptrad + l*ipmodst + l*ipfrule + l*ipbhprp"),
  list(id = "day3-parallel", round = "ess2004", sample = "NL", grouping = "none", stdlv = TRUE,
       model = "TC =~ l*imptrad + l*ipmodst + l*ipfrule + l*ipbhprp\nimptrad ~~ e*imptrad\nipmodst ~~ e*ipmodst\nipfrule ~~ e*ipfrule\nipbhprp ~~ e*ipbhprp"),
  list(id = "day3-fixed-values", round = "ess2004", sample = "BE", grouping = "none",
       model = "Tradition =~ imptrad + 0.8*ipmodst\nConformity =~ ipfrule + ipbhprp\nUN =~ ipeqopt + ipudrst + impenv\nUN ~~ 0*Tradition"),
  list(id = "day4-metric-stdlv", round = "ess2004", sample = "pooled", grouping = "country", equal = "loadings", stdlv = TRUE,
       model = "TC =~ imptrad + ipmodst + ipfrule + ipbhprp"),
  list(id = "day4-labels-across-groups", round = "ess2004", sample = "pooled", grouping = "gender",
       model = "TC =~ imptrad + a*ipmodst + a*ipfrule + ipbhprp\nimsmetn ~ b*agea\nimdfetn ~ b*agea"),
  list(id = "day7-mediation", round = "ess2004", sample = "pooled", grouping = "none",
       model = "UN =~ ipeqopt + ipudrst + impenv\nEffects =~ imbgeco + imueclt + imwbcnt\nAllow =~ imsmetn + imdfetn + impcntr\nEffects ~ a*UN + d*agea\nAllow ~ b*Effects + c*UN + e*agea\nind_un := a*b\ntotal_un := c + a*b\nind_age := d*b\ntotal_age := e + d*b"),
  list(id = "day7-mediation-groups", round = "ess2023", sample = "pooled", grouping = "country", equal = "loadings",
       model = "UN =~ ipeqopt + ipudrst + impenv\nEffects =~ imbgeco + imueclt + imwbcnt\nAllow =~ imsmetn + imdfetn + impcntr\nEffects ~ c(a1, a2, a3, a4, a5)*UN\nAllow ~ c(b1, b2, b3, b4, b5)*Effects + UN\nind_g1 := a1*b1\nind_g3 := a3*b3"),
  list(id = "day5-bifactor", round = "ess2004", sample = "pooled", grouping = "none", stdlv = TRUE,
       model = "Pro_diversity =~ ipeqopt + ipudrst + impenv + imsmetn + imdfetn + impcntr + imbgeco + imueclt + imwbcnt\nUniversalism =~ ipeqopt + ipudrst + impenv\nAllow =~ imsmetn + imdfetn + impcntr\nEffects =~ imbgeco + imueclt + imwbcnt\nPro_diversity ~~ 0*Universalism + 0*Allow + 0*Effects\nUniversalism ~~ 0*Allow + 0*Effects\nAllow ~~ 0*Effects"),
  list(id = "day5-mtmm-ctcm", round = "mtmm", sample = "pooled", grouping = "none", stdlv = TRUE,
       model = "Parl =~ parl_a + parl_b + parl_c\nLegal =~ legal_a + legal_b + legal_c\nPolice =~ police_a + police_b + police_c\nScale11 =~ parl_a + legal_a + police_a\nAgree4 =~ parl_b + legal_b + police_b\nScale5 =~ parl_c + legal_c + police_c\nScale11 ~~ 0*Parl + 0*Legal + 0*Police + 0*Agree4 + 0*Scale5\nAgree4 ~~ 0*Parl + 0*Legal + 0*Police + 0*Scale5\nScale5 ~~ 0*Parl + 0*Legal + 0*Police"),
  list(id = "day5-mtmm-cu", round = "mtmm", sample = "pooled", grouping = "none", stdlv = TRUE,
       model = "Parl =~ parl_a + parl_b + parl_c\nLegal =~ legal_a + legal_b + legal_c\nPolice =~ police_a + police_b + police_c\nparl_a ~~ legal_a + police_a\nlegal_a ~~ police_a\nparl_b ~~ legal_b + police_b\nlegal_b ~~ police_b\nparl_c ~~ legal_c + police_c\nlegal_c ~~ police_c"),
  list(id = "day9-clpm", round = "panel", sample = "pooled", grouping = "none",
       model = "x2 ~ x1 + y1\ny2 ~ x1 + y1\nx3 ~ x2 + y2\ny3 ~ x2 + y2\nx4 ~ x3 + y3\ny4 ~ x3 + y3\nx1 ~~ y1\nx2 ~~ y2\nx3 ~~ y3\nx4 ~~ y4"),
  list(id = "day9-riclpm", round = "panel", sample = "pooled", grouping = "none",
       model = "RIx =~ 1*x1 + 1*x2 + 1*x3 + 1*x4\nRIy =~ 1*y1 + 1*y2 + 1*y3 + 1*y4\nwx1 =~ 1*x1\nwx2 =~ 1*x2\nwx3 =~ 1*x3\nwx4 =~ 1*x4\nwy1 =~ 1*y1\nwy2 =~ 1*y2\nwy3 =~ 1*y3\nwy4 =~ 1*y4\nwx2 ~ wx1 + wy1\nwy2 ~ wx1 + wy1\nwx3 ~ wx2 + wy2\nwy3 ~ wx2 + wy2\nwx4 ~ wx3 + wy3\nwy4 ~ wx3 + wy3\nwx1 ~~ wy1\nwx2 ~~ wy2\nwx3 ~~ wy3\nwx4 ~~ wy4\nRIx ~~ RIy\nRIx ~~ 0*wx1 + 0*wy1\nRIy ~~ 0*wx1 + 0*wy1\nx1 ~~ 0*x1\nx2 ~~ 0*x2\nx3 ~~ 0*x3\nx4 ~~ 0*x4\ny1 ~~ 0*y1\ny2 ~~ 0*y2\ny3 ~~ 0*y3\ny4 ~~ 0*y4")
)

out <- lapply(cases, function(cs) {
  gs <- groups_for(cs$round, cs$sample, cs$grouping)
  # only the model's variables (a grouping variable is constant within its groups)
  ovn <- lavNames(lavaanify(cs$model, ngroups = length(gs)), "ov")
  gs <- lapply(gs, \(g) list(n = g$n, S = g$S[ovn, ovn], m = g$m[ovn]))
  args <- list(model = cs$model)
  if (length(gs) == 1) { args$sample.cov <- gs[[1]]$S; args$sample.nobs <- gs[[1]]$n }
  else {
    args$sample.cov <- lapply(gs, `[[`, "S"); args$sample.mean <- lapply(gs, `[[`, "m"); args$sample.nobs <- vapply(gs, `[[`, 0, "n")
    args$group.equal <- if (is.null(cs$equal)) character(0) else cs$equal
    if (!is.null(cs$partial)) args$group.partial <- cs$partial
  }
  if (isTRUE(cs$stdlv)) args$std.lv <- TRUE
  fit <- do.call(sem, args)
  fm <- fitMeasures(fit, c("chisq", "df", "pvalue", "cfi", "tli", "rmsea", "srmr", "baseline.chisq", "baseline.df", "logl", "aic", "bic", "npar"))
  mi <- tryCatch(modindices(fit, sort. = TRUE), error = function(e) NULL)
  if (!is.null(mi) && is.null(mi$group)) mi$group <- 1
  res <- lavResiduals(fit, type = "cor.bentler", summary = FALSE)
  if (!is.null(res$cov)) res <- list(res)
  pe <- standardizedSolution(fit, type = "std.all", se = FALSE)
  est <- parameterEstimates(fit)
  if (is.null(est$group)) est$group <- 1
  if (is.null(pe$group)) pe$group <- 1
  key <- \(d) paste(d$group, d$lhs, d$op, d$rhs)
  pe <- pe[match(key(est), key(pe)), ]
  keep <- est$op %in% c("=~", "~", "~~", "~1")
  defd <- which(est$op == ":=")
  r2 <- lavInspect(fit, "r2"); if (!is.list(r2)) r2 <- list(r2)
  cat(sprintf("%-28s chisq %9.3f  df %3d  cfi %.4f  rmsea %.4f  srmr %.4f\n", cs$id, fm[["chisq"]], as.integer(fm[["df"]]), fm[["cfi"]], fm[["rmsea"]], fm[["srmr"]]))
  list(id = cs$id, round = cs$round, sample = cs$sample, grouping = cs$grouping, model = cs$model,
       equal = if (is.null(cs$equal)) list() else as.list(cs$equal), partial = if (is.null(cs$partial)) list() else as.list(cs$partial),
       fit = as.list(fm),
       params = lapply(which(keep), \(i) list(group = est$group[i], lhs = est$lhs[i], op = est$op[i], rhs = est$rhs[i],
                                              est = est$est[i], se = est$se[i], std = pe$est.std[i])),
       r2 = lapply(r2, as.list), stdlv = isTRUE(cs$stdlv),
       defined = lapply(defd, \(i) list(name = est$lhs[i], rhs = est$rhs[i], est = est$est[i], se = est$se[i], std = pe$est.std[i])),
       mi = if (is.null(mi)) list() else lapply(seq_len(min(nrow(mi), 40)), \(i) list(group = mi$group[i], lhs = mi$lhs[i], op = mi$op[i], rhs = mi$rhs[i],
                                                                                     mi = mi$mi[i], epc = mi$epc[i], sepc = mi$sepc.all[i])),
       residuals = lapply(res, \(r) list(names = colnames(r$cov), cov = unname(r$cov), mean = if (is.null(r$mean)) list() else unname(r$mean))))
})
write_json(out, "src/math/sem-reference.json", auto_unbox = TRUE, digits = NA)
cat("written: src/math/sem-reference.json\n")
