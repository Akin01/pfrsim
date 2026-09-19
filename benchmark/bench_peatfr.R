# benchmark/bench_peatfr.R
# Benchmark for peatfr R package on Sabangau peatland dataset (192 daily observations)

suppressPackageStartupMessages({
  library(peatfr)
  library(forecast)
  library(VIM)
  library(zoo)
  library(ggplot2)
})

# Redirect all graphics output to null device during benchmarking
pdf(NULL)

# Read dataset: sabangau_sample.csv (192 observations from Sabangau, Central Kalimantan)
data_path <- normalizePath(file.path(getwd(), "fixtures/sabangau_sample.csv"))
raw_data <- read.csv(data_path, dec = ",", stringsAsFactors = FALSE)
WT <- as.numeric(gsub(",", ".", as.character(raw_data$Water.Table)))
SM <- as.numeric(gsub(",", ".", as.character(raw_data$Soil.Moisture)))
Rf <- as.numeric(gsub(",", ".", as.character(raw_data$Rainfall)))
Temp <- as.numeric(gsub(",", ".", as.character(raw_data$Temperature)))

measure_ms <- function(expr, reps = 5) {
  times <- numeric(reps)
  for (i in 1:reps) {
    t0 <- Sys.time()
    res <- force(expr())
    t1 <- Sys.time()
    times[i] <- as.numeric(difftime(t1, t0, units = "secs")) * 1000
  }
  median(times)
}

cat("=== RUNNING R (peatfr) BENCHMARK ON SABANGAU DATASET (192 ROWS) ===\n")
cat(sprintf("Observations: %d rows | Missing counts: WT=%d, SM=%d, Rf=%d, Temp=%d\n\n",
  length(WT), sum(is.na(WT)), sum(is.na(SM)), sum(is.na(Rf)), sum(is.na(Temp))))

# 1. Microbenchmarks: Imputation
cat("1. Running Imputation Microbenchmarks...\n")
linear_ms <- measure_ms(function() linear_interpolation(WT, SM, Rf, Temp), 5)
cat(sprintf("   - Linear: %.2f ms\n", linear_ms))

spline_ms <- measure_ms(function() spline_interpolation(WT, SM, Rf, Temp), 5)
cat(sprintf("   - Cubic Spline: %.2f ms\n", spline_ms))

loess_ms <- measure_ms(function() loess_interpolation(WT, SM, Rf, Temp, span = 0.5), 5)
cat(sprintf("   - LOESS (span=0.5): %.2f ms\n", loess_ms))

knn_ms <- measure_ms(function() knn_imputation(WT, SM, Rf, Temp, k = 5), 3)
cat(sprintf("   - k-NN (k=5): %.2f ms\n", knn_ms))

# Impute series for downstream standalone stage benchmarks
imp_lin <- linear_interpolation(WT, SM, Rf, Temp)
WT_i <- imp_lin$Water_Table
SM_i <- imp_lin$Soil_Moisture
Rf_i <- imp_lin$Rainfall
Temp_i <- imp_lin$Temperature

# 2. Microbenchmark: AutoARIMA Forecasting (h=4)
cat("\n2. Running AutoARIMA Forecaster Microbenchmark (h=4)...\n")
arima_ms <- measure_ms(function() autopredictarima(WT_i, SM_i, Rf_i, Temp_i, h = 4), 3)
cat(sprintf("   - AutoARIMA: %.2f ms\n", arima_ms))

# 3. Microbenchmark: Nelder-Mead PFVI Calibration (firepredict)
cat("\n3. Running Nelder-Mead PFVI Optimization Microbenchmark (firepredict)...\n")
pfvi_ms <- measure_ms(function() firepredict(WT_i, SM_i, Rf_i, Temp_i, R0 = 2700, dt = 1, h = 4), 1)
cat(sprintf("   - Nelder-Mead PFVI: %.2f ms\n", pfvi_ms))

# 4. End-to-End Pipeline: autopeatfr
cat("\n4. Running End-to-End autopeatfr Pipelines...\n")
cat("   - autopeatfr(linear + arima)...\n")
e2e_linear_arima_ms <- measure_ms(function() autopeatfr(WT, SM, Rf, Temp, imputation = "linear", model = "arima", h = 4, R0 = 2700, dt = 1), 1)
cat(sprintf("     -> %.2f ms\n", e2e_linear_arima_ms))

cat("   - autopeatfr(spline + arima)...\n")
e2e_spline_arima_ms <- measure_ms(function() autopeatfr(WT, SM, Rf, Temp, imputation = "spline", model = "arima", h = 4, R0 = 2700, dt = 1), 1)
cat(sprintf("     -> %.2f ms\n", e2e_spline_arima_ms))

cat("   - autopeatfr(loess + arima)...\n")
e2e_loess_arima_ms <- measure_ms(function() autopeatfr(WT, SM, Rf, Temp, imputation = "loess", model = "arima", h = 4, R0 = 2700, dt = 1), 1)
cat(sprintf("     -> %.2f ms\n", e2e_loess_arima_ms))

cat("   - autopeatfr(knn + arima)...\n")
e2e_knn_arima_ms <- measure_ms(function() autopeatfr(WT, SM, Rf, Temp, imputation = "knn", model = "arima", h = 4, R0 = 2700, dt = 1), 1)
cat(sprintf("     -> %.2f ms\n", e2e_knn_arima_ms))

output_json <- sprintf('{
  "dataset": "sabangau_sample.csv (192 rows)",
  "stages": {
    "linear_impute_ms": %.2f,
    "spline_impute_ms": %.2f,
    "loess_impute_ms": %.2f,
    "knn_impute_ms": %.2f,
    "arima_forecast_ms": %.2f,
    "pfvi_calibration_ms": %.2f
  },
  "e2e": {
    "linear_arima_ms": %.2f,
    "spline_arima_ms": %.2f,
    "loess_arima_ms": %.2f,
    "knn_arima_ms": %.2f
  }
}', linear_ms, spline_ms, loess_ms, knn_ms, arima_ms, pfvi_ms,
    e2e_linear_arima_ms, e2e_spline_arima_ms, e2e_loess_arima_ms, e2e_knn_arima_ms)

writeLines(output_json, "benchmark/peatfr_benchmark.json")
cat("\nResults written to benchmark/peatfr_benchmark.json\n")
