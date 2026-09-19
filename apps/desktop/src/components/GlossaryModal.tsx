import { Component, createMemo, createSignal, For, Show } from "solid-js";
import Dialog from "corvu/dialog";
import { BookOpen, ChartLine, Check, Copy, Cpu, Droplets, Flame, Search, X } from "lucide-solid";
import { MathTex } from "./MathTex";
import { setView, view } from "../lib/store";

export type GlossaryCategory = "all" | "hydro" | "risk" | "timeseries" | "pipeline";

export interface GlossaryItem {
  id: string;
  category: "hydro" | "risk" | "timeseries" | "pipeline";
  titleId: string;
  titleEn: string;
  symbol?: string;
  formula?: string;
  unit?: string;
  descId: string;
  descEn: string;
  thresholdId?: string;
  thresholdEn?: string;
  color: "emerald" | "amber" | "cyan" | "rose" | "blue" | "purple";
}

const GLOSSARY_DATA: GlossaryItem[] = [
  {
    id: "wt",
    category: "hydro",
    titleId: "Kedalaman Muka Air Tanah (WT)",
    titleEn: "Water Table Depth (WT)",
    symbol: "\\text{WT}",
    formula: "\\text{WT} = z_{\\text{water}} - z_{\\text{surface}} \\le 0",
    unit: "meter (m)",
    descId:
      "Jarak vertikal permukaan air tanah di bawah permukaan gambut. Nilai selalu negatif; muka air di bawah -0.4 m mengeringkan horizon gambut atas dan membuka akses oksigen untuk pembakaran membara bawah tanah (smoldering).",
    descEn:
      "Vertical distance of the water table below the ground surface. Always non-positive; levels dropping below -0.4 m desiccate the upper peat horizon, allowing oxygen ingress that sustains subterranean smoldering.",
    thresholdId: "Ambang Kritis: < -0.4 m (Rawan kebakaran bawah tanah)",
    thresholdEn: "Critical Threshold: < -0.4 m (Smoldering vulnerability)",
    color: "cyan",
  },
  {
    id: "sm",
    category: "hydro",
    titleId: "Kadar Air Volumetrik Gambut (SM)",
    titleEn: "Volumetric Soil Moisture (SM)",
    symbol: "\\text{SM}",
    formula: "\\theta = \\frac{V_{\\text{water}}}{V_{\\text{total}}} \\times 100\\%",
    unit: "persen (%)",
    descId:
      "Kadar air volumetrik dalam pori-pori matriks tanah gambut. Kadar air di bawah 30–35% menandakan bahan bakar gambut telah mencapai titik kering kritis dan sangat mudah tersulut percikan api.",
    descEn:
      "Volumetric moisture content within the porous peat matrix. Moisture levels falling below 30–35% signal critical fuel desiccation, rendering organic peat combustible and resistant to suppression.",
    thresholdId: "Ambang Kering: < 30–35% (Bahan bakar siap menyala)",
    thresholdEn: "Dry Threshold: < 30–35% (Ignition ready fuel)",
    color: "emerald",
  },
  {
    id: "rf",
    category: "hydro",
    titleId: "Curah Hujan Harian Akumulatif (Rf)",
    titleEn: "Cumulative Daily Rainfall (Rf)",
    symbol: "\\text{Rf}",
    formula: "P_{\\text{day}} = \\sum_{t=0}^{24\\text{h}} p_t",
    unit: "milimeter (mm)",
    descId:
      "Presipitasi kumulatif harian yang tercatat di stasiun pengamatan cuaca. Hujan harian di atas 5 mm membasahi lapisan serasah atas dan memutus rantai penjalaran api permukaan.",
    descEn:
      "Daily cumulative rainfall measured at the meteorological station. Precipitation exceeding 5 mm/day replenishes surface litter moisture and disrupts active fire propagation pathways.",
    thresholdId: "Ambang Pemutus: > 5 mm/hari (Membasahi serasah atas)",
    thresholdEn: "Suppression Threshold: > 5 mm/day (Replenishes surface layer)",
    color: "blue",
  },
  {
    id: "temp",
    category: "hydro",
    titleId: "Suhu Ambien Udara (Temp)",
    titleEn: "Ambient Air Temperature (Temp)",
    symbol: "T_{\\text{air}}",
    formula: "T_{\\text{avg}} = \\frac{T_{\\text{max}} + T_{\\text{min}}}{2}",
    unit: "derajat Celsius (°C)",
    descId:
      "Suhu udara rata-rata harian. Suhu tinggi memacu laju evapotranspirasi potensial, mempercepat laju pengeringan muka air gambut dan memperbesar defisit tekanan uap udara (VPD).",
    descEn:
      "Daily mean ambient air temperature. Elevated temperature accelerates potential evapotranspiration, steepening groundwater drawdown rates and increasing vapor pressure deficit (VPD).",
    thresholdId: "Suhu Kritis: > 33–35 °C (Evapotranspirasi ekstrem)",
    thresholdEn: "Critical Temp: > 33–35 °C (Accelerated drying)",
    color: "rose",
  },
  {
    id: "pfvi",
    category: "risk",
    titleId: "Peat Fire Vulnerability Index (PFVI)",
    titleEn: "Peat Fire Vulnerability Index (PFVI)",
    symbol: "\\text{PFVI}",
    formula:
      "\\text{PFVI} = f\\big(\\text{WT}, \\text{SM}, \\text{Rf}, T_{\\text{air}}\\big) \\in [0, 300]",
    unit: "skala indeks (0–300)",
    descId:
      "Indeks kerentanan kebakaran lahan gambut terpadu berskala 0 hingga 300. Menggabungkan interaksi non-linear antara defisit air tanah, kekeringan bahan bakar gambut, dan tekanan cuaca.",
    descEn:
      "Integrated tropical peat fire vulnerability index on a continuous scale of 0 to 300. Synthesizes non-linear interactions across groundwater deficits, combustible fuel desiccation, and meteorological stress.",
    thresholdId:
      "Skala Bahaya: 0–75 (Rendah), 76–150 (Sedang), 151–225 (Tinggi), 226–300 (Ekstrem)",
    thresholdEn: "Hazard Scale: 0–75 (Low), 76–150 (Moderate), 151–225 (High), 226–300 (Extreme)",
    color: "amber",
  },
  {
    id: "diobs",
    category: "risk",
    titleId: "Indeks Kekeringan Terobservasi (DIobs)",
    titleEn: "Observed Drought Index (DIobs)",
    symbol: "\\text{DI}_{\\text{obs}}",
    formula:
      "\\text{DI}_{\\text{obs}}(t) = 300 \\times \\left(1 - \\frac{\\text{SM}(t) - \\text{FC}}{\\text{SAT} - \\text{FC}}\\right)",
    unit: "skala kekeringan (0–300)",
    descId:
      "Indeks kekeringan empiris berbasis kadar air tanah (Soil Moisture). Berfungsi sebagai target kebenaran lapangan (ground truth) untuk mengkalibrasi model PFVI melalui optimasi Nelder-Mead, serta sebagai nilai awal (seed x0) rekursi kerentanan kebakaran.",
    descEn:
      "Empirical ground-truth drought and fire vulnerability index derived directly from volumetric soil moisture (SM). Serves as the optimization target for Nelder-Mead calibration of PFVI parameters and initializes the dynamic fire risk recursion at t = 0.",
    thresholdId:
      "Ambang Batas: SM = SAT (70%) ➔ DIobs = 0 (Aman); SM ≤ FC (40%) ➔ DIobs = 300 (Bahaya Ekstrem)",
    thresholdEn:
      "Reference Bounds: SM = SAT (70%) ➔ DIobs = 0 (Safe); SM ≤ FC (40%) ➔ DIobs = 300 (Extreme Danger)",
    color: "amber",
  },
  {
    id: "classes",
    category: "risk",
    titleId: "Klasifikasi 4 Tingkat Bahaya Kebakaran",
    titleEn: "4-Tier Fire Hazard Classification",
    symbol: "\\text{Tier} \\in [1, 4]",
    formula:
      "\\text{Severity} = \\begin{cases} \\text{Rendah}, & \\text{PFVI} \\le 75 \\\\ \\text{Sedang}, & 75 < \\text{PFVI} \\le 150 \\\\ \\text{Tinggi}, & 150 < \\text{PFVI} \\le 225 \\\\ \\text{Ekstrem}, & \\text{PFVI} > 225 \\end{cases}",
    unit: "kategori operasional",
    descId:
      "Tingkat siaga operasional pengelolaan lahan gambut: Rendah (gambut basah/tergenang), Sedang (waspada penurunan muka air), Tinggi (siaga patroli dan pencegahan), Ekstrem (mobilisasi pemadaman dan rewetting).",
    descEn:
      "Standard operational response tiers: Low (saturated/safe peat), Moderate (groundwater drying advisory), High (active patrol & prevention ready), Extreme (wildfire suppression & canal blocking mobilized).",
    thresholdId: "Tinggi & Ekstrem: Wajib aktivasi sekat kanal dan patroli satgas",
    thresholdEn: "High & Extreme: Canal blocking and task force patrol mandatory",
    color: "rose",
  },
  {
    id: "stl",
    category: "timeseries",
    titleId: "Dekomposisi Deret Waktu (STL)",
    titleEn: "STL Time-Series Decomposition",
    symbol: "y_t = T_t + S_t + R_t",
    formula: "y_t = \\text{Trend}_t + \\text{Seasonal}_t + \\text{Residual}_t",
    unit: "komponen sinyal",
    descId:
      "Metode Seasonal and Trend using LOESS untuk memisahkan sinyal hidrologi menjadi tren jangka panjang (T), siklus musiman tahunan (S), dan anomali residu acak (R).",
    descEn:
      "Seasonal and Trend decomposition using LOESS. Decomposes hydrological sensor signals into long-term secular trend (T), repeating seasonal oscillation (S), and stochastic residual anomalies (R).",
    thresholdId: "Penyaringan Pola: Menghilangkan derau cuaca harian untuk melihat tren inti",
    thresholdEn: "Pattern Filtering: Isolates climate seasonality from short-term noise",
    color: "blue",
  },
  {
    id: "acf",
    category: "timeseries",
    titleId: "Fungsi Autokorelasi (ACF)",
    titleEn: "Autocorrelation Function (ACF)",
    symbol: "\\text{ACF}(k)",
    formula:
      "\\rho_k = \\frac{\\sum_{t=k+1}^N (y_t - \\bar{y})(y_{t-k} - \\bar{y})}{\\sum_{t=1}^N (y_t - \\bar{y})^2}",
    unit: "korelasi [-1, 1]",
    descId:
      "Derajat korelasi linier antara pengamatan deret waktu dengan nilai lag-k sebelumnya. Nilai ACF(1) yang tinggi menunjukkan inersia hidrologis gambut yang lambat bereaksi terhadap perubahan seketika.",
    descEn:
      "Measure of linear correlation between observations separated by lag k. High lag-1 autocorrelation indicates strong hydrological memory and slow drainage/recharge inertia of peat domes.",
    thresholdId: "Inersia Tinggi: ACF(1) > 0.85 (Respons hidrologi gambut bertahap)",
    thresholdEn: "High Inertia: ACF(1) > 0.85 (Slow-response drainage dynamic)",
    color: "cyan",
  },
  {
    id: "adf",
    category: "timeseries",
    titleId: "Uji Stasioneritas Augmented Dickey-Fuller (ADF)",
    titleEn: "Augmented Dickey-Fuller (ADF) Test",
    symbol: "\\Delta y_t = \\alpha + \\beta t + \\gamma y_{t-1} + \\dots",
    formula: "p < 0.05 \\implies \\text{Stasioner / Stationary}",
    unit: "nilai-p (p-value)",
    descId:
      "Uji hipotesis statistik untuk memeriksa keberadaan akar unit (unit root). Deret waktu yang stasioner (p < 0.05) memiliki rata-rata dan varians konstan sepanjang waktu, prasyarat model autoregresif.",
    descEn:
      "Hypothesis test identifying unit roots in time series. Stationary data (p < 0.05) exhibits time-invariant mean and variance, a key requirement for reliable AutoARIMA and neural models.",
    thresholdId: "Stasioner jika p < 0.05; jika p ≥ 0.05 data memerlukan diferensiasi",
    thresholdEn: "Stationary if p < 0.05; differencing required if p ≥ 0.05",
    color: "purple",
  },
  {
    id: "imputation",
    category: "pipeline",
    titleId: "Imputasi Nilai Hilang Sensor (KNN, Spline, LOESS)",
    titleEn: "Sensor Missing Data Imputation (KNN, Spline, LOESS)",
    symbol: "\\hat{y}_t = \\sum w_i y_i",
    formula: "\\hat{y}_t = f\\big(\\{y_{t-k}, \\dots, y_{t+k}\\}\\big)",
    unit: "rekonstruksi data",
    descId:
      "Algoritma pemulihan celah data sensor telemetry. Linear menghubungkan titik lurus; Spline menjaga kontinuitas kurva turunan kedua; LOESS menghaluskan fluktuasi; KNN meminjam bobot tetangga multivariate.",
    descEn:
      "Algorithms for repairing telemetry dropouts and sensor blackouts. Linear interpolates linearly; Spline guarantees continuous curvature; LOESS fits local polynomials; KNN infers from nearest multivariate states.",
    thresholdId: "Konservasi Dinamika: Mempertahankan laju pengeringan dan kenaikan muka air alami",
    thresholdEn: "Dynamic Fidelity: Preserves natural physical recharge and drawdown slopes",
    color: "emerald",
  },
  {
    id: "forecaster",
    category: "pipeline",
    titleId: "Arsitektur Prakiraan Multi-Langkah (GRU, LSTM, ARIMA)",
    titleEn: "Multi-Step Forecasting Models (GRU, LSTM, ARIMA)",
    symbol: "\\hat{y}_{t+1:t+H}",
    formula: "h_t = \\tanh\\big(W_h x_t + U_h (r_t \\odot h_{t-1}) + b_h\\big)",
    unit: "prakiraan deret waktu",
    descId:
      "Model prediktif untuk memproyeksikan dinamika muka air tanah ke masa depan (cakrawala horizon 7 hingga 30 hari). Arsitektur recurrent (GRU/LSTM) menangkap dinamika non-linear kompleks.",
    descEn:
      "Predictive models projecting peat hydrology into the future across 7- to 30-day forecast horizons. Recurrent architectures (GRU/LSTM) capture complex non-linear meteorological responses.",
    thresholdId:
      "Horizon Prakiraan: Memberikan peringatan dini sebelum gambut mencapai titik bakar",
    thresholdEn:
      "Lead Time: Provides critical early warning before peat reaches ignition threshold",
    color: "purple",
  },
  {
    id: "provenance",
    category: "pipeline",
    titleId: "Determinisme & Keterlacakan Model (Provenance)",
    titleEn: "Model Determinism & Scientific Provenance",
    symbol: "\\text{Seed} \\in \\mathbb{N}",
    formula:
      "\\text{RunArtifact} = \\mathcal{M}\\big(\\mathcal{D}, \\text{Config}, \\text{SHA-256}\\big)",
    unit: "integritas ilmiah",
    descId:
      "Jaminan reproduktibilitas komputasi. Setiap pelatihan model dan simulasi menggunakan PRNG seed tetap dan dicatat bersama hash SHA-256 dataset masukan, memastikan verifikasi audit tanpa bias.",
    descEn:
      "Scientific reproducibility guarantee. Every model run is governed by fixed PRNG seeds and hashed with SHA-256 checksums, enabling bit-exact re-execution and rigorous auditing.",
    thresholdId:
      "100% Deterministik: Menjamin hasil simulasi yang identik pada masukan dan seed sama",
    thresholdEn: "100% Deterministic: Ensures identical outcomes on repeated runs with fixed seed",
    color: "amber",
  },
];

