import { Component } from "solid-js";

export interface CircularProgressProps {
  progress: number; // 0.0 to 1.0
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export const CircularProgress: Component<CircularProgressProps> = (props) => {
  const size = () => props.size ?? 54;
  const strokeWidth = () => props.strokeWidth ?? 5;
  const radius = () => (size() - strokeWidth()) / 2;
  const circumference = () => 2 * Math.PI * radius();
  const clamped = () => Math.max(0, Math.min(props.progress, 1));
  const offset = () => circumference() * (1 - clamped());
  const pct = () => Math.round(clamped() * 100);

  return (
    <div
      class="relative flex items-center justify-center shrink-0"
      style={{ width: `${size()}px`, height: `${size()}px` }}
    >
      <svg class="w-full h-full -rotate-90" viewBox={`0 0 ${size()} ${size()}`}>
        {/* Background track */}
        <circle
          cx={size() / 2}
          cy={size() / 2}
          r={radius()}
          fill="none"
          class="stroke-slate-300/80 dark:stroke-slate-800"
          stroke-width={strokeWidth()}
        />
        {/* Animated progress ring */}
        <circle
          cx={size() / 2}
          cy={size() / 2}
          r={radius()}
          fill="none"
          stroke={props.color ?? "#10b981"}
          stroke-width={strokeWidth()}
          stroke-linecap="round"
          stroke-dasharray={String(circumference())}
          stroke-dashoffset={String(offset())}
          class="transition-all duration-300 ease-out"
        />
      </svg>
      <div class="absolute inset-0 flex items-center justify-center text-center select-none">
        <span class="text-[11px] font-bold text-slate-800 dark:text-slate-100 font-mono">
          {pct()}%
        </span>
      </div>
    </div>
  );
};
