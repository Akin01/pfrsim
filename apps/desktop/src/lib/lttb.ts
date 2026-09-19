/**
 * Largest-Triangle-Three-Buckets (LTTB) Downsampling Algorithm
 * Reference: Sveinn Steinarsson (2013), "Downsampling Time Series for Visual Representation"
 *
 * Downsamples high-frequency time series (e.g. 100k - 1M points) to `threshold` points
 * while strictly preserving all local peaks, troughs, and visual shape.
 */
export function lttbDownsample(
  x: number[],
  y: (number | null)[],
  threshold = 2500,
): [number[], (number | null)[]] {
  const n = x.length;
  if (n <= threshold || threshold < 3) return [x, y];

  const outX: number[] = Array.from({ length: threshold });
  const outY: (number | null)[] = Array.from({ length: threshold });

  const every = (n - 2) / (threshold - 2);

  let aX = x[0];
  let aY = y[0] ?? 0;
  outX[0] = aX;
  outY[0] = y[0];

  for (let i = 0; i < threshold - 2; i++) {
    const nextStart = Math.min(n - 1, Math.floor((i + 1) * every) + 1);
    const nextEnd = Math.min(n, Math.floor((i + 2) * every) + 1);

    let avgX = 0;
    let avgY = 0;
    let validCount = 0;

    for (let idx = nextStart; idx < nextEnd; idx++) {
      avgX += x[idx];
      const val = y[idx];
      if (val != null) {
        avgY += val;
        validCount++;
      }
    }
    if (validCount > 0) avgY /= validCount;
    const nextLen = nextEnd - nextStart;
    if (nextLen > 0) avgX /= nextLen;

    const curStart = Math.min(n - 1, Math.floor(i * every) + 1);
    const curEnd = Math.min(n, Math.floor((i + 1) * every) + 1);

    let maxArea = -1;
    let bestIdx = curStart;

    for (let idx = curStart; idx < curEnd; idx++) {
      const bx = x[idx];
      const by = y[idx] ?? aY;

      const area = Math.abs((aX - avgX) * (by - aY) - (aX - bx) * (avgY - aY)) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        bestIdx = idx;
      }
    }

    outX[i + 1] = x[bestIdx];
    outY[i + 1] = y[bestIdx];

    aX = x[bestIdx];
    aY = y[bestIdx] ?? aY;
  }

  outX[threshold - 1] = x[n - 1];
  outY[threshold - 1] = y[n - 1];

  return [outX, outY];
}

export default lttbDownsample;
