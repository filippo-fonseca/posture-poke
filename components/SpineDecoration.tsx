"use client";

import { useMemo } from "react";

interface SpineDecorationProps {
  /** Whether the session is actively running */
  sessionActive?: boolean;
  /** Current posture color hex — null means use default neutral */
  postureColor?: string | null;
}

/**
 * Decorative spine SVGs that sit in the page margins on wide screens.
 * During an active session with bad posture, they tint and jitter.
 */
export function SpineDecoration({
  sessionActive = false,
  postureColor = null,
}: SpineDecorationProps) {
  const isAlert = sessionActive && postureColor && postureColor !== "#22c55e";
  const alertColor = isAlert ? postureColor : null;

  return (
    <>
      <div
        className={`hidden xl:block fixed left-8 2xl:left-16 top-0 h-full w-20 2xl:w-28 pointer-events-none select-none z-0 overflow-hidden transition-transform ${isAlert ? "animate-spine-jitter" : ""}`}
        aria-hidden
      >
        <SpineColumn
          lightColor={alertColor ?? "#3f3f46"}
          darkColor={alertColor ?? "#ffffff"}
          lightOpacity={alertColor ? 4 : 2}
          darkOpacity={alertColor ? 4 : 3}
        />
      </div>
      <div
        className={`hidden xl:block fixed right-8 2xl:right-16 top-0 h-full w-20 2xl:w-28 pointer-events-none select-none z-0 overflow-hidden transition-transform ${isAlert ? "animate-spine-jitter-reverse" : ""}`}
        aria-hidden
      >
        <SpineColumn
          lightColor={alertColor ?? "#3f3f46"}
          darkColor={alertColor ?? "#ffffff"}
          lightOpacity={alertColor ? 4 : 2}
          darkOpacity={alertColor ? 4 : 3}
        />
      </div>
    </>
  );
}

// Vertebra definitions: width, height, corner radius, process length
const VERTEBRAE = [
  { w: 30, h: 16, r: 6, proc: 14 },
  { w: 34, h: 17, r: 6, proc: 15 },
  { w: 38, h: 18, r: 7, proc: 16 },
  { w: 40, h: 19, r: 7, proc: 17 },
  { w: 44, h: 20, r: 8, proc: 18 },
  { w: 46, h: 21, r: 8, proc: 19 },
  { w: 48, h: 22, r: 9, proc: 20 },
  { w: 50, h: 23, r: 9, proc: 20 },
  { w: 52, h: 24, r: 10, proc: 21 },
  { w: 52, h: 25, r: 10, proc: 21 },
  { w: 50, h: 24, r: 9, proc: 20 },
  { w: 46, h: 22, r: 9, proc: 19 },
  { w: 42, h: 20, r: 8, proc: 17 },
  { w: 36, h: 18, r: 7, proc: 15 },
];

const TILE_HEIGHT = (() => {
  let h = 2;
  VERTEBRAE.forEach((v) => { h += v.h + 3 + 4; });
  return Math.ceil(h);
})();

function buildSpineSVG(color: string, opacity: number): string {
  const svgW = 110;
  const cx = svgW / 2;
  const gap = 3;

  let y = 2;
  let parts = "";

  VERTEBRAE.forEach((v) => {
    const midY = y + v.h / 2;

    const discRx = v.w * 0.3;
    parts += `<ellipse cx="${cx}" cy="${y - gap / 2}" rx="${discRx}" ry="2" fill="${color}" opacity="${0.1 * opacity}"/>`;
    parts += `<rect x="${cx - v.w / 2}" y="${y}" width="${v.w}" height="${v.h}" rx="${v.r}" fill="${color}" opacity="${0.05 * opacity}" stroke="${color}" stroke-opacity="${0.09 * opacity}" stroke-width="0.8"/>`;

    const lx = cx - v.w / 2;
    parts += `<path d="M${lx} ${midY - 3}Q${lx - v.proc} ${midY} ${lx} ${midY + 3}" fill="${color}" opacity="${0.04 * opacity}" stroke="${color}" stroke-opacity="${0.07 * opacity}" stroke-width="0.8"/>`;

    const rx = cx + v.w / 2;
    parts += `<path d="M${rx} ${midY - 3}Q${rx + v.proc} ${midY} ${rx} ${midY + 3}" fill="${color}" opacity="${0.04 * opacity}" stroke="${color}" stroke-opacity="${0.07 * opacity}" stroke-width="0.8"/>`;

    y += v.h + gap + 4;
  });

  const totalH = Math.ceil(y);
  return `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}">${parts}</svg>`
  )}")`;
}

function SpineColumn({
  lightColor,
  darkColor,
  lightOpacity,
  darkOpacity,
}: {
  lightColor: string;
  darkColor: string;
  lightOpacity: number;
  darkOpacity: number;
}) {
  const lightBg = useMemo(() => buildSpineSVG(lightColor, lightOpacity), [lightColor, lightOpacity]);
  const darkBg = useMemo(() => buildSpineSVG(darkColor, darkOpacity), [darkColor, darkOpacity]);

  const baseStyle = {
    backgroundRepeat: "repeat-y" as const,
    backgroundPosition: "center top",
    backgroundSize: `110px ${TILE_HEIGHT}px`,
  };

  return (
    <>
      <div
        className="h-full w-full dark:hidden"
        style={{ ...baseStyle, backgroundImage: lightBg }}
      />
      <div
        className="h-full w-full hidden dark:block"
        style={{ ...baseStyle, backgroundImage: darkBg }}
      />
    </>
  );
}
