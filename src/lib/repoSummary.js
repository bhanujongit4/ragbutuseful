const GITHUB_API_BASE = "https://api.github.com";
const MAX_SUMMARY_FILES = 3;
const MAX_COMMIT_DIFF_LINES = 200;
const MAX_PATCH_LENGTH = 6000;

function cleanModelText(text) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) =>
      line
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .replace(/^[-*#>]+\s*/, "")
        .trim(),
    );
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN?.trim();
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "ragteams-repo-inspector",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubRequest(path) {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: githubHeaders(),
    cache: "no-store",
  });

  const raw = await response.text();
  let json = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    const message =
      json?.message ||
      `GitHub request failed (${response.status}) for ${path}`;
    throw new Error(message);
  }

  return json;
}

export function parseGitHubRepoInput(input) {
  const value = String(input || "").trim();
  if (!value) {
    throw new Error("Repository URL is required.");
  }

  const shortMatch = value.match(
    /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/,
  );
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") {
      throw new Error("Only github.com URLs are supported right now.");
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      throw new Error("Provide a full repository URL like github.com/owner/repo.");
    }

    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/, "");
    if (!owner || !repo) {
      throw new Error("Could not parse repository owner/repo from URL.");
    }
    return { owner, repo };
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Use a GitHub repo URL (https://github.com/owner/repo) or owner/repo.",
      );
    }
    throw error;
  }
}

function ensureFolderNode(node, folderName) {
  if (!node.children[folderName]) {
    node.children[folderName] = {
      type: "folder",
      name: folderName,
      path: node.path ? `${node.path}/${folderName}` : folderName,
      children: {},
      changed: false,
    };
  }
  return node.children[folderName];
}

function sortedChildren(childrenMap) {
  const children = Object.values(childrenMap);
  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return children.map((node) =>
    node.type === "folder"
      ? { ...node, children: sortedChildren(node.children) }
      : node,
  );
}

function buildTree(entries, changedPathSet) {
  const root = {
    type: "folder",
    name: "root",
    path: "",
    children: {},
    changed: false,
  };

  entries
    .filter((entry) => entry.type === "blob")
    .forEach((entry) => {
      const parts = entry.path.split("/");
      const fileName = parts.pop();
      if (!fileName) return;

      let current = root;
      parts.forEach((folder) => {
        current = ensureFolderNode(current, folder);
      });

      const fullPath = entry.path;
      current.children[fileName] = {
        type: "file",
        name: fileName,
        path: fullPath,
        changed: changedPathSet.has(fullPath),
      };
    });

  function markChangedFolders(node) {
    if (node.type === "file") return node.changed;
    let changed = false;
    Object.values(node.children).forEach((child) => {
      if (markChangedFolders(child)) changed = true;
    });
    node.changed = changed;
    return changed;
  }

  markChangedFolders(root);
  return { ...root, children: sortedChildren(root.children) };
}

