# ---------------------------------------------------------------------------
# η Lab · course data for the studio
#
# Writes public/data/course-data.json: for the course variables (21 PVQ value
# items, 6 attitudes toward immigration, age, female, years of education) the
# sample size, means and covariance matrix (n − 1) of the complete cases —
# per country, for all countries pooled, and split by gender and age group.
# Only these aggregates leave the ESS files; the microdata stay local.
#
# Rounds:  ESS 2 (2004) Belgium, Luxembourg, Netherlands — the course's Benelux data
#          ESS 11 (2023) Belgium, Netherlands, Germany, France, Great Britain
#
# Run from the app folder:  Rscript scripts/course-data.R
# ---------------------------------------------------------------------------
suppressPackageStartupMessages({ library(haven); library(jsonlite) })

values <- c(
  ipcrtiv = "Self-direction|Thinking up new ideas and being creative is important",
  imprich = "Power|Being rich, having money and expensive things is important",
  ipeqopt = "Universalism|Everyone should be treated equally and have equal opportunities",
  ipshabt = "Achievement|Showing their abilities and being admired is important",
  impsafe = "Security|Living in secure and safe surroundings is important",
  impdiff = "Stimulation|Trying new and different things in life is important",
  ipfrule = "Conformity|People should do what they are told and follow rules",
  ipudrst = "Universalism|Listening to and understanding people who are different is important",
  ipmodst = "Tradition|Being humble and modest, not drawing attention, is important",
  ipgdtim = "Hedonism|Having a good time is important",
  impfree = "Self-direction|Making their own decisions and being free is important",
  iphlppl = "Benevolence|Helping people around them is important",
  ipsuces = "Achievement|Being very successful and recognised for achievements is important",
  ipstrgv = "Security|A strong government that ensures safety is important",
  ipadvnt = "Stimulation|Looking for adventures and taking risks is important",
  ipbhprp = "Conformity|Always behaving properly is important",
  iprspot = "Power|Getting respect from others is important",
  iplylfr = "Benevolence|Being loyal to friends and devoted to people close to them is important",
  impenv  = "Universalism|Caring for nature and the environment is important",
  imptrad = "Tradition|Following traditions handed down by religion or family is important",
  impfun  = "Hedonism|Seeking every chance to have fun is important"
)
immigration <- c(
  imsmetn = "Allow|Allow immigrants of the same race or ethnic group as the majority",
  imdfetn = "Allow|Allow immigrants of a different race or ethnic group from the majority",
  impcntr = "Allow|Allow immigrants from poorer countries outside Europe",
  imbgeco = "Effects|Immigration is good for the country's economy",
  imueclt = "Effects|Cultural life is enriched by immigrants",
  imwbcnt = "Effects|Immigrants make the country a better place to live"
)
background <- c(agea = "Background|Age in years", female = "Background|Female (1) or male (0)", eduyrs = "Background|Years of full-time education")

vnames <- c(names(values), names(immigration), names(background))
meta <- function(v, txt, block, scale) {
  p <- strsplit(txt, "|", fixed = TRUE)[[1]]
  list(name = v, block = block, group = p[1], label = p[2], scale = scale)
}
variables <- c(
  lapply(names(values), \(v) meta(v, values[[v]], "Human values (PVQ-21)", "1 not like me … 6 very much like me")),
  lapply(names(immigration), \(v) meta(v, immigration[[v]], "Attitudes toward immigration",
                                       if (v %in% c("imsmetn", "imdfetn", "impcntr")) "1 allow none … 4 allow many" else "0 bad … 10 good")),
  lapply(names(background), \(v) meta(v, background[[v]], "Background", c(agea = "years", female = "0/1", eduyrs = "years")[[v]]))
)

