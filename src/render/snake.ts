import type { ContributionDay, ContributionStats, GitHubStats, Theme } from "../types.js";
import { esc, heatmapStyle, themeStyle } from "./svg.js";

const CELL = 11; // cell side, px — matches the activity heatmap for visual rhyme
const GAP = 3;
const STEP = CELL + GAP;
const ROWS = 7; // one row per weekday (Sun→Sat)

// Snake geometry. The body trails the head; each segment is one cell behind in
// time. Tuned so the snake reads as a creature, not a smear, at GitHub's scale.
const BODY = 9; // body segment side, px (slightly inset inside the cell)
const BODY_INSET = (CELL - BODY) / 2;
const TAIL = 5; // number of trailing body segments behind the head
const STEP_DUR = 0.045; // seconds the head spends crossing one cell

/** A position on the path, expressed as a cell's top-left corner in px. */
interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Our own contribution "snake" — a native replacement for the third-party
 * Platane/snk service. A snake walks a serpentine path over the full year grid;
 * as its head reaches each day, that day's contribution cell lights up, so the
 * animation paints the whole year and rests on the complete heatmap.
 *
 * Why build it instead of embedding the external GIF:
 *  - Keeps the README's "sin servicios de terceros" promise honest — no extra
 *    action, no `output` branch, no raw.githubusercontent URL.
 *  - Real dark/light theming via the same CSS-variable system as every asset.
 *  - SMIL-only, so it survives GitHub's Camo image proxy (no JS, no <foreignObject>).
 *  - Reuses the data we already fetch — one pipeline, end to end.
 *
 * The reveal is one-shot with fill="freeze" (same pattern as the activity
 * heatmap): the resting state is the full grid, which is the meaningful picture.
 */
export function renderSnake(stats: GitHubStats, theme: Theme): string {
  const W = 840;
  const pad = 20;
  const gridTop = 58; // room for the title row
  const c = stats.contributions;
  const cols = c.weeks.length;

  const x0 = pad;
  const y0 = gridTop;
  const gridBottom = y0 + ROWS * STEP - GAP;
  const H = gridBottom + 22;

  // Serpentine path over the full cols×7 rectangle: even columns go top→bottom,
  // odd columns bottom→top, so consecutive cells are always orthogonal
  // neighbours — a continuous, snake-like walk that visits every slot.
  const path: Point[] = [];
  const pathCells: Array<{ col: number; row: number }> = [];
  for (let col = 0; col < cols; col++) {
    const downward = col % 2 === 0;
    for (let r = 0; r < ROWS; r++) {
      const row = downward ? r : ROWS - 1 - r;
      path.push({ x: x0 + col * STEP, y: y0 + row * STEP });
      pathCells.push({ col, row });
    }
  }
  const N = path.length;

  // Map (col,row) → the day that falls on that weekday slot, so the head's
  // arrival time can drive each real day's reveal. Partial first/last weeks
  // simply have empty slots the snake glides over.
  const dayAt = new Map<string, ContributionDay>();
  c.weeks.forEach((week, col) => {
    for (const day of week) {
      const row = new Date(`${day.date}T00:00:00Z`).getUTCDay();
      dayAt.set(`${col},${row}`, day);
    }
  });

  const arrival = (i: number): string => (i * STEP_DUR).toFixed(3);

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  xmlns="http://www.w3.org/2000/svg" role="img"
  aria-label="Animación: una serpiente recorre el año encendiendo cada día con contribuciones">
  ${themeStyle(theme.dark, theme.light)}
  ${heatmapStyle()}
  ${snakeStyle()}
  <rect class="bg" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${theme.radius}"/>
  <rect class="stroke-border" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}"
    rx="${theme.radius}" fill="none" stroke-width="1"/>

  <text x="${pad}" y="38" class="text" font-family="${theme.fontStack}"
    font-size="20" font-weight="700">Contribuciones</text>
  <text x="${W - pad}" y="38" class="muted" text-anchor="end"
    font-family="${theme.monoStack}" font-size="12">${c.total.toLocaleString(
    "es-ES",
  )} en el último año</text>

  ${baseGrid(path)}
  ${revealCells(pathCells, path, dayAt, arrival)}
  ${snake(path)}