async function callOllamaDiffSummary(diffPatch, filePath, status) {
  const apiKey = process.env.OLLAMA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing OLLAMA_API_KEY for diff summaries.");
  }

  const baseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/api";
  const model = process.env.OLLAMA_CHAT_MODEL || "gpt-oss:20b";

  const response = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "Summarize git diffs for engineers in plain text only. No markdown, no bullets, no asterisks.",
        },
        {
          role: "user",
          content: [
            `File: ${filePath}`,
            `Change type: ${status}`,
            "",
            "Return exactly 3 lines in this exact format:",
            "What changed: ...",
            "Why it matters: ...",
            "Risk/test: ...",
            "",
            "Diff:",
            diffPatch,
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Ollama summary failed: ${response.status} ${raw}`);
  }

  const data = await response.json();
  return cleanModelText(data?.message?.content || "No summary returned.");
}

function fallbackDiffSummary(file) {
  const parts = [];
  parts.push(`What changed: ${file.status}: ${file.filename}`);
  parts.push(
    `Why it matters: ${file.additions || 0} additions, ${file.deletions || 0} deletions (${file.changes || 0} total lines touched).`,
  );
  if (!file.patch) {
    parts.push("Risk/test: Diff patch was unavailable (binary, large file, or rename-only).");
  } else {
    const preview = file.patch
      .split("\n")
      .filter((line) => line.startsWith("+") || line.startsWith("-"))
      .slice(0, 3)
      .map((line) => line.slice(0, 140))
      .join(" ");
    parts.push(
      `Risk/test: ${preview || "Text changes detected; inspect patch details in GitHub for full context."}`,
    );
  }
  return cleanModelText(parts.join("\n"));
}

async function summarizeChangedFile(file) {
  const patch = (file.patch || "").slice(0, MAX_PATCH_LENGTH);
  if (!patch) {
    return fallbackDiffSummary(file);
  }

  try {
    return await callOllamaDiffSummary(patch, file.filename, file.status);
  } catch {
    return fallbackDiffSummary(file);
  }
}

export async function getRepoTreeWithLatestSummaries(owner, repo) {
  const ownerEnc = encodeURIComponent(owner);
  const repoEnc = encodeURIComponent(repo);
  const repoMeta = await githubRequest(`/repos/${ownerEnc}/${repoEnc}`);
  const branch = repoMeta?.default_branch || "main";
  const branchEnc = encodeURIComponent(branch);

  const [treeResult, commits] = await Promise.all([
    githubRequest(`/repos/${ownerEnc}/${repoEnc}/git/trees/${branchEnc}?recursive=1`),
    githubRequest(`/repos/${ownerEnc}/${repoEnc}/commits?sha=${branchEnc}&per_page=1`),
  ]);

  const latestCommit = commits?.[0];
  if (!latestCommit?.sha) {
    throw new Error("No commits found in this repository.");
  }

  const commitDetails = await githubRequest(
    `/repos/${ownerEnc}/${repoEnc}/commits/${encodeURIComponent(latestCommit.sha)}`,
  );
  const changedFiles = commitDetails?.files || [];
  const totalChangedLines =
    Number(commitDetails?.stats?.total) ||
    changedFiles.reduce((sum, file) => sum + (file.changes || 0), 0);
  const changedPathSet = new Set(changedFiles.map((file) => file.filename));
  const tree = buildTree(treeResult?.tree || [], changedPathSet);

  const summaries = {};
  let summaryPolicy = {
    eligible: true,
    reason: "",
    maxFiles: MAX_SUMMARY_FILES,
    maxCommitDiffLines: MAX_COMMIT_DIFF_LINES,
  };
  let limitedFiles = [];

  if (changedFiles.length > MAX_SUMMARY_FILES) {
    summaryPolicy = {
      ...summaryPolicy,
      eligible: false,
      reason: `Skipped summaries: latest commit changed ${changedFiles.length} files (max ${MAX_SUMMARY_FILES}).`,
    };
  } else if (totalChangedLines >= MAX_COMMIT_DIFF_LINES) {
    summaryPolicy = {
      ...summaryPolicy,
      eligible: false,
      reason: `Skipped summaries: latest commit diff is ${totalChangedLines} lines (must be smaller than ${MAX_COMMIT_DIFF_LINES}).`,
    };
  } else {
    limitedFiles = changedFiles.slice(0, MAX_SUMMARY_FILES);
    await Promise.all(
      limitedFiles.map(async (file) => {
        summaries[file.filename] = {
          summary: await summarizeChangedFile(file),
          status: file.status,
          additions: file.additions || 0,
          deletions: file.deletions || 0,
          changes: file.changes || 0,
          blobUrl: file.blob_url || "",
        };
      }),
    );
  }

  return {
    repo: {
      owner,
      name: repo,
      branch,
      htmlUrl: repoMeta?.html_url || `https://github.com/${owner}/${repo}`,
    },
    latestCommit: {
      sha: latestCommit.sha,
      shortSha: latestCommit.sha.slice(0, 7),
      message: latestCommit.commit?.message || "",
      author: latestCommit.commit?.author?.name || "Unknown",
      date: latestCommit.commit?.author?.date || "",
      url:
        latestCommit.html_url ||
        `https://github.com/${owner}/${repo}/commit/${latestCommit.sha}`,
    },
    changedFilesCount: changedFiles.length,
    totalChangedLines,
    summarizedFilesCount: limitedFiles.length,
    summaryPolicy,
    tree,
    summaries,
  };
}
