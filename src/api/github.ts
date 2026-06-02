import type {
  ContributionDay,
  ContributionStats,
  GitHubStats,
  LanguageStat,
  RepoSummary,
} from "../types.js";

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

/**
 * Single query that fetches everything the renderers need.
 * Rationale (vs REST): one round-trip, ~1 rate-limit point, strongly shaped
 * response — avoids the N+1 of fetching languages per repository over REST.
 */
const PROFILE_QUERY = /* GraphQL */ `
  query ($login: String!) {
    user(login: $login) {
      login
      name
      followers { totalCount }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
      repositories(
        first: 100
        ownerAffiliations: OWNER
        isFork: false
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        totalCount
        nodes {
          name
          url
          description
          stargazerCount
          pushedAt
          primaryLanguage { name color }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node { name color }
            }
          }
        }
      }
    }
  }
`;

// ---- Raw response shapes (only the fields we request) --------------------

interface RawLangEdge {
  readonly size: number;
  readonly node: { readonly name: string; readonly color: string | null };
}

interface RawRepo {
  readonly name: string;
  readonly url: string;
  readonly description: string | null;
  readonly stargazerCount: number;
  readonly pushedAt: string;
  readonly primaryLanguage: { readonly name: string; readonly color: string | null } | null;
  readonly languages: { readonly edges: readonly RawLangEdge[] };
}

type RawContributionLevel =
  | "NONE"
  | "FIRST_QUARTILE"
  | "SECOND_QUARTILE"
  | "THIRD_QUARTILE"
  | "FOURTH_QUARTILE";

interface RawContributionDay {
  readonly date: string;
  readonly contributionCount: number;
  readonly contributionLevel: RawContributionLevel;
}

interface RawWeek {
  readonly contributionDays: readonly RawContributionDay[];
}

interface RawUser {
  readonly login: string;
  readonly name: string | null;
  readonly followers: { readonly totalCount: number };
  readonly contributionsCollection: {
    readonly contributionCalendar: {
      readonly totalContributions: number;
      readonly weeks: readonly RawWeek[];
    };
  };
  readonly repositories: {
    readonly totalCount: number;
    readonly nodes: readonly RawRepo[];
  };
}

interface GraphQLResponse {
  readonly data?: { readonly user: RawUser | null };
  readonly errors?: ReadonlyArray<{ readonly message: string }>;
}

// ---- Public API ----------------------------------------------------------

export interface FetchOptions {
  readonly login: string;
  readonly token: string;
  readonly topLanguagesCount?: number;
  readonly recentReposCount?: number;
}

/**
 * Fetches and reshapes profile statistics.
 * Throws on any transport, HTTP, GraphQL, or empty-user error — callers must
 * handle failure explicitly. No silent fallbacks to stale/empty data.
 */
export async function fetchStats(opts: FetchOptions): Promise<GitHubStats> {
  const {
    login,
    token,
    topLanguagesCount = 6,
    recentReposCount = 4,
  } = opts;

  let response: Response;
  try {
    response = await fetch(GITHUB_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": `${login}-profile-generator`,
      },
      body: JSON.stringify({ query: PROFILE_QUERY, variables: { login } }),
    });
  } catch (cause) {
    throw new Error(`Network error reaching GitHub GraphQL API`, { cause });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "<unreadable body>");
    throw new Error(
      `GitHub API HTTP ${response.status} ${response.statusText}: ${detail}`,
    );
  }

  const payload = (await response.json()) as GraphQLResponse;

  if (payload.errors?.length) {
    const messages = payload.errors.map((e) => e.message).join("; ");
    throw new Error(`GraphQL errors: ${messages}`);
  }

  const user = payload.data?.user;
  if (!user) {
    throw new Error(`User "${login}" not found or returned null`);
  }

  return reshape(user, topLanguagesCount, recentReposCount);
}

// ---- Pure transformation (testable without network) ----------------------

export function reshape(
  user: RawUser,
  topLanguagesCount: number,
  recentReposCount: number,
): GitHubStats {
  const repos = user.repositories.nodes;

  const totalStars = repos.reduce((sum, r) => sum + r.stargazerCount, 0);

  // Aggregate language bytes across all owned repos. O(repos * langs) — bounded
  // by the 100/10 query limits, so effectively constant for a personal profile.
  const langBytes = new Map<string, { bytes: number; color: string | null }>();
  for (const repo of repos) {
    for (const edge of repo.languages.edges) {
      const existing = langBytes.get(edge.node.name);
      if (existing) {
        existing.bytes += edge.size;
      } else {
        langBytes.set(edge.node.name, {
          bytes: edge.size,
          color: edge.node.color,
        });
      }
    }
  }

  const topLanguages: LanguageStat[] = [...langBytes.entries()]
    .map(([name, v]) => ({ name, bytes: v.bytes, color: v.color }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, topLanguagesCount);

  const recentRepos: RepoSummary[] = repos
    .slice(0, recentReposCount)
    .map((r) => ({
      name: r.name,
      url: r.url,
      description: r.description,
      primaryLanguage: r.primaryLanguage?.name ?? null,
      primaryLanguageColor: r.primaryLanguage?.color ?? null,
      stars: r.stargazerCount,
      pushedAt: r.pushedAt,
    }));

  const calendar = user.contributionsCollection.contributionCalendar;

  return {
    login: user.login,
    name: user.name,
    totalStars,
    totalRepos: user.repositories.totalCount,
    followers: user.followers.totalCount,
    contributionsLastYear: calendar.totalContributions,
    topLanguages,
    recentRepos,
    contributions: buildContributions(calendar.weeks, calendar.totalContributions),
  };
}

const LEVEL_MAP: Record<RawContributionLevel, ContributionDay["level"]> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

/**
 * Reshapes the raw weekly calendar and derives streaks in a single pass.
 * Streaks are computed over a chronologically-flattened day list so the logic
 * is independent of how the API chunks days into weeks.
 */
export function buildContributions(
  rawWeeks: readonly RawWeek[],
  total: number,
): ContributionStats {
  const weeks: ContributionDay[][] = rawWeeks.map((week) =>
    week.contributionDays.map((d) => ({
      date: d.date,
      count: d.contributionCount,
      level: LEVEL_MAP[d.contributionLevel],
    })),
  );

  const days = weeks.flat();
  const lastIndex = days.length - 1;

  let longestStreak = 0;
  let run = 0;
  let bestDay = 0;
  for (const day of days) {
    bestDay = Math.max(bestDay, day.count);
    run = day.count > 0 ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  }

  // Current streak: walk backwards from the most recent day. Allow the final
  // day to be empty (today may simply not be over yet) without breaking it.
  let currentStreak = 0;
  for (let i = lastIndex; i >= 0; i--) {
    const day = days[i];
    if (!day) break;
    if (day.count > 0) {
      currentStreak++;
    } else if (i === lastIndex) {
      continue; // today with no commits yet — don't end the streak
    } else {
      break;
    }
  }

  return { weeks, total, currentStreak, longestStreak, bestDay };
}
