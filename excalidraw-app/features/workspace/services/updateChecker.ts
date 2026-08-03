const DEFAULT_REPOSITORY = "jonymillenium/excalidraw";
const DEFAULT_BRANCH = "feature/workspaces-projects-views-security";

type GitHubCommitResponse = {
  sha?: string;
};

type GitHubCompareResponse = {
  ahead_by?: number;
  behind_by?: number;
  status?: "ahead" | "behind" | "diverged" | "identical";
};

export type ApplicationUpdateStatus =
  | { state: "idle"; version: string }
  | { state: "checking" }
  | { state: "development"; version: string }
  | { state: "current"; version: string; commit: string }
  | {
      state: "available";
      version: string;
      currentCommit: string;
      latestCommit: string;
      commits: number | null;
      url: string;
    }
  | { state: "error"; version: string; message: string };

type UpdateCheckerOptions = {
  currentCommit?: string;
  version?: string;
  repository?: string;
  branch?: string;
  fetcher?: typeof fetch;
};

const githubRequest = async <T>(
  url: string,
  fetcher: typeof fetch,
): Promise<T> => {
  const response = await fetcher(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub respondió ${response.status}.`);
  }
  return (await response.json()) as T;
};

export const checkForApplicationUpdate = async (
  options: UpdateCheckerOptions = {},
): Promise<ApplicationUpdateStatus> => {
  const version = options.version ?? import.meta.env.VITE_APP_VERSION ?? "dev";
  const currentCommit =
    options.currentCommit ?? import.meta.env.VITE_APP_GIT_SHA ?? "";
  const repository =
    options.repository ??
    import.meta.env.VITE_APP_UPDATE_REPOSITORY ??
    DEFAULT_REPOSITORY;
  const branch =
    options.branch ?? import.meta.env.VITE_APP_UPDATE_BRANCH ?? DEFAULT_BRANCH;
  const fetcher = options.fetcher ?? fetch;

  if (!currentCommit) {
    return { state: "development", version };
  }

  try {
    const latest = await githubRequest<GitHubCommitResponse>(
      `https://api.github.com/repos/${repository}/commits/${encodeURIComponent(
        branch,
      )}`,
      fetcher,
    );
    if (!latest.sha) {
      throw new Error("GitHub no devolvió la revisión publicada.");
    }
    if (latest.sha === currentCommit) {
      return { state: "current", version, commit: currentCommit };
    }

    let commits: number | null = null;
    try {
      const comparison = await githubRequest<GitHubCompareResponse>(
        `https://api.github.com/repos/${repository}/compare/${currentCommit}...${latest.sha}`,
        fetcher,
      );
      commits =
        typeof comparison.ahead_by === "number" ? comparison.ahead_by : null;
      if (commits === 0 && (comparison.behind_by ?? 0) > 0) {
        return { state: "current", version, commit: currentCommit };
      }
    } catch {
      // A divergent or pruned commit still represents a different published build.
    }

    return {
      state: "available",
      version,
      currentCommit,
      latestCommit: latest.sha,
      commits,
      url: `https://github.com/${repository}/compare/${currentCommit}...${latest.sha}`,
    };
  } catch (error) {
    return {
      state: "error",
      version,
      message:
        error instanceof Error ? error.message : "No se pudo consultar GitHub.",
    };
  }
};
