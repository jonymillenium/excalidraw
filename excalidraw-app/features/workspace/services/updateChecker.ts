const DEFAULT_REPOSITORY = "jonymillenium/excalidraw";
const DEFAULT_BRANCH = "feature/workspaces-projects-views-security";
const DESKTOP_RELEASE_TAG_PREFIX = "xcalidraw-desktop-v";

type GitHubCommitResponse = {
  sha?: string;
};

type GitHubCompareResponse = {
  ahead_by?: number;
  behind_by?: number;
  status?: "ahead" | "behind" | "diverged" | "identical";
};

type GitHubReleaseAsset = {
  name?: string;
  browser_download_url?: string;
  size?: number;
};

type GitHubReleaseResponse = {
  tag_name?: string;
  html_url?: string;
  draft?: boolean;
  assets?: GitHubReleaseAsset[];
};

export type ApplicationUpdateStatus =
  | { state: "idle"; version: string }
  | { state: "checking" }
  | { state: "development"; version: string }
  | { state: "current"; version: string; commit: string }
  | {
      state: "pending";
      version: string;
      currentCommit: string;
      latestCommit: string;
      commits: number | null;
      url: string;
    }
  | {
      state: "available";
      version: string;
      latestVersion: string;
      url: string;
      downloadUrl?: string;
      assetName?: string;
      assetSize?: number | null;
    }
  | {
      state: "downloading";
      version: string;
      latestVersion: string;
      progress?: number;
    }
  | { state: "downloaded"; version: string; latestVersion: string }
  | { state: "restarting"; version: string; latestVersion: string }
  | { state: "error"; version: string; message: string };

type UpdateCheckerOptions = {
  currentCommit?: string;
  version?: string;
  repository?: string;
  branch?: string;
  fetcher?: typeof fetch;
};

type ParsedVersion = readonly [number, number, number];

const parseVersion = (version: string): ParsedVersion | null => {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};

const compareVersions = (first: string, second: string): number => {
  const parsedFirst = parseVersion(first);
  const parsedSecond = parseVersion(second);
  if (!parsedFirst || !parsedSecond) {
    return 0;
  }
  for (let index = 0; index < parsedFirst.length; index += 1) {
    if (parsedFirst[index] !== parsedSecond[index]) {
      return parsedFirst[index] - parsedSecond[index];
    }
  }
  return 0;
};

const githubRequest = async <T>(
  url: string,
  fetcher: typeof fetch,
): Promise<T> => {
  const response = await fetcher(url, {
    cache: "no-store",
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

const findNewerDesktopRelease = async ({
  repository,
  version,
  fetcher,
}: {
  repository: string;
  version: string;
  fetcher: typeof fetch;
}): Promise<Extract<
  ApplicationUpdateStatus,
  { state: "available" }
> | null> => {
  const releases = await githubRequest<GitHubReleaseResponse[]>(
    `https://api.github.com/repos/${repository}/releases?per_page=20`,
    fetcher,
  );

  let newestRelease: Extract<
    ApplicationUpdateStatus,
    { state: "available" }
  > | null = null;
  for (const release of releases) {
    if (release.draft || !release.tag_name || !release.html_url) {
      continue;
    }
    if (!release.tag_name.startsWith(DESKTOP_RELEASE_TAG_PREFIX)) {
      continue;
    }
    const latestVersion = release.tag_name.slice(
      DESKTOP_RELEASE_TAG_PREFIX.length,
    );
    if (compareVersions(latestVersion, version) <= 0) {
      continue;
    }
    const assetName = `Xcalidraw-by-Kurk-${latestVersion}-arm64.dmg`;
    const asset = release.assets?.find(
      (candidate) =>
        candidate.name === assetName && candidate.browser_download_url,
    );
    if (!asset?.browser_download_url) {
      continue;
    }
    if (
      newestRelease &&
      compareVersions(latestVersion, newestRelease.latestVersion) <= 0
    ) {
      continue;
    }
    newestRelease = {
      state: "available",
      version,
      latestVersion,
      url: release.html_url,
      downloadUrl: asset.browser_download_url,
      assetName,
      assetSize: typeof asset.size === "number" ? asset.size : null,
    };
  }

  return newestRelease;
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
    const release = await findNewerDesktopRelease({
      repository,
      version,
      fetcher,
    });
    if (release) {
      return release;
    }

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
      // A divergent or pruned commit still means a new installer may be pending.
    }

    return {
      state: "pending",
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
