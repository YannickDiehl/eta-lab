# Runs the R code from scripts/rcode-models.ts on the ESS 2004 Benelux microdata (kept local).
#   Rscript scripts/rcode-check.R /tmp/rcode.json
suppressPackageStartupMessages({ library(haven); library(jsonlite); library(lavaan); library(semTools) })
args <- commandArgs(TRUE)
cases <- fromJSON(args[1], simplifyVector = FALSE)
source_prep <- new.env()
lines <- readLines("scripts/course-data.R")
# reuse the recoding from course-data.R (everything up to the stats() helper)
eval(parse(text = lines[seq_len(grep("^cols11 <-", lines) - 1)]), envir = source_prep)
my_data <- source_prep$ess2
cat("ESS 2004 Benelux:", nrow(my_data), "rows,", sum(!complete.cases(my_data)), "with missing values\n")
ok <- 0; bad <- 0
for (cs in cases) {
  env <- new.env(); env$my_data <- my_data
  cs$code <- gsub("bootstrap = 2000", "bootstrap = 20", cs$code, fixed = TRUE)   # speed: the call is what we check
  warn <- character(0)
  res <- tryCatch(withCallingHandlers({
    capture.output(eval(parse(text = cs$code), envir = env))
    fits <- mget(ls(env, pattern = "^fit"), envir = env)
    used <- vapply(fits, \(f) if (inherits(f, "lavaan")) paste(lavInspect(f, "options")$estimator, lavInspect(f, "options")$missing, lavInspect(f, "nobs")[1]) else "", "")
    paste(unique(used), collapse = " | ")
  }, warning = function(w) { warn <<- c(warn, conditionMessage(w)); invokeRestart("muffleWarning") }),
  error = function(e) paste("ERROR:", conditionMessage(e)))
  if (startsWith(res, "ERROR")) bad <- bad + 1 else ok <- ok + 1
  cat(sprintf("%-70s %s\n", substr(cs$name, 1, 70), res))
  if (length(warn)) cat("    warnings:", paste(unique(substr(warn, 1, 120)), collapse = " // "), "\n")
}
cat(sprintf("\n%d ran, %d failed\n", ok, bad))
