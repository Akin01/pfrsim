import type { Lang } from "../i18n/catalog";
import type { SimulationFrame } from "../lib/types";

export interface NarrativeOutput {
  version: "narrative_v1";
  bullets: string[];
}

export function generateNarrative(frames: SimulationFrame[], lang: Lang): NarrativeOutput {
  if (!frames || frames.length === 0) {
    return {
      version: "narrative_v1",
      bullets: [lang === "id" ? "Data belum tersedia." : "No simulation data available."],
    };
  }

  const forecastFrames = frames.filter((f) => f.is_forecast);
  const historyFrames = frames.filter((f) => !f.is_forecast);

  const evalFrames = forecastFrames.length > 0 ? forecastFrames : historyFrames;
  const first = evalFrames[0];
  const last = evalFrames[evalFrames.length - 1];

  const bullets: string[] = [];

  // 1. Water Table Driver
  const wtAvg = evalFrames.reduce((acc, f) => acc + f.wt, 0) / evalFrames.length;
  const wtDelta = last.wt - first.wt;
  const wtTrend = Math.abs(wtDelta) < 0.03 ? "stable" : wtDelta > 0 ? "rising" : "falling";

  if (lang === "id") {
    let wtLevel = "dalam (kritis)";
    if (wtAvg > -0.4) wtLevel = "dangkal (aman)";
    else if (wtAvg > -0.8) wtLevel = "moderat";

    let trendDesc = "stabil";
    if (wtTrend === "rising") trendDesc = "sedikit naik";
    if (wtTrend === "falling") trendDesc = "terus menyusut turun";

    bullets.push(
      `Tinggi muka air tanah rata-rata ${Math.abs(wtAvg).toFixed(2)} m di bawah permukaan (${wtLevel}) dan cenderung ${trendDesc}.`,
    );
  } else {
    let wtLevel = "critically deep";
    if (wtAvg > -0.4) wtLevel = "shallow (safe)";
    else if (wtAvg > -0.8) wtLevel = "moderate";

    let trendDesc = "steady";
    if (wtTrend === "rising") trendDesc = "trending upward";
    if (wtTrend === "falling") trendDesc = "subsiding deeper";

    bullets.push(
      `Water table averages ${Math.abs(wtAvg).toFixed(2)} m below surface (${wtLevel}) and is ${trendDesc}.`,
    );
  }

  // 2. Soil Moisture Driver
  const smFirst = first.sm;
  const smLast = last.sm;
  const smDelta = smLast - smFirst;
  const smAvg = evalFrames.reduce((acc, f) => acc + f.sm, 0) / evalFrames.length;

  if (lang === "id") {
    let smLevel = "kering rapuh (<35%)";
    if (smAvg >= 50) smLevel = "basah (>50%)";
    else if (smAvg >= 35) smLevel = "lembab sedang (35-50%)";

    let smTrendText = "stabil";
    if (smDelta < -1.0)
      smTrendText = `mengalami penurunan (dari ${smFirst.toFixed(1)}% ke ${smLast.toFixed(1)}%)`;
    else if (smDelta > 1.0) smTrendText = `mengalami peningkatan ke ${smLast.toFixed(1)}%`;

    bullets.push(
      `Kadar kelembaban tanah berada pada kondisi ${smLevel}, dengan tren ${smTrendText}.`,
    );
  } else {
    let smLevel = "critically dry (<35%)";
    if (smAvg >= 50) smLevel = "moist (>50%)";
    else if (smAvg >= 35) smLevel = "moderately moist (35-50%)";

    let smTrendText = "steady";
    if (smDelta < -1.0)
      smTrendText = `depleting (from ${smFirst.toFixed(1)}% down to ${smLast.toFixed(1)}%)`;
    else if (smDelta > 1.0) smTrendText = `improving up to ${smLast.toFixed(1)}%`;

    bullets.push(`Peat soil moisture is currently ${smLevel}, ${smTrendText}.`);
  }

  // 3. Rainfall Driver
  const rfTotal = evalFrames.reduce((acc, f) => acc + f.rf, 0);
  const rfMax = Math.max(...evalFrames.map((f) => f.rf));

  if (lang === "id") {
    if (rfTotal < 0.5) {
      bullets.push(
        "Hampir tidak ada curah hujan yang signifikan diproyeksikan (< 0.5 mm total akumulasi).",
      );
    } else if (rfMax >= 5.0) {
      bullets.push(
        `Terdapat potensi hujan signifikan dengan puncak hingga ${rfMax.toFixed(1)} mm yang dapat membasahi permukaan.`,
      );
    } else {
      bullets.push(
        `Hujan intensitas ringan diperkirakan terjadi (akumulasi ${rfTotal.toFixed(1)} mm), belum cukup meredam kekeringan.`,
      );
    }
  } else {
    if (rfTotal < 0.5) {
      bullets.push("Negligible precipitation anticipated across the period (< 0.5 mm total rain).");
    } else if (rfMax >= 5.0) {
      bullets.push(
        `Significant rainfall event projected with peak reaching ${rfMax.toFixed(1)} mm, providing temporary surface wetting.`,
      );
    } else {
      bullets.push(
        `Only light showers forecasted (${rfTotal.toFixed(1)} mm cumulative), insufficient to saturate deeper peat.`,
      );
    }
  }

  // 4. Temperature Driver
  const tempAvg = evalFrames.reduce((acc, f) => acc + f.temp, 0) / evalFrames.length;

  if (lang === "id") {
    if (tempAvg >= 35.0) {
      bullets.push(
        `Suhu udara harian terpantau tinggi (~${tempAvg.toFixed(1)}°C), mempercepat penguapan air dari lahan.`,
      );
    } else {
      bullets.push(`Suhu udara relatif sejuk rata-rata ${tempAvg.toFixed(1)}°C.`);
    }
  } else {
    if (tempAvg >= 35.0) {
      bullets.push(
        `Ambient temperatures remain elevated (~${tempAvg.toFixed(1)}°C), driving persistent evapotranspiration.`,
      );
    } else {
      bullets.push(`Moderate average daily temperature recorded around ${tempAvg.toFixed(1)}°C.`);
    }
  }

  return {
    version: "narrative_v1",
    bullets,
  };
}
