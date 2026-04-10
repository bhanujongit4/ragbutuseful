"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  File,
  Flame,
  Folder,
  FolderOpen,
  GitBranch,
  GitCommit,
  Loader2,
  Minus,
  Plus,
  Search,
  Zap,
} from "lucide-react";

const CLIENT_ID_KEY = "ragteams_client_id";

function getClientId() {
  if (typeof window === "undefined") return "anonymous";
  let id = window.localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    window.localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

function formatDate(dateString) {
  if (!dateString) return "Unknown date";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleString();
}

function EmberlineLogo({ className = "h-12 w-12" }) {
  return (
    <svg
      viewBox="0 0 72 72"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="emberline-repo-core" x1="18" y1="16" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F97316" />
          <stop offset="0.55" stopColor="#EA580C" />
          <stop offset="1" stopColor="#DC2626" />
        </linearGradient>
        <linearGradient id="emberline-repo-ring" x1="8" y1="8" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="0.5" stopColor="#F97316" />
          <stop offset="1" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      <rect x="7" y="7" width="58" height="58" rx="18" fill="#FFF7ED" />
      <rect x="7" y="7" width="58" height="58" rx="18" stroke="url(#emberline-repo-ring)" strokeWidth="2" />
      <path d="M23 48 34 18h10L33 48H23Z" fill="url(#emberline-repo-core)" />
      <path d="M40 18h9L38 48h-9L40 18Z" fill="#FDBA74" fillOpacity="0.8" />
      <circle cx="49" cy="49" r="5" fill="#FBBF24" />
    </svg>
  );
}

function Panel({ className = "", children }) {
  return (
    <section
      className={`rounded-[30px] border border-[#efc9b1] bg-[rgba(255,251,247,0.92)] shadow-[0_28px_90px_rgba(183,78,28,0.10)] backdrop-blur ${className}`}
    >
      {children}
    </section>
  );
}

function StatusChip({ children, tone = "warm" }) {
  const tones = {
    warm: "border-[#f1c8ae] bg-[#fff0e4] text-[#a34515]",
    soft: "border-[#f0dec8] bg-[#fff8ef] text-[#8b5b2e]",
    success: "border-[#e7d0a8] bg-[#fff8e2] text-[#8a5a12]",
  };

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function PrimaryButton({ className = "", children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[#c84d1a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ae4012] disabled:cursor-wait disabled:opacity-70 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ className = "", children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-[#e6b89b] bg-white px-4 py-2.5 text-sm font-semibold text-[#6a2a13] transition hover:border-[#cf7d4a] hover:bg-[#fff4ec] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function StatCard({ value, label, accentClass }) {
  return (
    <article className="rounded-[26px] border border-[#f0d4c1] bg-white px-5 py-5 shadow-[0_16px_45px_rgba(171,73,26,0.05)]">
      <p className={`text-3xl font-semibold tracking-[-0.04em] ${accentClass}`}>{value}</p>
      <p className="mt-2 text-sm text-[#805948]">{label}</p>
    </article>
  );
}

function TreeNode({
  node,
  level,
  expanded,
  setExpanded,
  selectedPath,
  onSelectFile,
}) {
  const isFolder = node.type === "folder";
  const isOpen = expanded.has(node.path);
  const isSelected = selectedPath === node.path;

  if (isFolder) {
    return (
      <div>
        <button
          type="button"
          className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm font-medium transition ${
            node.changed ? "text-[#b45309]" : "text-[#6f4b39]"
          } hover:bg-[#fff2e7]`}
          style={{ paddingLeft: `${level * 14 + 12}px` }}
          onClick={() => {
            const next = new Set(expanded);
            if (next.has(node.path)) next.delete(node.path);
            else next.add(node.path);
            setExpanded(next);
          }}
        >
          <span className="flex h-5 w-5 items-center justify-center text-[#ae7b60]">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          {isOpen ? <FolderOpen size={15} /> : <Folder size={15} />}
          <span className="truncate">{node.path ? node.name : "Repository tree"}</span>
        </button>

        {isOpen
          ? node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                level={level + 1}
                expanded={expanded}
                setExpanded={setExpanded}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
              />
            ))
          : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm transition ${
        isSelected
          ? "border border-[#efbf9e] bg-[#fff0e3] text-[#8d360f]"
          : node.changed
            ? "text-[#c65a1d] hover:bg-[#fff4ec]"
            : "text-[#765040] hover:bg-[#fff7f1]"
      }`}
      style={{ paddingLeft: `${level * 14 + 12}px` }}
      onClick={() => onSelectFile(node.path)}
    >
      <span className="flex h-5 w-5 items-center justify-center text-[#af7c60]">
        <File size={14} />
      </span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export default function RepoPage() {
  const params = useParams();
  const owner = decodeURIComponent(String(params?.owner || ""));
  const repo = decodeURIComponent(String(params?.repo || ""));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [expanded, setExpanded] = useState(new Set([""]));
  const [publicUrl, setPublicUrl] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [compareComment, setCompareComment] = useState("");
  const [compareSources, setCompareSources] = useState([]);

  useEffect(() => {
    setPublicUrl(window.location.href);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!owner || !repo) return;
      setLoading(true);
      setError("");
      setData(null);

      try {
        const response = await fetch("/api/repo-tree", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo: `${owner}/${repo}` }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load repository.");
        }
        if (!active) return;
        setData(payload);

        const firstChanged = Object.keys(payload.summaries || {})[0] || "";
        setSelectedPath(firstChanged);
      } catch (loadError) {
        if (active) setError(loadError.message || "Request failed.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [owner, repo]);

  const selectedSummary = useMemo(() => {
    if (!selectedPath || !data?.summaries) return null;
    return data.summaries[selectedPath] || null;
  }, [selectedPath, data]);

  useEffect(() => {
    setCompareError("");
    setCompareComment("");
    setCompareSources([]);
  }, [selectedPath]);

  async function runCompareWithMasterDoc() {
    if (!selectedSummary || !selectedPath) return;
    setCompareLoading(true);
    setCompareError("");
    setCompareComment("");
    setCompareSources([]);
    try {
      const response = await fetch("/api/repo-compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ragteams-client-id": getClientId(),
        },
        body: JSON.stringify({
          filePath: selectedPath,
          diffSummary: selectedSummary.summary,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Comparison failed.");
      }
      setCompareComment(payload.comment || "");
      setCompareSources(payload.sources || []);
    } catch (compareErr) {
      setCompareError(compareErr.message || "Comparison failed.");
    } finally {
      setCompareLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fffaf6] px-4 text-[#34160a]">
        <Panel className="max-w-xl px-6 py-10 text-center sm:px-8">
          <div className="flex justify-center">
            <EmberlineLogo className="h-14 w-14" />
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[#2d140a]">Loading repo intelligence</p>
          <p className="mt-2 flex items-center justify-center gap-2 text-sm text-[#8a624f]">
            <Loader2 size={16} className="animate-spin text-[#d55a1d]" />
            Building the latest commit view for {owner}/{repo}
          </p>
        </Panel>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fffaf6] px-4 text-[#34160a]">
        <div className="max-w-lg rounded-[30px] border border-[#efb7a0] bg-[#fff0eb] px-6 py-10 text-center shadow-[0_28px_90px_rgba(159,47,23,0.10)] sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#b45309]">Repo load failed</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#2d140a]">Could not render this repository</h1>
          <p className="mt-4 text-sm leading-7 text-[#8e3d23]">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fffaf6] text-[#34160a]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-6%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.18)_0%,_rgba(251,191,36,0)_68%)]" />
        <div className="absolute right-[-8%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(249,115,22,0.16)_0%,_rgba(249,115,22,0)_70%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pb-14">
        <Panel className="px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <EmberlineLogo className="h-14 w-14 shrink-0" />
              <div className="min-w-0 max-w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone="warm">
                    <Flame size={14} />
                    Emberline
                  </StatusChip>
                  <StatusChip tone="soft">
                    <Search size={14} />
                    Public repo view
                  </StatusChip>
                </div>
                <h1 className="mt-3 break-words text-3xl font-semibold leading-tight tracking-[-0.04em] text-[#2d140a] sm:text-5xl">
                  {data.repo.owner}/{data.repo.name}
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-[#7b5644] sm:text-base">
                  The repo analysis logic is unchanged. This route now uses the same warm visual language as the home workspace,
                  while keeping tree navigation, diff summaries, and master-doc comparison exactly where they belong.
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <a
                href="/"
                className="inline-flex w-full items-center justify-center rounded-full border border-[#e6b89b] bg-white px-4 py-3 text-sm font-semibold text-[#6a2a13] transition hover:border-[#cf7d4a] hover:bg-[#fff4ec] sm:w-auto"
              >
                Back to workspace
              </a>
              <a
                href={data.repo.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#c84d1a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ae4012] sm:w-auto"
              >
                <ExternalLink size={16} />
                Open on GitHub
              </a>
            </div>
          </div>
        </Panel>

        <Panel className="px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone="warm">
                  <GitCommit size={14} />
                  Latest commit
                </StatusChip>
                <StatusChip tone="soft">
                  <GitBranch size={14} />
                  {data.repo.branch}
                </StatusChip>
              </div>
              <h2 className="mt-4 break-words text-2xl font-semibold leading-tight tracking-[-0.04em] text-[#2d140a] sm:text-[2.4rem]">
                {data.latestCommit.message || "(no message)"}
              </h2>
              <p className="mt-4 break-words text-sm leading-7 text-[#7d5643]">
                {data.latestCommit.shortSha} | {data.latestCommit.author} | {formatDate(data.latestCommit.date)}
              </p>
            </div>

            <div className="grid w-full gap-3 sm:min-w-[320px] xl:w-auto">
              {publicUrl ? (
                <div className="flex flex-col gap-3 rounded-[24px] border border-[#f0d4c1] bg-white px-4 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b45309]">Shareable view<  sigma , this is just for testing /p>
                    <p className="mt-2 break-all text-sm text-[#845946]">{publicUrl}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(publicUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1300);
                    }}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full border border-[#e6b89b] bg-[#fff8f1] text-[#7a2f12] transition hover:border-[#cf7d4a] hover:bg-[#fff0e4] sm:self-auto"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              ) : null}

              <a
                href={data.latestCommit.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#c84d1a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ae4012] sm:w-auto"
              >
                <ExternalLink size={16} />
                View commit
              </a>
            </div>
          </div>
        </Panel>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard value={data.changedFilesCount} label="Files changed in the latest commit" accentClass="text-[#c84d1a]" />
          <StatCard value={data.summarizedFilesCount} label="AI summaries generated" accentClass="text-[#d97706]" />
          <StatCard value={data.totalChangedLines} label="Total changed lines" accentClass="text-[#dc2626]" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="rounded-[30px] border border-[#efc9b1] bg-[rgba(255,251,247,0.92)] shadow-[0_28px_90px_rgba(183,78,28,0.10)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-[#f2d9c9] px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b45309]">Repository tree</p>
                <p className="mt-1 text-sm text-[#845946]">Same tree data, just cleaned up visually.</p>
              </div>
              <StatusChip tone="soft">
                <Flame size={14} />
                Changed paths highlighted
              </StatusChip>
            </div>

            <div className="min-h-[320px] overflow-y-auto px-3 py-3 sm:min-h-[360px] sm:px-4 xl:max-h-[calc(100vh-18rem)]">
              <TreeNode
                node={data.tree}
                level={0}
                expanded={expanded}
                setExpanded={setExpanded}
                selectedPath={selectedPath}
                onSelectFile={setSelectedPath}
              />
            </div>
          </aside>

          <article className="rounded-[30px] border border-[#efc9b1] bg-[rgba(255,251,247,0.92)] shadow-[0_28px_90px_rgba(183,78,28,0.10)] backdrop-blur">
            <div className="border-b border-[#f2d9c9] px-5 py-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b45309]">Diff intelligence</p>
              <p className="mt-1 text-sm text-[#845946]">Same analysis output, much better readability.</p>
            </div>

            <div className="min-h-[320px] overflow-y-auto px-5 py-5 sm:min-h-[360px] sm:px-6 sm:py-6 xl:max-h-[calc(100vh-18rem)]">
              {!data.summaryPolicy?.eligible && data.summaryPolicy?.reason ? (
                <div className="mb-4 rounded-[22px] border border-[#edd0bc] bg-[#fff6ef] px-4 py-3 text-sm text-[#8c604a]">
                  {data.summaryPolicy.reason}
                </div>
              ) : null}

              {!selectedPath ? (
                <div className="rounded-[26px] border border-dashed border-[#e5c7b0] bg-white px-5 py-10 text-center">
                  <p className="text-lg font-semibold tracking-[-0.03em] text-[#32150a]">Select a changed file</p>
                  <p className="mt-2 text-sm leading-6 text-[#8a624f]">Choose a path from the tree to inspect its diff summary and compare it against master docs.</p>
                </div>
              ) : !selectedSummary ? (
                <div className="rounded-[26px] border border-dashed border-[#e5c7b0] bg-white px-5 py-8">
                  <p className="break-all font-mono text-sm text-[#6e4431]">{selectedPath}</p>
                  <p className="mt-3 text-sm leading-6 text-[#8a624f]">This file was not part of the latest commit summary set.</p>
                </div>
              ) : (
                <div className="grid gap-5">
                  <div className="flex flex-col gap-4 rounded-[26px] border border-[#f0d4c1] bg-white p-5 shadow-[0_16px_45px_rgba(171,73,26,0.05)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="break-all font-mono text-sm text-[#b45309]">{selectedPath}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#e9d6c8] bg-[#fff8ef] px-3 py-1 text-[#8b5b2e]">
                            <Plus size={12} />
                            {selectedSummary.additions}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#f0c2bc] bg-[#fff1ef] px-3 py-1 text-[#b43c28]">
                            <Minus size={12} />
                            {selectedSummary.deletions}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#f1c8ae] bg-[#fff0e4] px-3 py-1 text-[#a34515]">
                            {selectedSummary.status}
                          </span>
                        </div>
                      </div>

                      {selectedSummary.blobUrl ? (
                        <a
                          href={selectedSummary.blobUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#e6b89b] bg-[#fff8f1] px-4 py-3 text-sm font-semibold text-[#6a2a13] transition hover:border-[#cf7d4a] hover:bg-[#fff0e4] sm:w-auto"
                        >
                          <ExternalLink size={16} />
                          Open file
                        </a>
                      ) : null}
                    </div>

                    <div className="rounded-[22px] border border-[#f1ddd0] bg-[linear-gradient(180deg,#fffdfa_0%,#fff7f0_100%)] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b45309]">AI summary</p>
                      <pre className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#452114]">{selectedSummary.summary}</pre>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                      <PrimaryButton type="button" onClick={runCompareWithMasterDoc} disabled={compareLoading} className="w-full sm:w-auto">
                        {compareLoading ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                        {compareLoading ? "Comparing..." : "Compare with master doc"}
                      </PrimaryButton>
                      <StatusChip tone="soft">
                        <Zap size={14} />
                        Uses the current repo-compare API flow
                      </StatusChip>
                    </div>
                  </div>

                  {compareError ? (
                    <div className="rounded-[22px] border border-[#efb7a0] bg-[#fff0eb] px-4 py-3 text-sm font-medium text-[#9f2f17]">
                      {compareError}
                    </div>
                  ) : null}

                  {compareComment ? (
                    <div className="rounded-[26px] border border-[#f0d4c1] bg-white p-5 shadow-[0_16px_45px_rgba(171,73,26,0.05)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b45309]">Master doc analysis</p>
                      <pre className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#452114]">{compareComment}</pre>
                    </div>
                  ) : null}

                  {compareSources.length ? (
                    <div className="rounded-[26px] border border-[#f0d4c1] bg-[linear-gradient(180deg,#fff8ef_0%,#fff4eb_100%)] p-5 shadow-[0_16px_45px_rgba(171,73,26,0.05)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b45309]">Guideline sources</p>
                      <div className="mt-4 grid gap-3">
                        {compareSources.map((source) => (
                          <div
                            key={`${source.label}-${source.docId}-${source.score}`}
                            className="rounded-[20px] border border-[#edd0bc] bg-white px-4 py-4"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#5f2813]">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#fff0df] text-[#c6531b]">
                                <BookOpen size={15} />
                              </span>
                              <span>{source.label}</span>
                            </div>
                            <p className="mt-3 text-sm text-[#7f5a47]">{source.docTitle || "Master doc"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
