"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme";

interface AngleGaugeProps {
  currentDelta: number;
  onCalibrate: () => void;
}

export function AngleGauge({ currentDelta, onCalibrate }: AngleGaugeProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const maxAngle = 50;
  const clampedDelta = Math.min(currentDelta, maxAngle);
  const percentage = clampedDelta / maxAngle;

  const size = 200;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  const startAngle = Math.PI;
  const currentAngleRad = startAngle - percentage * Math.PI;

  const startX = cx + radius * Math.cos(startAngle);
  const startY = cy - radius * Math.sin(startAngle);
  const currentX = cx + radius * Math.cos(currentAngleRad);
  const currentY = cy - radius * Math.sin(currentAngleRad);
  const endX = cx + radius * Math.cos(0);
  const endY = cy - radius * Math.sin(0);

  let color = "#22c55e";
  if (currentDelta >= 35) color = "#ef4444";
  else if (currentDelta >= 20) color = "#f59e0b";

  const bgArcPath = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;
  const valueArcPath =
    percentage > 0
      ? `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${currentX} ${currentY}`
      : "";

  const bgStroke = isDark ? "#27272a" : "#e4e4e7";
  const tickColor = isDark ? "#52525b" : "#a1a1aa";

  const zones = [
    { angle: 0, label: "0\u00B0" },
    { angle: 20, label: "20\u00B0" },
    { angle: 35, label: "35\u00B0" },
    { angle: 50, label: "50\u00B0" },
  ];

  return (
    <div className="flex flex-col items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <svg
        width={size}
        height={size / 2 + 30}
        viewBox={`0 0 ${size} ${size / 2 + 30}`}
      >
        <path
          d={bgArcPath}
          fill="none"
          stroke={bgStroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {percentage > 0 && (
          <motion.path
            d={valueArcPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />
        )}

        {zones.map((zone) => {
          const zp = zone.angle / maxAngle;
          const za = startAngle - zp * Math.PI;
          const ir = radius - strokeWidth / 2 - 8;
          const or_ = radius - strokeWidth / 2 - 2;
          const lr = radius - strokeWidth / 2 - 20;

          return (
            <g key={zone.angle}>
              <line
                x1={cx + ir * Math.cos(za)}
                y1={cy - ir * Math.sin(za)}
                x2={cx + or_ * Math.cos(za)}
                y2={cy - or_ * Math.sin(za)}
                stroke={tickColor}
                strokeWidth={1.5}
              />
              <text
                x={cx + lr * Math.cos(za)}
                y={cy - lr * Math.sin(za)}
                fill={tickColor}
                fontSize="9"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {zone.label}
              </text>
            </g>
          );
        })}

        <text
          x={cx}
          y={cy + 10}
          fill={color}
          fontSize="32"
          fontFamily="var(--font-dm-mono)"
          fontWeight="500"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {currentDelta.toFixed(1)}&deg;
        </text>
      </svg>

      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        degrees off baseline
      </p>

      <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Good
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Warning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Poor
        </span>
      </div>

      <button
        onClick={onCalibrate}
        className="mt-4 w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        Recalibrate Baseline
      </button>
    </div>
  );
}
