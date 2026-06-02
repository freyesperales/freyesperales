import type { Theme } from "./types.js";

/**
 * Design tokens. Neutral, technical palette — no commercial branding.
 * Both schemes are calibrated for WCAG AA contrast on their backgrounds.
 *
 * Single source of truth for all visual decisions: changing the look of the
 * entire profile means editing only this file (DX / Open-Closed).
 */
export const theme: Theme = {
  dark: {
    bg: "#0a0e14",
    bgElevated: "#111722",
    border: "#1f2733",
    textPrimary: "#e6edf3",
    textMuted: "#8b98a9",
    accent: "#4fd1c5", // cool teal — reads as "engineering", not marketing
    accentSecondary: "#7c93f0",
  },
  light: {
    bg: "#ffffff",
    bgElevated: "#f6f8fa",
    border: "#d8dee4",
    textPrimary: "#1f2328",
    textMuted: "#59636e",
    accent: "#0d9488",
    accentSecondary: "#4f46e5",
  },
  fontStack:
    "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  monoStack:
    "ui-monospace, 'SF Mono', 'Cascadia Code', 'Roboto Mono', Menlo, Consolas, monospace",
  radius: 10,
};
