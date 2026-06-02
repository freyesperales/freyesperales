/**
 * Domain contracts for the profile generator.
 * Kept framework-agnostic so renderers stay pure: (data, theme) => string.
 */

export interface LanguageStat {
  readonly name: string;
  /** Size in bytes aggregated across owned, non-fork repositories. */
  readonly bytes: number;
  /** GitHub-provided language color (hex). Falls back to theme accent. */
  readonly color: string | null;
}

export interface RepoSummary {
  readonly name: string;
  readonly url: string;
  readonly description: string | null;
  readonly primaryLanguage: string | null;
  readonly primaryLanguageColor: string | null;
  readonly stars: number;
  /** ISO-8601 timestamp of the last push. */
  readonly pushedAt: string;
}

/** A single day in the contribution calendar. */
export interface ContributionDay {
  /** ISO date (YYYY-MM-DD) in the calendar's timezone. */
  readonly date: string;
  readonly count: number;
  /** Quantile bucket 0–4 (0 = none, 4 = top quartile). Drives heatmap intensity. */
  readonly level: 0 | 1 | 2 | 3 | 4;
}

/**
 * Derived contribution signals — computed once, server-side, so renderers stay
 * dumb. Streaks are measured in consecutive calendar days with ≥1 contribution.
 */
export interface ContributionStats {
  /** Calendar grid, week-major (each inner array is one column, Sun→Sat). */
  readonly weeks: ReadonlyArray<readonly ContributionDay[]>;
  readonly total: number;
  /** Length of the streak ending today (or yesterday, to forgive timezone lag). */
  readonly currentStreak: number;
  readonly longestStreak: number;
  /** Highest single-day contribution count in the window. */
  readonly bestDay: number;
}

export interface GitHubStats {
  readonly login: string;
  readonly name: string | null;
  readonly totalStars: number;
  readonly totalRepos: number;
  readonly followers: number;
  /** Contributions in the trailing 12 months (from contributionsCollection). */
  readonly contributionsLastYear: number;
  readonly topLanguages: readonly LanguageStat[];
  /** Most recently pushed owned, non-fork repositories. */
  readonly recentRepos: readonly RepoSummary[];
  /** Daily contribution calendar + derived streaks for the trailing year. */
  readonly contributions: ContributionStats;
}

export interface ThemePalette {
  readonly bg: string;
  readonly bgElevated: string;
  readonly border: string;
  readonly textPrimary: string;
  readonly textMuted: string;
  readonly accent: string;
  readonly accentSecondary: string;
}

export interface Theme {
  readonly dark: ThemePalette;
  readonly light: ThemePalette;
  readonly fontStack: string;
  readonly monoStack: string;
  readonly radius: number;
}
