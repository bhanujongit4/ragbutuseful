"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

function formatDate(dateString) {
  if (!dateString) return "Unknown date";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleString();
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
  const indent = { paddingLeft: `${level * 14 + 10}px` };

  if (isFolder) {
    return (
      <div className="tree-group">
        <button
          type="button"
          className={`tree-row folder ${node.changed ? "is-changed" : ""}`}
          style={indent}
          onClick={() => {
            const next = new Set(expanded);
            if (next.has(node.path)) next.delete(node.path);
            else next.add(node.path);
            setExpanded(next);
          }}
        >
          <span className="tree-icon">{isOpen ? "v" : ">"}</span>
          <span>{node.path ? node.name : "Repository tree"}</span>
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

  const isSelected = selectedPath === node.path;
  return (
    <button
      type="button"
      className={`tree-row file ${node.changed ? "is-changed" : ""} ${isSelected ? "is-selected" : ""}`}
      style={indent}
      onClick={() => onSelectFile(node.path)}
    >
      <span className="tree-icon">{node.changed ? "*" : "-"}</span>
      <span>{node.name}</span>
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
        headers: { "Content-Type": "application/json" },
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
      <main className="repo-shell">
        <section className="repo-card loading">
          <h1>Analyzing {owner}/{repo}</h1>
          <p>Building tree and generating latest commit summaries...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="repo-shell">
        <section className="repo-card error-card">
          <h1>Could not load repository</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="repo-shell">
      <section className="repo-card">
        <header className="repo-header">
          <div>
            <p className="chip">Public Repo View</p>
            <h1>
              {data.repo.owner}/{data.repo.name}
            </h1>
            <p className="muted">
              Branch: <strong>{data.repo.branch}</strong>
            </p>
            {publicUrl ? (
              <div className="public-url-row">
                <input readOnly value={publicUrl} className="public-url-input" />
                <button
                  type="button"
                  className="ghost-link"
                  onClick={async () => {
                    await navigator.clipboard.writeText(publicUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1300);
                  }}
                >
                  {copied ? "Copied" : "Copy URL"}
                </button>
              </div>
            ) : null}
          </div>
          <a href={data.repo.htmlUrl} target="_blank" rel="noreferrer" className="ghost-link">
            Open on GitHub
          </a>
        </header>

        <section className="commit-strip">
          <div>
            <p className="kicker">Latest commit</p>
            <h2>{data.latestCommit.message || "(no message)"}</h2>
            <p className="muted">
              {data.latestCommit.shortSha} by {data.latestCommit.author} on{" "}
              {formatDate(data.latestCommit.date)}
            </p>
          </div>
          <a href={data.latestCommit.url} target="_blank" rel="noreferrer" className="ghost-link">
            View Commit
          </a>
        </section>

        <section className="stats-row">
          <article>
            <h3>{data.changedFilesCount}</h3>
            <p>Files changed in latest commit</p>
          </article>
          <article>
            <h3>{data.summarizedFilesCount}</h3>
            <p>AI summaries generated</p>
          </article>
          <article>
            <h3>{data.totalChangedLines}</h3>
            <p>Total lines changed in latest commit</p>
          </article>
        </section>

        <section className="repo-grid">
          <aside className="tree-panel">
            <h3>Repository Tree</h3>
            <p className="muted">Changed files are highlighted.</p>
            <div className="tree-scroll">
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

          <article className="summary-panel">
            <h3>File Diff Summary</h3>
            {!data.summaryPolicy?.eligible && data.summaryPolicy?.reason ? (
              <p className="muted">{data.summaryPolicy.reason}</p>
            ) : null}
            {!selectedPath ? (
              <p className="muted">Select a changed file to view AI summary.</p>
            ) : !selectedSummary ? (
              <>
                <p className="file-path">{selectedPath}</p>
                <p className="muted">
                  This file was not part of the latest commit summary set.
                </p>
              </>
            ) : (
              <>
                <p className="file-path">{selectedPath}</p>
                <p className="muted">
                  Status: <strong>{selectedSummary.status}</strong> | +{selectedSummary.additions} / -
                  {selectedSummary.deletions}
                </p>
                <pre className="summary-text">{selectedSummary.summary}</pre>
                <button
                  type="button"
                  className="ghost-link inline"
                  onClick={runCompareWithMasterDoc}
                  disabled={compareLoading}
                >
                  {compareLoading ? "Comparing..." : "Compare with Master Doc"}
                </button>
                {compareError ? <p className="error">{compareError}</p> : null}
                {compareComment ? <pre className="summary-text">{compareComment}</pre> : null}
                {compareSources.length ? (
                  <div className="sources-box">
                    <p className="muted">Guideline sources used:</p>
                    <ul>
                      {compareSources.map((source) => (
                        <li key={`${source.label}-${source.docId}-${source.score}`}>
                          <strong>{source.label}</strong> {source.docTitle || "Master doc"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {selectedSummary.blobUrl ? (
                  <a
                    href={selectedSummary.blobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ghost-link inline"
                  >
                    Open File
                  </a>
                ) : null}
              </>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}

