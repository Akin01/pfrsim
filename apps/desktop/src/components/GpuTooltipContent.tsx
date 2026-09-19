import { Component } from "solid-js";
import { Zap } from "lucide-solid";
import type { DetectedGpuInfo } from "../utils/train";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface GpuTooltipContentProps {
  detectedGpuInfo: DetectedGpuInfo | null;
  isGpuAvailable: boolean;
}

export const GpuTooltipContent: Component<GpuTooltipContentProps> = (props) => {
  const t = () => catalogs[view.lang];
  const info = () => props.detectedGpuInfo;
  const score = () => info()?.score ?? (props.isGpuAvailable ? 78 : 0);
  const name = () => info()?.name || t().trainGpuDefaultName;
  const tier = () =>
    info()?.tier || (props.isGpuAvailable ? t().trainGpuDefaultTier : t().trainGpuNoGpu);
  const vram = () => info()?.vram_mb;
  const speedup = () => info()?.estimated_speedup || "~3.5x – 5x vs CPU";
  const driver = () => info()?.driver_version;
  const backend = () => info()?.backend || "DirectX / Metal / Vulkan / WebGPU";

  return (
    <div class="space-y-2.5 p-1 select-none text-left font-sans">
      <div class="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
        <div class="flex items-center space-x-1.5 text-cyan-600 dark:text-cyan-400 font-bold text-xs">
          <Zap size={13} />
          <span>{t().trainGpuAccel}</span>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
          {t().trainGpuScore(score())}
        </span>
      </div>

      <div>
        <span class="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono block">
          {name()}
        </span>
        <span class="text-[10px] text-slate-500 dark:text-slate-400">{tier()}</span>
      </div>

      {/* Benchmark Score Meter */}
      <div class="space-y-1">
        <div class="flex items-center justify-between text-[10px]">
          <span class="text-slate-500 dark:text-slate-400">{t().trainGpuBenchmarkScore}</span>
          <span class="font-bold text-cyan-600 dark:text-cyan-400 font-mono">{score()} / 100</span>
        </div>
        <div class="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            class="h-full bg-linear-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${score()}%` }}
          />
        </div>
      </div>

      {/* Specifications Grid */}
      <div class="grid grid-cols-2 gap-1.5 pt-0.5 text-[10px] font-mono">
        <div class="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <span class="text-slate-400 dark:text-slate-500 block text-[9px] uppercase">
            {t().trainGpuVram}
          </span>
          <span class="font-bold text-slate-800 dark:text-slate-200">
            {vram() ? `${(vram()! / 1024).toFixed(1)} GB` : "Hardware VRAM"}
          </span>
        </div>
        <div class="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <span class="text-slate-400 dark:text-slate-500 block text-[9px] uppercase">
            {t().trainGpuEstSpeedup}
          </span>
          <span class="font-bold text-emerald-600 dark:text-emerald-400">{speedup()}</span>
        </div>
      </div>

      <div class="text-[9px] text-slate-400 dark:text-slate-500 font-mono pt-0.5 flex items-center justify-between">
        <span>{driver() ? t().trainGpuDriver(driver()!) : t().trainGpuHardwareLayer}</span>
        <span>{backend()}</span>
      </div>
    </div>
  );
};