export const GlossaryModal: Component = () => {
  const [search, setSearch] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<GlossaryCategory>("all");
  const [copiedId, setCopiedId] = createSignal<string | null>(null);

  const lang = () => view.lang;

  const categories = createMemo(() => [
    {
      id: "all" as GlossaryCategory,
      labelId: "Semua Istilah",
      labelEn: "All Terms",
      icon: BookOpen,
    },
    {
      id: "hydro" as GlossaryCategory,
      labelId: "Hidrologi & Cuaca",
      labelEn: "Hydro-Climate",
      icon: Droplets,
    },
    {
      id: "risk" as GlossaryCategory,
      labelId: "Risiko Kebakaran",
      labelEn: "Fire Hazard",
      icon: Flame,
    },
    {
      id: "timeseries" as GlossaryCategory,
      labelId: "Deret Waktu (STL/ACF)",
      labelEn: "Time-Series",
      icon: ChartLine,
    },
    {
      id: "pipeline" as GlossaryCategory,
      labelId: "Pemodelan & AI",
      labelEn: "Pipelines & AI",
      icon: Cpu,
    },
  ]);

  const filteredItems = createMemo(() => {
    const q = search().trim().toLowerCase();
    const cat = selectedCategory();

    return GLOSSARY_DATA.filter((item) => {
      // Category filter
      if (cat !== "all" && item.category !== cat) return false;

      // Query filter
      if (!q) return true;

      const title = (lang() === "id" ? item.titleId : item.titleEn).toLowerCase();
      const desc = (lang() === "id" ? item.descId : item.descEn).toLowerCase();
      const threshold =
        (lang() === "id" ? item.thresholdId : item.thresholdEn)?.toLowerCase() ?? "";
      const unit = item.unit?.toLowerCase() ?? "";
      const symbol = item.symbol?.toLowerCase() ?? "";

      return (
        title.includes(q) ||
        desc.includes(q) ||
        threshold.includes(q) ||
        unit.includes(q) ||
        symbol.includes(q) ||
        item.id.toLowerCase().includes(q)
      );
    });
  });

  const copyFormula = (item: GlossaryItem, e: MouseEvent) => {
    e.stopPropagation();
    const textToCopy =
      item.formula || item.symbol || (lang() === "id" ? item.titleId : item.titleEn);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedId(item.id);
      setTimeout(() => {
        setCopiedId(null);
      }, 1800);
    }
  };

  return (
    <Dialog open={view.showGlossary} onOpenChange={(open) => setView("showGlossary", open)}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-transparent backdrop-blur-md transition-all duration-150 data-open:opacity-100 data-closed:opacity-0" />
        <Dialog.Content class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-[94vw] shadow-2xl flex flex-col max-h-[88vh] focus:outline-none overflow-hidden transition-all duration-150 data-open:opacity-100 data-open:scale-100 data-closed:opacity-0 data-closed:scale-95">
          {/* Header */}
          <div class="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <BookOpen size={18} />
                </div>
                <Dialog.Label class="text-base font-bold text-slate-900 dark:text-slate-100 font-sans tracking-tight">
                  {lang() === "id"
                    ? "Glosarium Istilah & Sains Gambut"
                    : "Peatland Science & Technical Glossary"}
                </Dialog.Label>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 pl-8">
                {lang() === "id"
                  ? "Kompilasi parameter hidrologis, rumus matematika, dan indikator bahaya kebakaran lahan gambut tropis."
                  : "Comprehensive reference of hydrological parameters, formulas, and tropical peat fire risk thresholds."}
              </p>
            </div>

            <Dialog.Close
              class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer shrink-0"
              title={lang() === "id" ? "Tutup (Esc)" : "Close (Esc)"}
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Search & Category Filter Toolbar */}
          <div class="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
            {/* Search Input Bar with embedded count badge */}
            <div class="relative flex items-center">
              <Search
                size={15}
                class="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
                placeholder={
                  lang() === "id"
                    ? "Cari istilah, formula matematika, unit, atau kata kunci..."
                    : "Search terms, mathematical formulas, units, or keywords..."
                }
                class="w-full pl-9 pr-28 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <div class="absolute right-2.5 flex items-center gap-1.5">
                <Show when={search()}>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    class="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X size={12} />
                  </button>
                </Show>
                <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/70 shadow-2xs select-none whitespace-nowrap">
                  <span>{filteredItems().length}</span>
                  <span class="ml-1">{lang() === "id" ? "istilah" : "terms"}</span>
                </span>
              </div>
            </div>

            {/* Category Filter Pills (Full Width) */}
            <div class="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-xs font-sans w-full">
              <For each={categories()}>
                {(cat) => {
                  const Icon = cat.icon;
                  const isSelected = () => selectedCategory() === cat.id;
                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      class={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                        isSelected()
                          ? "bg-emerald-600 text-white shadow-xs font-semibold"
                          : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60"
                      }`}
                    >
                      <Icon size={12} class="shrink-0" />
                      <span>{lang() === "id" ? cat.labelId : cat.labelEn}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          {/* Terms List Body */}
          <div class="flex-1 overflow-y-auto p-4 space-y-3.5 divide-y divide-slate-100 dark:divide-slate-800/60">
            <For each={filteredItems()}>
              {(item) => (
                <div class="pt-3.5 first:pt-0 group/card">
                  <div class="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-150 space-y-2.5 shadow-2xs">
                    {/* Top Row: Title, Symbol, Badges & Copy */}
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <h3 class="font-bold text-sm text-slate-900 dark:text-slate-100 font-sans tracking-tight">
                          {lang() === "id" ? item.titleId : item.titleEn}
                        </h3>
                        <Show when={item.symbol}>
                          <div class="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs border border-slate-300/60 dark:border-slate-700/60 inline-flex items-center">
                            <MathTex math={item.symbol!} />
                          </div>
                        </Show>
                      </div>

                      <div class="flex items-center gap-2">
                        <Show when={item.unit}>
                          <span class="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/90 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/70">
                            {item.unit}
                          </span>
                        </Show>

                        {/* Copy Formula / Symbol Button */}
                        <button
                          type="button"
                          onClick={(e) => copyFormula(item, e)}
                          class="p-1 rounded-md text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                          title={lang() === "id" ? "Salin rumus / simbol" : "Copy formula / symbol"}
                        >
                          <Show when={copiedId() === item.id} fallback={<Copy size={12} />}>
                            <Check size={12} class="text-emerald-600 dark:text-emerald-400" />
                            <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                              {lang() === "id" ? "Tersalin" : "Copied"}
                            </span>
                          </Show>
                        </button>
                      </div>
                    </div>

                    {/* Formula Mathematical Display */}
                    <Show when={item.formula}>
                      <div class="p-2.5 rounded-lg bg-white dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/90 overflow-x-auto flex items-center justify-start text-xs text-slate-800 dark:text-slate-200">
                        <MathTex math={item.formula!} block={false} class="text-xs" />
                      </div>
                    </Show>

                    {/* Description Paragraph */}
                    <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                      {lang() === "id" ? item.descId : item.descEn}
                    </p>

                    {/* Operational Hazard Threshold Callout (Unified Single Color) */}
                    <Show when={item.thresholdId}>
                      <div class="px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                        <span class="font-bold font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 shrink-0">
                          {lang() === "id" ? "Acuan:" : "Threshold:"}
                        </span>
                        <span class="leading-relaxed">
                          {lang() === "id" ? item.thresholdId : item.thresholdEn}
                        </span>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>

            {/* Empty State when Search has no results */}
            <Show when={filteredItems().length === 0}>
              <div class="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <div class="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                  <Search size={24} />
                </div>
                <div class="space-y-1">
                  <h4 class="text-sm font-semibold text-slate-800 dark:text-slate-200 font-sans">
                    {lang() === "id" ? "Tidak Ada Istilah yang Cocok" : "No Matching Terms Found"}
                  </h4>
                  <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                    {lang() === "id"
                      ? `Tidak ditemukan istilah glosarium untuk kata kunci "${search()}".`
                      : `No glossary terms matched your query for "${search()}".`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("all");
                  }}
                  class="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-medium transition-colors cursor-pointer"
                >
                  {lang() === "id" ? "Reset Pencarian & Filter" : "Reset Search & Filters"}
                </button>
              </div>
            </Show>
          </div>

          {/* Modal Footer */}
          <div class="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span class="flex items-center gap-1.5 font-mono text-[11px]">
              <kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                G
              </kbd>
              <span>
                {lang() === "id"
                  ? "Pintasan cepat untuk membuka glosarium"
                  : "Quick key to open glossary"}
              </span>
            </span>

            <Dialog.Close class="px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors cursor-pointer">
              {lang() === "id" ? "Tutup" : "Close"}
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default GlossaryModal;
