import type { GitHubStats, Theme } from "../types.js";
import { esc, themeStyle } from "./svg.js";

/**
 * Hero banner. Animated via SMIL only (no <script>, no external CSS) so it
 * survives GitHub's Camo sanitizer. The gradient sweep + node pulses provide
 * motion that reads as "live system" rather than decorative.
 */
export function renderHero(stats: GitHubStats, theme: Theme): string {
  const W = 840;
  const H = 200;
  const displayName = esc(stats.name ?? stats.login);

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  xmlns="http://www.w3.org/2000/svg" role="img"
  aria-label="${displayName} — software engineering profile header">
  ${themeStyle(theme.dark, theme.light)}
  <defs>
    <linearGradient id="sweep" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.0"/>
      <stop offset="50%" stop-color="var(--accent)" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="var(--accent-2)" stop-opacity="0.0"/>
      <animate attributeName="x1" values="-100%;100%" dur="6s"
        repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1"/>
      <animate attributeName="x2" values="0%;200%" dur="6s"
        repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1"/>
    </linearGradient>
    <clipPath id="card"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${theme.radius}"/></clipPath>
  </defs>

  <rect class="bg" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${theme.radius}"/>
  <rect class="stroke-border" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}"
    rx="${theme.radius}" fill="none" stroke-width="1"/>

  <!-- animated gradient sweep, clipped to the card -->
  <g clip-path="url(#card)">
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#sweep)"/>
    <!-- faint grid: communicates "engineering" without noise -->
    ${grid(W, H)}
  </g>

  <!-- name + role -->
  <text x="40" y="84" class="text" font-family="${theme.fontStack}"
    font-size="40" font-weight="700">${displayName}</text>
  ${typewriter(
    "software engineer · automation · web systems",
    42,
    116,
    { fontSize: 15, fontFamily: theme.monoStack, dur: 2.6 },
  )}

  <!-- pulsing status node -->
  <circle cx="46" cy="148" r="5" class="accent">
    <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite"/>
  </circle>
  <text x="60" y="153" class="muted" font-family="${theme.monoStack}"
    font-size="13">activo · ${stats.contributionsLastYear.toLocaleString("es-ES")} contribuciones (12 meses)</text>
</svg>`;
}

interface TypewriterOpts {
  readonly fontSize: number;
  readonly fontFamily: string;
  /** Total time (s) to fully reveal the text. */
  readonly dur: number;
}

/**
 * Terminal-style typing effect: the text is revealed by animating the width of
 * a clip rect (so glyphs appear left-to-right), trailed by a caret that walks
 * to the end and then blinks. Pure SMIL — no JS, Camo-safe.
 *
 * Width is estimated from the monospace advance (~0.6em) plus a small margin so
 * the clip never crops the final glyph; over-reveal is invisible, under-reveal
 * would clip — so we round up deliberately.
 */
function typewriter(text: string, x: number, y: number, opts: TypewriterOpts): string {
  const { fontSize, fontFamily, dur } = opts;
  const width = Math.ceil(text.length * fontSize * 0.6) + 4;
  const top = y - fontSize;
  const clipId = "tw-clip";
  return `
  <defs>
    <clipPath id="${clipId}">
      <rect x="${x}" y="${top}" width="0" height="${(fontSize * 1.5).toFixed(0)}">
        <animate attributeName="width" from="0" to="${width}" dur="${dur}s"
          begin="0.3s" fill="freeze" calcMode="linear"/>
      </rect>
    </clipPath>
  </defs>
  <text x="${x}" y="${y}" clip-path="url(#${clipId})" class="muted"
    font-family="${fontFamily}" font-size="${fontSize}" letter-spacing="1">${esc(text)}</text>
  <rect x="${x}" y="${top + 2}" width="2" height="${fontSize}" class="accent">
    <animate attributeName="x" from="${x}" to="${x + width}" dur="${dur}s"
      begin="0.3s" fill="freeze" calcMode="linear"/>
    <animate attributeName="opacity" values="1;1;0;0;1" dur="1.1s"
      begin="${(dur + 0.3).toFixed(1)}s" repeatCount="indefinite"/>
  </rect>`;
}

/** Decorative dotted grid drawn with a tiling pattern of small circles. */
function grid(w: number, h: number): string {
  const dots: string[] = [];
  const step = 28;
  for (let x = step; x < w; x += step) {
    for (let y = step; y < h; y += step) {
      dots.push(`<circle cx="${x}" cy="${y}" r="1" class="muted" opacity="0.18"/>`);
    }
  }
  return dots.join("");
}