# ---- recoding: higher = more important / more open
prep <- function(d, round) {
  num <- function(x) as.numeric(zap_labels(x))
  out <- data.frame(cntry = as.character(zap_labels(d$cntry)))
  for (v in names(values)) { x <- num(d[[v]]); x[!(x %in% 1:6)] <- NA; out[[v]] <- 7 - x }
  for (v in c("imsmetn", "imdfetn", "impcntr")) { x <- num(d[[v]]); x[!(x %in% 1:4)] <- NA; out[[v]] <- 5 - x }
  for (v in c("imbgeco", "imueclt", "imwbcnt")) { x <- num(d[[v]]); x[!(x %in% 0:10)] <- NA; out[[v]] <- x }
  age <- if (round == 2) 2004 - num(d$yrbrn) else num(d$agea)
  age[age < 15 | age > 100] <- NA
  out$agea <- age
  g <- num(d$gndr); out$female <- ifelse(g %in% 1:2, as.numeric(g == 2), NA)
  e <- num(d$eduyrs); e[e > 40] <- NA; out$eduyrs <- e
  out
}

base2 <- "../../../Lugano 2025/Lugano2025Code/"
ess2 <- do.call(rbind, lapply(c("NL2.sav", "BE2.sav", "LU2.sav"), \(f) prep(read_sav(paste0(base2, f)), 2)))
cols11 <- c("cntry", paste0(names(values), "a"), names(immigration), "agea", "gndr", "eduyrs")
raw11 <- read_sav(path.expand("~/Downloads/ESS11e04_2/ESS11e04_2.sav"), col_select = all_of(cols11))
names(raw11) <- sub("a$", "", names(raw11)); names(raw11)[names(raw11) == "age"] <- "agea"
raw11 <- raw11[raw11$cntry %in% c("BE", "NL", "DE", "FR", "GB"), ]
ess11 <- prep(raw11, 11)

stats <- function(d) {
  cc <- d[complete.cases(d[, vnames]), vnames]
  n <- nrow(cc)
  S <- cov(cc)
  list(n = n, raw = nrow(d), means = unname(round(colMeans(cc), 5)),
       cov = unname(round(S[lower.tri(S, diag = TRUE)], 6)))   # column-major lower triangle
}
agegroup <- function(a) cut(a, c(14, 39, 59, 100), labels = c("15–39", "40–59", "60+"))
country_name <- c(BE = "Belgium", LU = "Luxembourg", NL = "Netherlands", DE = "Germany", FR = "France", GB = "Great Britain")

round_data <- function(d, id, label, pooled) {
  countries <- sort(unique(d$cntry))
  samples <- list()
  add <- function(key, label, rows) {
    dd <- d[rows, ]
    s <- list(id = key, label = label, all = stats(dd), groups = list())
    if (key == "pooled") s$groups$country <- lapply(setNames(countries, countries), \(c) c(list(label = country_name[[c]]), stats(dd[dd$cntry == c, ])))
    s$groups$gender <- list(male = c(list(label = "Men"), stats(dd[dd$female %in% 0, ])), female = c(list(label = "Women"), stats(dd[dd$female %in% 1, ])))
    ag <- agegroup(dd$agea)
    s$groups$age <- lapply(setNames(levels(ag), levels(ag)), \(l) c(list(label = l), stats(dd[ag %in% l, ])))
    samples[[key]] <<- s
  }
  add("pooled", pooled, rep(TRUE, nrow(d)))
  for (c in countries) add(c, country_name[[c]], d$cntry == c)
  list(id = id, label = label, samples = unname(samples))
}

