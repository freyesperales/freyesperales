import type { GitHubStats, Theme } from "../types.js";
import { esc, themeStyle } from "./svg.js";

/**
 * Stats panel: headline counters + proportional language bars.
 * Bars are sized from real byte counts (not repo counts), so they reflect
 * actual code volume. Fully data-driven; no hardcoded percentages.
 */
export function renderStats(stats: GitHubStats, theme: Theme): string {
  const W = 840;
  const headerH = 110;
  const rowH = 30;
  const langCount = stats.topLanguages.length;
  const H = headerH + langCount * rowH + 28;

  const counters: ReadonlyArray<readonly [string, number]> = [
    ["Repositorios", stats.totalRepos],
    ["Stars", stats.totalStars],
    ["Seguidores", stats.followers],
    ["Contribuciones", stats.contributionsLastYear],
  ];

  const colW = W / counters.length;
  const counterCells = counters
    .map(([label, value], i) => {
      const cx = colW * i + colW / 2;
      return `
      <text x="${cx}" y="50" class="accent" text-anchor="middle"
        font-family="${theme.monoStack}" font-size="30" font-weight="700">${value.toLocaleString(
        "es-ES",
      )}</text>
      <text x="${cx}" y="74" class="muted" text-anchor="middle"
        font-family="${theme.fontStack}" font-size="13">${esc(label)}</text>`;
    })
    .join("");

  const maxBytes = Math.max(1, ...stats.topLanguages.map((l) => l.bytes));
  const barMaxW = W - 220;
  const bars = stats.topLanguages
    .map((lang, i) => {
      const y = headerH + i * rowH;
      const w = Math.max(4, (lang.bytes / maxBytes) * barMaxW);
      const color = lang.color ?? theme.dark.accent;
      return `
      <text x="40" y="${y + 15}" class="text" font-family="${theme.monoStack}"
        font-size="13">${esc(lang.name)}</text>
      <rect x="160" y="${y + 4}" width="${barMaxW}" height="13" rx="6"
        class="elev" stroke-width="1"/>
      <rect x="160" y="${y + 4}" width="0" height="13" rx="6" fill="${esc(color)}">
        <animate attributeName="width" from="0" to="${w.toFixed(1)}"
          dur="0.9s" begin="${(i * 0.12).toFixed(2)}s" fill="freeze"
          calcMode="spline" keySplines="0.2 0.8 0.2 1"/>
      </rect>`;
    })
    .join("");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GitHub statistics">
  ${themeStyle(theme.dark, theme.light)}
  <rect class="bg" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${theme.radius}"/>
  <rect class="stroke-border" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}"
    rx="${theme.radius}" fill="none" stroke-width="1"/>
  ${counterCells}
  <line x1="40" y1="96" x2="${W - 40}" y2="96" class="stroke-border" stroke-width="1"/>
  ${bars}
</svg>`;
}
