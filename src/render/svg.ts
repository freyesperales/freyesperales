import type { ThemePalette } from "../types.js";

/**
 * Escapes a string for safe interpolation into XML/SVG text or attributes.
 * Critical: all API-derived data (repo names, descriptions) flows through here
 * to prevent markup injection (OWASP A03). Never interpolate raw remote data.
 */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Truncates to a max length, appending an ellipsis. Operates on escaped-safe input. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}\u2026`;
}

/**
 * Builds the <style> block that drives prefers-color-scheme inside the SVG.
 * GitHub strips <style> from Markdown, but honors it inside an embedded SVG,
 * which is how we get real dark/light support without JavaScript.
 *
 * Convention: elements are styled via CSS custom properties so each scheme
 * only needs to redefine the variables, not duplicate every selector.
 */
export function themeStyle(dark: ThemePalette, light: ThemePalette): string {
  const vars = (p: ThemePalette): string => `
    --bg:${p.bg}; --bg-elev:${p.bgElevated}; --border:${p.border};
    --text:${p.textPrimary}; --muted:${p.textMuted};
    --accent:${p.accent}; --accent-2:${p.accentSecondary};`;
  return `
    <style>
      :root { ${vars(light)} }
      @media (prefers-color-scheme: dark) { :root { ${vars(dark)} } }
      .bg { fill: var(--bg); }
      .elev { fill: var(--bg-elev); stroke: var(--border); }
      .text { fill: var(--text); }
      .muted { fill: var(--muted); }
      .accent { fill: var(--accent); }
      .accent-2 { fill: var(--accent-2); }
      .stroke-accent { stroke: var(--accent); }
      .stroke-border { stroke: var(--border); }
    </style>`;
}

/**
 * Heatmap intensity classes. Levels share a single accent fill and differ only
 * by fill-opacity, leaving the `opacity` property free for the reveal animation
 * (the two compose multiplicatively, so a resting opacity of 1 is transparent
 * to fill-opacity). librsvg — GitHub's renderer — supports both independently.
 */
export function heatmapStyle(): string {
  return `
    <style>
      .cell { rx: 2; }
      .l0 { fill: var(--bg-elev); }
      .l1 { fill: var(--accent); fill-opacity: 0.30; }
      .l2 { fill: var(--accent); fill-opacity: 0.52; }
      .l3 { fill: var(--accent); fill-opacity: 0.74; }
      .l4 { fill: var(--accent); fill-opacity: 1; }
    </style>`;
}
