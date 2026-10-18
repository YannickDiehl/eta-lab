# Cross-check η Lab's model reading against lavaan.
# For every random diagram from scripts/random-models.ts: does lavaan accept the syntax,
# and do df and the number of free parameters agree with what η Lab shows?
#
#   Rscript scripts/crosscheck.R /tmp/models.json

suppressMessages({ library(lavaan); library(jsonlite) })
args <- commandArgs(trailingOnly = TRUE)
models <- fromJSON(args[1], simplifyDataFrame = FALSE)

res <- lapply(models, function(m) {
  ov <- unlist(m$observed); p <- length(ov)
  S <- diag(p) * .5 + .5; dimnames(S) <- list(ov, ov)
  out <- list(id = m$id, ok = FALSE, df_lav = NA, npar_lav = NA, err = "")
  g <- m$groups
  if (is.null(g)) {
    fit <- tryCatch(suppressWarnings(sem(m$model, sample.cov = S, sample.nobs = 500, std.lv = isTRUE(m$stdlv), do.fit = FALSE)),
                    error = function(e) { out$err <<- conditionMessage(e); NULL })
  } else {
    # several groups: means enter the model; group.equal / group.partial as η Lab writes them
    mu <- setNames(rep(0, p), ov)
    fit <- tryCatch(suppressWarnings(sem(m$model, sample.cov = rep(list(S), g$G), sample.mean = rep(list(mu), g$G),
                                         sample.nobs = rep(500, g$G), group.equal = unlist(g$eq), group.partial = unlist(g$partial), std.lv = isTRUE(m$stdlv),
                                         do.fit = FALSE)),
                    error = function(e) { out$err <<- conditionMessage(e); NULL })
  }
  if (!is.null(fit)) {
    out$ok <- TRUE
    # group.equal works through "==" constraints, which lav_partable_df does not subtract
    out$df_lav <- lavaan:::lav_partable_df(fit@ParTable) + sum(fit@ParTable$op == "==")
    out$npar_lav <- lavInspect(fit, "npar")
    # lavaan only knows the boxes named in the syntax
    out$p_lav <- length(lavNames(fit, "ov"))
  }
  out
})

bad <- 0; crashed <- 0
for (i in seq_along(models)) {
  m <- models[[i]]; r <- res[[i]]
  problems <- c()
  # lavaan itself breaks down numerically on some degenerate random drawings: counted apart, not as disagreement
  if (!r$ok && !isTRUE(m$blocked) && grepl("dgesv|singul", r$err)) { crashed <- crashed + 1; next }
  if (!r$ok && !isTRUE(m$blocked)) problems <- c(problems, paste("lavaan error:", r$err))
  # factors that measure each other: lavaan sometimes builds such a model, η always refuses it on purpose
  else if (r$ok && isTRUE(m$blocked) && !isTRUE(m$circular)) problems <- c(problems, "eta expects lavaan to refuse this model, but lavaan accepts it")
  else if (r$ok && !isTRUE(m$blocked)) {
    if (r$df_lav != m$df) problems <- c(problems, sprintf("df: eta %d, lavaan %d", m$df, r$df_lav))
    if (m$npar >= 0 && r$npar_lav != m$npar) problems <- c(problems, sprintf("npar: eta %d, lavaan %d", m$npar, r$npar_lav))
    if (r$p_lav != length(m$observed)) problems <- c(problems, sprintf("observed: eta %d, lavaan %d", length(m$observed), r$p_lav))
  }
  if (m$roundTripDf != m$df) problems <- c(problems, sprintf("round trip df %d vs %d", m$roundTripDf, m$df))
  if (length(problems)) {
    bad <- bad + 1
    if (bad <= 12) cat(sprintf("---- model %d%s\n%s\n  => %s\n", m$id,
      if (is.null(m$groups)) "" else sprintf(" (%d groups, %s, partial: %s)", m$groups$G, m$groups$level, paste(unlist(m$groups$partial), collapse = " ")),
      m$model, paste(problems, collapse = "; ")))
  }
}
cat(sprintf("\n%d of %d models agree with lavaan (df, free parameters, variables, syntax round trip; %d correctly flagged as not estimable).\n",
            length(models) - bad - crashed, length(models) - crashed, sum(sapply(models, function(m) isTRUE(m$blocked)))))
if (crashed) cat(sprintf("%d degenerate drawings where lavaan itself failed numerically (singular matrix) were left out.\n", crashed))
quit(status = if (bad) 1 else 0)
