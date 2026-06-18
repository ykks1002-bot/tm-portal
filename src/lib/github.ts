export interface GithubConfig {
  owner: string;
  repo: string;
  branch: string;
  pat: string;
}

const KEY = "tm_github_config";

export function getGithubConfig(): GithubConfig | null {
  if (typeof window === "undefined") return null;
  const s = localStorage.getItem(KEY);
  if (!s) return null;
  try { return JSON.parse(s) as GithubConfig; }
  catch { return null; }
}

export function setGithubConfig(cfg: GithubConfig | null) {
  if (typeof window === "undefined") return;
  if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg));
  else localStorage.removeItem(KEY);
}

export function autoDetectGithubRepo(): Pick<GithubConfig, "owner" | "repo"> {
  if (typeof window === "undefined") return { owner: "", repo: "" };
  const host = window.location.hostname;
  const path = window.location.pathname;
  const ownerMatch = host.match(/^(.+)\.github\.io$/);
  const repoMatch = path.match(/^\/([^/]+)/);
  return {
    owner: ownerMatch ? ownerMatch[1] : "",
    repo: repoMatch ? repoMatch[1] : "",
  };
}

async function ghFetch(cfg: GithubConfig, path: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${cfg.pat}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...((options.headers ?? {}) as Record<string, string>),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json();
}

// Commit a single file via GitHub Contents API
export async function githubCommitFile(
  cfg: GithubConfig,
  filePath: string,
  content: string,
  message: string,
): Promise<void> {
  let sha: string | undefined;
  try {
    const cur = await ghFetch(cfg, `/contents/${filePath}?ref=${cfg.branch}`);
    sha = (cur as { sha: string }).sha;
  } catch { /* new file — no SHA needed */ }

  await ghFetch(cfg, `/contents/${filePath}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: cfg.branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

// Commit multiple files in one commit using Git Trees API
export async function githubCommitFiles(
  cfg: GithubConfig,
  files: { path: string; content: string }[],
  message: string,
): Promise<void> {
  if (files.length === 0) return;
  if (files.length === 1) {
    return githubCommitFile(cfg, files[0].path, files[0].content, message);
  }

  const refData = await ghFetch(cfg, `/git/refs/heads/${cfg.branch}`) as { object: { sha: string } };
  const headSha = refData.object.sha;

  const commitData = await ghFetch(cfg, `/git/commits/${headSha}`) as { tree: { sha: string } };
  const baseTreeSha = commitData.tree.sha;

  const newTree = await ghFetch(cfg, "/git/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: files.map(f => ({ path: f.path, mode: "100644", type: "blob", content: f.content })),
    }),
  }) as { sha: string };

  const newCommit = await ghFetch(cfg, "/git/commits", {
    method: "POST",
    body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
  }) as { sha: string };

  await ghFetch(cfg, `/git/refs/heads/${cfg.branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommit.sha }),
  });
}