# ---- simulated teaching data (the ESS is cross-sectional and has no multitrait-multimethod design)
suppressPackageStartupMessages(library(lavaan))
sim_round <- function(id, label, d, vars, note) {
  S <- cov(d); n <- nrow(d)
  list(id = id, label = label, simulated = TRUE, note = note, variables = vars,
       samples = list(list(id = "pooled", label = paste0("Simulated · n = ", n),
                           all = list(n = n, raw = n, means = unname(round(colMeans(d), 5)), cov = unname(round(S[lower.tri(S, diag = TRUE)], 6))),
                           groups = setNames(list(), character(0)))))
}
set.seed(2027)
panel_pop <- '
RIx =~ 1*x1 + 1*x2 + 1*x3 + 1*x4
RIy =~ 1*y1 + 1*y2 + 1*y3 + 1*y4
wx1 =~ 1*x1; wx2 =~ 1*x2; wx3 =~ 1*x3; wx4 =~ 1*x4
wy1 =~ 1*y1; wy2 =~ 1*y2; wy3 =~ 1*y3; wy4 =~ 1*y4
RIx ~~ 1*RIx; RIy ~~ 1*RIy; RIx ~~ 0.4*RIy
wx1 ~~ 1*wx1; wy1 ~~ 1*wy1; wx1 ~~ 0.3*wy1
wx2 ~ 0.3*wx1 + 0*wy1; wy2 ~ 0.25*wx1 + 0.3*wy1
wx3 ~ 0.3*wx2 + 0*wy2; wy3 ~ 0.25*wx2 + 0.3*wy2
wx4 ~ 0.3*wx3 + 0*wy3; wy4 ~ 0.25*wx3 + 0.3*wy3
wx2 ~~ 0.9*wx2; wy2 ~~ 0.85*wy2; wx2 ~~ 0.1*wy2
wx3 ~~ 0.9*wx3; wy3 ~~ 0.85*wy3; wx3 ~~ 0.1*wy3
wx4 ~~ 0.9*wx4; wy4 ~~ 0.85*wy4; wx4 ~~ 0.1*wy4
x1 ~~ 0*x1; x2 ~~ 0*x2; x3 ~~ 0*x3; x4 ~~ 0*x4; y1 ~~ 0*y1; y2 ~~ 0*y2; y3 ~~ 0*y3; y4 ~~ 0*y4
RIx ~~ 0*wx1 + 0*wy1; RIy ~~ 0*wx1 + 0*wy1
'
panel <- simulateData(panel_pop, sample.nobs = 1500)
panel <- panel[, c(paste0("x", 1:4), paste0("y", 1:4))]
panel_vars <- c(lapply(1:4, \(t) list(name = paste0("x", t), block = "Contact with immigrants (x)", group = paste0("Wave ", t), label = "Frequency of contact with immigrants", scale = "standardised")),
                lapply(1:4, \(t) list(name = paste0("y", t), block = "Openness to immigration (y)", group = paste0("Wave ", t), label = "Openness to immigration", scale = "standardised")))
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
mtmm <- mtmm[, c("parl_a", "legal_a", "police_a", "parl_b", "legal_b", "police_b", "parl_c", "legal_c", "police_c")]
mlab <- c(a = "0–10 scale", b = "4-point agree–disagree", c = "5-point scale")
tlab <- c(parl = "Trust in parliament", legal = "Trust in the legal system", police = "Trust in the police")
mtmm_vars <- lapply(names(mtmm), \(v) { p <- strsplit(v, "_")[[1]]; list(name = v, block = paste0("Method ", p[2], ": ", mlab[[p[2]]]), group = tlab[[p[1]]], label = paste0(tlab[[p[1]]], ", ", mlab[[p[2]]]), scale = "standardised") })

out <- list(
  source = "European Social Survey, rounds 2 (2004) and 11 (2023), ESS ERIC. Aggregated statistics (complete cases) computed for teaching; the microdata are available at europeansocialsurvey.org.",
  variables = variables,
  rounds = list(
    round_data(ess2, "ess2004", "ESS 2004 · Benelux", "Benelux (all three)"),
    round_data(ess11, "ess2023", "ESS 2023 · five countries", "All five countries"),
    sim_round("panel", "Simulated panel · 4 waves", panel, panel_vars,
              "Simulated for teaching: stable differences between people (random intercepts) plus a within-person effect of contact on openness (0.25) and none the other way."),
    sim_round("mtmm", "Simulated MTMM · 3 traits × 3 methods", mtmm, mtmm_vars,
              "Simulated for teaching: three kinds of trust, each asked in three response formats; every format adds its own method variance.")
  )
)
dir.create("public/data", showWarnings = FALSE, recursive = TRUE)
write_json(out, "public/data/course-data.json", auto_unbox = TRUE, digits = NA)
for (r in out$rounds) for (s in r$samples) cat(sprintf("%-8s %-28s n = %5d of %5d\n", r$id, s$label, s$all$n, s$all$raw))
cat(sprintf("written: public/data/course-data.json (%.0f kB)\n", file.size("public/data/course-data.json") / 1024))
