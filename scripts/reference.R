# ---------------------------------------------------------------------------
# η Lab · datasets and lavaan reference values
#
# Writes two files from the ESS microdata (which stay local and are never
# committed):
#   src/data/datasets.json   correlation matrices + n (aggregates only)
#   src/math/reference.json  lavaan results the JS engine is tested against
#
# Run from the app folder:  Rscript scripts/reference.R
# ---------------------------------------------------------------------------

suppressPackageStartupMessages({ library(haven); library(lavaan); library(jsonlite) })

items <- c("imptrad", "ipfrule", "ipbhprp", "ipmodst")
labels <- list(
  imptrad = "Tradition is important to them; they follow the customs handed down by religion or family.",
  ipfrule = "They believe people should do what they are told and follow rules at all times.",
  ipbhprp = "It is important to them always to behave properly.",
  ipmodst = "It is important to them to be humble and modest."
)

clean <- function(x) { x[!(x %in% 1:6)] <- NA; 7 - x }   # higher = more important

ess7  <- read.csv("../Kurswebsite2027/data/ESS07.csv")
ess2  <- read_sav("../../../Lugano 2025/Lugano2025Code/NL2.sav")
ess11 <- read_sav(path.expand("~/Downloads/ESS11e04_2/ESS11e04_2.sav"),
                  col_select = c(cntry, all_of(paste0(items, "a"))))
names(ess11) <- sub("a$", "", names(ess11))

sets <- list(
  gb2014 = list(label = "Great Britain · ESS 2014", d = ess7[ess7$country == "GB", items]),
  de2014 = list(label = "Germany · ESS 2014",       d = ess7[ess7$country == "DE", items]),
  nl2004 = list(label = "Netherlands · ESS 2004",   d = as.data.frame(zap_labels(ess2[, items]))),
  nl2023 = list(label = "Netherlands · ESS 2023",   d = as.data.frame(zap_labels(ess11[ess11$cntry == "NL", items])))
)

datasets <- list(); reference <- list()
m1 <- "F =~ imptrad + ipfrule + ipbhprp + ipmodst"

for (id in names(sets)) {
  d <- as.data.frame(lapply(sets[[id]]$d, clean))
  d <- na.omit(d)
  S <- cor(d); n <- nrow(d)
  datasets[[id]] <- list(id = id, label = sets[[id]]$label, n = n, items = items,
                         S = unname(round(S, 4)), means = unname(round(colMeans(d), 3)),
                         sds = unname(round(apply(d, 2, sd), 3)))
  Sr <- round(S, 4)
  fit <- cfa(m1, sample.cov = Sr, sample.nobs = n, std.lv = TRUE,
             sample.cov.rescale = FALSE, information = "observed")
  pe <- parameterEstimates(fit)
  fm <- fitMeasures(fit, c("chisq", "df", "rmsea", "cfi", "tli", "srmr", "baseline.chisq"))
  mi <- modindices(fit)
  mi <- mi[mi$op == "~~", c("lhs", "rhs", "mi")]
  reference[[id]] <- list(
    lambda = unname(pe$est[pe$op == "=~"]), lambda_se = unname(pe$se[pe$op == "=~"]),
    theta  = unname(pe$est[pe$op == "~~" & pe$lhs == pe$rhs & pe$lhs %in% items]),
    chisq = fm[["chisq"]], df = fm[["df"]], rmsea = fm[["rmsea"]], cfi = fm[["cfi"]],
    tli = fm[["tli"]], srmr = fm[["srmr"]], baseline_chisq = fm[["baseline.chisq"]],
    mi = lapply(seq_len(nrow(mi)), \(i) list(lhs = mi$lhs[i], rhs = mi$rhs[i], mi = mi$mi[i]))
  )
  # one model with a freed residual covariance (largest MI), for the "free a parameter" step
  top <- mi[which.max(mi$mi), ]
  fit2 <- cfa(paste(m1, "\n", top$lhs, "~~", top$rhs), sample.cov = Sr, sample.nobs = n,
              std.lv = TRUE, sample.cov.rescale = FALSE, information = "observed")
  fm2 <- fitMeasures(fit2, c("chisq", "df", "rmsea", "cfi", "srmr"))
  reference[[id]]$freed <- list(lhs = top$lhs, rhs = top$rhs, chisq = fm2[["chisq"]], df = fm2[["df"]],
                                rmsea = fm2[["rmsea"]], cfi = fm2[["cfi"]], srmr = fm2[["srmr"]])
  # ULS for the estimator comparison
  fitu <- cfa(m1, sample.cov = Sr, sample.nobs = n, std.lv = TRUE, sample.cov.rescale = FALSE, estimator = "ULS", se = "none", test = "none")
  reference[[id]]$lambda_uls <- unname(parameterEstimates(fitu)$est[parameterEstimates(fitu)$op == "=~"])
}

write_json(list(labels = labels, datasets = unname(datasets)), "src/data/datasets.json",
           auto_unbox = TRUE, pretty = TRUE, digits = NA)
write_json(reference, "src/math/reference.json", auto_unbox = TRUE, pretty = TRUE, digits = NA)
message("wrote src/data/datasets.json and src/math/reference.json")
