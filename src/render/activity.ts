import type { ContributionStats, GitHubStats, Theme } from "../types.js";
import { esc, heatmapStyle, themeStyle } from "./svg.js";

const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
] as const;

const CELL = 11; // cell side, px
const GAP = 3; // gap between cells, px
const STEP = CELL + GAP;

/**
 * Hand-rolled contribution heatmap — our own take on GitHub's grid, animated
 * with a left-to-right "wave" reveal and topped with derived streak counters.
 *
 * Why build it instead of embedding a third-party image: it stays on-theme
 * (dark/light via CSS variables), needs no external service, and proves the
 * data pipeline end-to-end. SMIL-only so it survives GitHub's Camo proxy.
 */
export function renderActivity(stats: GitHubStats, theme: Theme): string {
  const W = 840;
  const pad = 20;
  const gridTop = 64; // leaves room for the title + month labels
  const c = stats.contributions;
  const cols = c.weeks.length;

  const gridBottom = gridTop + 7 * STEP - GAP;
  const legendY = gridBottom + 26;
  const counterY = legendY + 30;
  const H = counterY + 70;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  xmlns="http://www.w3.org/2000/svg" role="img"
  aria-label="Mapa de calor de contribuciones del último año">
  ${themeStyle(theme.dark, theme.light)}
  ${heatmapStyle()}
  <rect class="bg" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${theme.radius}"/>
  <rect class="stroke-border" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}"
    rx="${theme.radius}" fill="none" stroke-width="1"/>

  <text x="${pad}" y="40" class="text" font-family="${theme.fontStack}"
    font-size="20" font-weight="700">Actividad</text>
  <text x="${W - pad}" y="40" class="muted" text-anchor="end"
    font-family="${theme.monoStack}" font-size="12">${c.total.toLocaleString(
    "es-ES",
  )} contribuciones · 12 meses</text>

  ${monthLabels(c, pad, gridTop - 8, theme)}
  ${heatmap(c, pad, gridTop, cols)}
  ${legend(W, pad, legendY, theme)}

  <line x1="${pad}" y1="${counterY - 18}" x2="${W - pad}" y2="${counterY - 18}"
    class="stroke-border" stroke-width="1"/>
  ${counters(c, W, counterY, theme)}
</svg>`;
}

/** The cell grid: each week is a column whose reveal is delayed by its index. */
function heatmap(
  c: ContributionStats,
  x0: number,
  y0: number,
  cols: number,
): string {
  const columns = c.weeks.map((week, col) => {
    const x = x0 + col * STEP;
    const cells = week
      .map((day) => {
        // Row = weekday (0 = Sunday) so partial first/last weeks line up.
        const row = new Date(`${day.date}T00:00:00Z`).getUTCDay();
        const y = y0 + row * STEP;
        const title = `${day.date}: ${day.count} contribuciones`;
        return `<rect class="cell l${day.level}" x="${x}" y="${y}" width="${CELL}" height="${CELL}"><title>${esc(
          title,
        )}</title></rect>`;
      })
      .join("");
    // Stagger the column fade-in; cap the total sweep so it never drags.
    const begin = ((col / Math.max(1, cols)) * 1.6).toFixed(2);
    return `<g opacity="0">${cells}<animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="${begin}s" fill="freeze"/></g>`;
  });
  return columns.join("");
}

/** Month abbreviations placed at the column where each new month begins. */
function monthLabels(
  c: ContributionStats,
  x0: number,
  y: number,
  theme: Theme,
): string {
  const labels: string[] = [];
  let lastMonth = -1;
  c.weeks.forEach((week, col) => {
    const first = week[0];
    if (!first) return;
    const month = new Date(`${first.date}T00:00:00Z`).getUTCMonth();
    // Label only the first column of a month, and skip the very first column
    // to avoid a cramped label hard against the left edge.
    if (month !== lastMonth && col > 0) {
      const name = MONTHS_ES[month];
      if (name) {
        labels.push(
          `<text x="${x0 + col * STEP}" y="${y}" class="muted" font-family="${theme.monoStack}" font-size="11">${name}</text>`,
        );
      }
    }
    lastMonth = month;
  });
  return labels.join("");
}

/** "menos → más" intensity legend, mirroring GitHub's convention. */
function legend(W: number, pad: number, y: number, theme: Theme): string {
  const swatches = [0, 1, 2, 3, 4]
    .map((lvl, i) => {
      const x = W - pad - 16 - (4 - i) * (CELL + 3);
      return `<rect class="cell l${lvl}" x="${x}" y="${y - CELL + 2}" width="${CELL}" height="${CELL}"/>`;
    })
    .join("");
  return `
    <text x="${W - pad - 16 - 5 * (CELL + 3) - 8}" y="${y}" text-anchor="end"
      class="muted" font-family="${theme.monoStack}" font-size="11">menos</text>
    ${swatches}
    <text x="${W - pad}" y="${y}" text-anchor="end"
      class="muted" font-family="${theme.monoStack}" font-size="11">más</text>`;
}

/** Three derived headline figures: streaks + best single day. */
function counters(
  c: ContributionStats,
  W: number,
  y: number,
  theme: Theme,
): string {
  const cells: ReadonlyArray<readonly [string, string]> = [
    [`${c.currentStreak}`, "racha actual (días)"],
    [`${c.longestStreak}`, "racha más larga (días)"],
    [`${c.bestDay}`, "mejor día (contribs.)"],
  ];
  const colW = W / cells.length;
  return cells
    .map(([value, label], i) => {
      const cx = colW * i + colW / 2;
      return `
      <text x="${cx}" y="${y + 18}" class="accent" text-anchor="middle"
        font-family="${theme.monoStack}" font-size="30" font-weight="700">${esc(value)}</text>
      <text x="${cx}" y="${y + 42}" class="muted" text-anchor="middle"
        font-family="${theme.fontStack}" font-size="13">${esc(label)}</text>`;
    })
    .join("");
}
