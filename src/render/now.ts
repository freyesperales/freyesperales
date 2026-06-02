import type { GitHubStats, RepoSummary, Theme } from "../types.js";
import { esc, truncate, themeStyle } from "./svg.js";

/**
 * "En curso" — recently pushed repositories, fetched automatically.
 * This is the section that fulfills "show what we are doing now": it updates
 * itself on each workflow run with no manual editing.
 */
export function renderNow(stats: GitHubStats, theme: Theme): string {
  const W = 840;
  const cardH = 92;
  const gap = 14;
  const pad = 20;
  const repos = stats.recentRepos;
  const H = pad * 2 + 40 + repos.length * (cardH + gap) - gap;

  const cards = repos
    .map((repo, i) => renderCard(repo, theme, pad, 60 + i * (cardH + gap), W - pad * 2, cardH))
    .join("");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Recently active repositories">
  ${themeStyle(theme.dark, theme.light)}
  <rect class="bg" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${theme.radius}"/>
  <rect class="stroke-border" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}"
    rx="${theme.radius}" fill="none" stroke-width="1"/>
  <text x="${pad}" y="40" class="text" font-family="${theme.fontStack}"
    font-size="20" font-weight="700">En curso</text>
  <text x="${W - pad}" y="40" class="muted" text-anchor="end"
    font-family="${theme.monoStack}" font-size="12">actualizado automáticamente</text>
  ${cards}
</svg>`;
}

function renderCard(
  repo: RepoSummary,
  theme: Theme,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const name = esc(repo.name);
  const desc = esc(truncate(repo.description ?? "Sin descripción", 84));
  const lang = repo.primaryLanguage ? esc(repo.primaryLanguage) : null;
  const langColor = repo.primaryLanguageColor ?? theme.dark.accent;
  const when = relativeTime(repo.pushedAt);

  const meta: string[] = [];
  if (lang) {
    meta.push(
      `<circle cx="${x + 22}" cy="${y + h - 22}" r="5" fill="${esc(langColor)}"/>` +
        `<text x="${x + 34}" y="${y + h - 18}" class="muted" font-family="${theme.monoStack}" font-size="12">${lang}</text>`,
    );
  }

  // No <a> wrapper: GitHub serves embedded SVGs through Camo, where internal
  // anchors are not clickable. Real links live as Markdown text under the image.
  return `
  <g>
    <rect class="elev" x="${x}" y="${y}" width="${w}" height="${h}" rx="8" stroke-width="1"/>
    <text x="${x + 16}" y="${y + 28}" class="accent" font-family="${theme.monoStack}"
      font-size="16" font-weight="700">${name}</text>
    <text x="${x + w - 16}" y="${y + 28}" class="muted" text-anchor="end"
      font-family="${theme.monoStack}" font-size="12">★ ${repo.stars} · ${esc(when)}</text>
    <text x="${x + 16}" y="${y + 52}" class="text" font-family="${theme.fontStack}"
      font-size="13">${desc}</text>
    ${meta.join("")}
  </g>`;
}

/** Human-friendly relative time in Spanish, computed at render time. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} mes${months > 1 ? "es" : ""}`;
  const years = Math.floor(months / 12);
  return `hace ${years} año${years > 1 ? "s" : ""}`;
}
