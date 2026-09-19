# Benchmark Suite: R (`peatfr`) vs. Rust (`pfrsim-core`)

This directory contains standalone benchmark scripts to reproduce performance comparisons between the original R package [`peatfr`](https://github.com/mellygsln/peatfr) ([Mahdiyasa et al., 2025](https://doi.org/10.1016/j.ecoinf.2025.103532)) and the native compiled Rust engine (`pfrsim-core`).

## Dataset

- **`fixtures/sabangau_sample.csv`**: Real empirical timeseries of 192 daily observations from the Sabangau peatland station in Central Kalimantan, Indonesia (1 April 2023 – 9 October 2023) containing natural sensor dropouts (NaNs) across Water Table ($WT$), Soil Moisture ($SM$), Precipitation ($Rf$), and Surface Temperature ($Temp$).

## Scripts in this Directory

- **`bench_peatfr.R`**: Runs `peatfr` directly from the installed R package on `fixtures/sabangau_sample.csv`. Measures execution times for missing data imputation (`linear`, `spline`, `loess`, `knn`), AutoARIMA forecasting, Nelder-Mead PFVI calibration, and end-to-end `autopeatfr` pipelines.
- **`run_comparison.py`**: Automated comparison runner that evaluates both environments, computes acceleration speedups, and formats the Markdown comparison table.

## Prerequisites

1. **R ($\ge 4.0$)**:
   ```r
   install.packages(c("forecast", "zoo", "VIM", "ggplot2"))
   remotes::install_github("mellygsln/peatfr")
   ```
2. **Rust ($\ge 1.85$)**:
   ```bash
   cargo build --release -p pfrsim-core --example bench_compare
   ```

## How to Run

1. Run the R benchmarks:
   ```bash
   Rscript benchmark/bench_peatfr.R
   ```
2. Run the Rust benchmarks:
   ```bash
   cargo run --release -p pfrsim-core --example bench_compare
   ```
3. Generate the comparison table:
   ```bash
   python benchmark/run_comparison.py
   ```