</svg>`;
}

/** Style block for the snake body/head — accent-coloured, rounded. */
function snakeStyle(): string {
  return `
    <style>
      .snake-seg { fill: var(--accent); rx: 3; }
      .snake-head { fill: var(--accent-2); rx: 3; }
      .snake-eye { fill: var(--bg); }
    </style>`;
}

/** The empty board: an l0 cell at every grid slot, so the rectangle reads clean. */
function baseGrid(path: readonly Point[]): string {
  return path
    .map((p) => `<rect class="cell l0" x="${p.x}" y="${p.y}" width="${CELL}" height="${CELL}"/>`)
    .join("");
}

/**
 * Colour overlay for real, non-empty days. Each starts invisible and reveals
 * (opacity 0→1, frozen) exactly when the snake's head arrives at its slot, so
 * the year paints itself in the snake's wake.
 */
function revealCells(
  pathCells: ReadonlyArray<{ col: number; row: number }>,
  path: readonly Point[],
  dayAt: Map<string, ContributionDay>,
  arrival: (i: number) => string,
): string {
  const parts: string[] = [];
  pathCells.forEach(({ col, row }, i) => {
    const day = dayAt.get(`${col},${row}`);
    if (!day || day.level === 0) return; // empty slots stay as the l0 base
    const p = path[i]!;
    const title = `${day.date}: ${day.count} contribuciones`;
    parts.push(
      `<rect class="cell l${day.level}" x="${p.x}" y="${p.y}" width="${CELL}" height="${CELL}" opacity="0">` +
        `<title>${esc(title)}</title>` +
        `<animate attributeName="opacity" from="0" to="1" dur="0.45s" begin="${arrival(i)}s" fill="freeze"/>` +
        `</rect>`,
    );
  });
  return parts.join("");
}

/**
 * The snake: a head plus TAIL trailing segments. Every part shares one motion
 * keyframe list; segment k simply begins k cell-steps later, so at any instant
 * it sits k cells behind the head. All freeze on the final cell, parking the
 * snake in the corner once the year is fully painted.
 */
function snake(path: readonly Point[]): string {
  const headX = path.map((p) => p.x).join(";");
  const headY = path.map((p) => p.y).join(";");
  const bodyX = path.map((p) => p.x + BODY_INSET).join(";");
  const bodyY = path.map((p) => p.y + BODY_INSET).join(";");
  const N = path.length;
  const dur = ((N - 1) * STEP_DUR).toFixed(3);

  // keyTimes is omitted: with calcMode="linear" the values are distributed
  // evenly across the duration by default, which is exactly cell-by-cell here.
  const move = (attr: "x" | "y", values: string, beginCells: number): string =>
    `<animate attributeName="${attr}" values="${values}"` +
    ` dur="${dur}s" begin="${(beginCells * STEP_DUR).toFixed(3)}s"` +
    ` calcMode="linear" fill="freeze"/>`;

  // Tail first (drawn under the head), fading toward the end of the snake.
  const segments: string[] = [];
  for (let k = TAIL; k >= 1; k--) {
    const opacity = (1 - (k / (TAIL + 1)) * 0.7).toFixed(2);
    segments.push(
      `<rect class="snake-seg" x="${path[0]!.x + BODY_INSET}" y="${
        path[0]!.y + BODY_INSET
      }" width="${BODY}" height="${BODY}" opacity="${opacity}">` +
        move("x", bodyX, k) +
        move("y", bodyY, k) +
        `</rect>`,
    );
  }

  // Head — full-cell, brighter accent, with a single eye for character.
  const head =
    `<rect class="snake-head" x="${path[0]!.x}" y="${path[0]!.y}" width="${CELL}" height="${CELL}">` +
    move("x", headX, 0) +
    move("y", headY, 0) +
    `</rect>`;

  return segments.join("") + head;
}
