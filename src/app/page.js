"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  Download,
  Edit3,
  ExternalLink,
  File,
  Flame,
  GitBranch,
  Loader2,
  Search,
  Shield,
  Trash2,
  Upload,
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

function formatTimestamp(dateString) {
  if (!dateString) return "No timestamp yet";
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
        <linearGradient id="emberline-core" x1="18" y1="16" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F97316" />
          <stop offset="0.55" stopColor="#EA580C" />
          <stop offset="1" stopColor="#DC2626" />
        </linearGradient>
        <linearGradient id="emberline-ring" x1="8" y1="8" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="0.5" stopColor="#F97316" />
          <stop offset="1" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      <rect x="7" y="7" width="58" height="58" rx="18" fill="#FFF7ED" />
      <rect x="7" y="7" width="58" height="58" rx="18" stroke="url(#emberline-ring)" strokeWidth="2" />
      <path d="M23 48 34 18h10L33 48H23Z" fill="url(#emberline-core)" />
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

function Field({ label, hint, children }) {
  return (
    <label className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[#51210f]">{label}</span>
        {hint ? <span className="text-xs text-[#966a56]">{hint}</span> : null}
      </div>
      {children}
    </label>
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

function SurfaceHeading({ eyebrow, title, copy, icon: Icon }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#b45309]">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#34160a] sm:text-[2rem]">
          {title}
        </h2>
        {copy ? <p className="mt-3 text-sm leading-6 text-[#7d5643] sm:text-[15px]">{copy}</p> : null}
      </div>
      {Icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#f3cfba] bg-white text-[#d55a1d] shadow-sm">
          <Icon size={22} />
        </div>
      ) : null}
    </div>
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

export default function Page() {
  const router = useRouter();
  const [pdf, setPdf] = useState(null);
  const [question, setQuestion] = useState("Summarize this PDF in 5 bullets.");
  const [repoUrl, setRepoUrl] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [generationMode, setGenerationMode] = useState("");
  const [reportText, setReportText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [masterPdf, setMasterPdf] = useState(null);
  const [masterTitle, setMasterTitle] = useState("");
  const [masterDocs, setMasterDocs] = useState([]);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterError, setMasterError] = useState("");
  const [editingDocId, setEditingDocId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");

  async function loadMasterDocs() {
    setMasterError("");
    try {
      const response = await fetch("/api/master-docs", {
        method: "GET",
        headers: { "x-ragteams-client-id": getClientId() },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load docs.");
      setMasterDocs(payload.docs || []);
    } catch (e) {
      setMasterError(e.message || "Failed to load master docs.");
    }
  }

  useEffect(() => {
    loadMasterDocs();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setAnswer("");
    setSources([]);
    setGenerationMode("");
    setReportText("");

    if (!pdf) {
      setError("Please upload a PDF first.");
      return;
    }

    if (!question.trim()) {
      setError("Please enter a question.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("pdf", pdf);
      formData.append("question", question);

      const response = await fetch("/api/rag", {
        method: "POST",
        body: formData,
      });

      const raw = await response.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(`Server returned non-JSON response (${response.status}).`);
      }

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      setAnswer(data.answer);
      setSources(data.sources || []);
      setGenerationMode(data.generationMode || "");
      const sourceText = (data.sources || [])
        .map((source, index) => `${index + 1}. ${source.text}`)
        .join("\n\n");
      const report = `# RAG Output\n\nQuestion:\n${question}\n\nAnswer:\n${data.answer}\n\nRetrieved Context:\n${sourceText}\n`;
      setReportText(report);
    } catch (submitError) {
      setError(submitError.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function openRepoView(event) {
    event.preventDefault();
    setError("");

    const value = repoUrl.trim();
    if (!value) {
      setError("Please enter a GitHub repository URL.");
      return;
    }

    const shortMatch = value.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);

    if (shortMatch) {
      router.push(`/repo/${encodeURIComponent(shortMatch[1])}/${encodeURIComponent(shortMatch[2])}`);
      return;
    }

    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();
      if (host !== "github.com" && host !== "www.github.com") {
        throw new Error("Only github.com URLs are supported.");
      }
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length < 2) {
        throw new Error("Please use URL like https://github.com/owner/repo");
      }
      const owner = segments[0];
      const repo = segments[1].replace(/\.git$/, "");
      router.push(`/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    } catch {
      setError("Use a valid GitHub URL or owner/repo format.");
    }
  }

  async function uploadMasterDoc(event) {
    event.preventDefault();
    setMasterError("");
    if (!masterPdf) {
      setMasterError("Select a PDF for master docs.");
      return;
    }
    setMasterLoading(true);
    try {
      const formData = new FormData();
      formData.append("pdf", masterPdf);
      formData.append("title", masterTitle);
      const response = await fetch("/api/master-docs", {
        method: "POST",
        headers: { "x-ragteams-client-id": getClientId() },
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Upload failed.");
      setMasterPdf(null);
      setMasterTitle("");
      await loadMasterDocs();
    } catch (e) {
      setMasterError(e.message || "Upload failed.");
    } finally {
      setMasterLoading(false);
    }
  }

  async function deleteMasterDocById(docId) {
    setMasterError("");
    setMasterLoading(true);
    try {
      const response = await fetch("/api/master-docs", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-ragteams-client-id": getClientId(),
        },
        body: JSON.stringify({ docId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Delete failed.");
      await loadMasterDocs();
    } catch (e) {
      setMasterError(e.message || "Delete failed.");
    } finally {
      setMasterLoading(false);
    }
  }

  async function saveDocTitle(docId) {
    setMasterError("");
    if (!editingTitle.trim()) {
      setMasterError("Title cannot be empty.");
      return;
    }
    setMasterLoading(true);
    try {
      const response = await fetch("/api/master-docs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-ragteams-client-id": getClientId(),
        },
        body: JSON.stringify({ docId, title: editingTitle.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Rename failed.");
      setEditingDocId("");
      setEditingTitle("");
      await loadMasterDocs();
    } catch (e) {
      setMasterError(e.message || "Rename failed.");
    } finally {
      setMasterLoading(false);
    }
  }

  function downloadEditableReport() {
    if (!reportText) return;
    const blob = new Blob([reportText], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rag-output.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdfReport() {
    if (!reportText) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const width = doc.internal.pageSize.getWidth() - margin * 2;
    const lines = doc.splitTextToSize(reportText, width);

    let y = margin;
    lines.forEach((line) => {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 16;
    });

    doc.save("rag-output.pdf");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fffaf6] text-[#34160a]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-6%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.22)_0%,_rgba(251,191,36,0)_68%)]" />
        <div className="absolute right-[-8%] top-[8%] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,_rgba(249,115,22,0.18)_0%,_rgba(249,115,22,0)_70%)]" />
        <div className="absolute bottom-[-18%] left-[22%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(220,38,38,0.10)_0%,_rgba(220,38,38,0)_74%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1460px] flex-col gap-6 px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pb-14">
        <Panel className="px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <EmberlineLogo className="h-14 w-14 shrink-0" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone="warm">Emberline</StatusChip>
                  <StatusChip tone="soft">Single workspace for repo and document intelligence</StatusChip>
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#2d140a] sm:text-5xl">
                  A cleaner front-end for your retrieval and repo review workflow.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-[#7b5644] sm:text-base">
                  This redesign keeps the upload, retrieval, repo routing, report downloads, and master-doc logic intact,
                  but turns the experience into a warm, minimal control surface that actually looks intentional.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:min-w-[310px] sm:grid-cols-2 lg:w-[360px]">
              <div className="rounded-[26px] border border-[#f2d2bc] bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ba5b23]">Library status</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-3xl font-semibold tracking-[-0.04em] text-[#2d140a]">{masterDocs.length}</span>
                  <span className="pb-1 text-sm text-[#8a614c]">guideline PDFs indexed</span>
                </div>
              </div>
              <div className="rounded-[26px] border border-[#f2d2bc] bg-[linear-gradient(180deg,#fff8ef_0%,#fff2e8_100%)] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ba5b23]">Output state</p>
                <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#5b240f]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ffe3ce] text-[#d15f1e]">
                    {answer ? <Check size={16} /> : <Zap size={16} />}
                  </span>
                  {answer ? "Report ready for export" : "Workspace standing by"}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {error ? (
          <div className="rounded-[24px] border border-[#efb7a0] bg-[#fff0eb] px-5 py-4 text-sm font-medium text-[#9f2f17] shadow-[0_20px_50px_rgba(159,47,23,0.08)]">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <Panel className="px-5 py-5 sm:px-7 sm:py-6">
            <SurfaceHeading
              eyebrow="Guideline vault"
              title="Master documents"
              copy="Upload and maintain the PDFs the repo comparison flow uses as its review baseline."
              icon={BookOpen}
            />

            <form onSubmit={uploadMasterDoc} className="mt-8 grid gap-5">
              <Field label="Guideline PDF" hint={masterPdf ? masterPdf.name : "PDF only"}>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setMasterPdf(event.target.files?.[0] || null)}
                  className="w-full rounded-[22px] border border-[#eccbb3] bg-white px-4 py-3 text-sm text-[#4d2211] file:mr-4 file:rounded-full file:border-0 file:bg-[#ffe7d1] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#9d4314] focus:border-[#d87439] focus:outline-none"
                />
              </Field>

              <Field label="Document title" hint="Optional but useful">
                <input
                  type="text"
                  value={masterTitle}
                  onChange={(event) => setMasterTitle(event.target.value)}
                  placeholder="Frontend Review Rules v1"
                  className="w-full rounded-[22px] border border-[#eccbb3] bg-white px-4 py-3 text-sm text-[#4d2211] outline-none transition placeholder:text-[#b08773] focus:border-[#d87439]"
                />
              </Field>

              <div className="flex flex-wrap items-center gap-3">
                <PrimaryButton type="submit" disabled={masterLoading}>
                  {masterLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {masterLoading ? "Saving document..." : "Save to master docs"}
                </PrimaryButton>
                <StatusChip tone={masterDocs.length ? "success" : "soft"}>
                  <Shield size={14} />
                  {masterDocs.length ? "Repo compare is armed with source material" : "Add at least one PDF to guide comparisons"}
                </StatusChip>
              </div>
            </form>

            {masterError ? (
              <div className="mt-5 rounded-[22px] border border-[#efb7a0] bg-[#fff0eb] px-4 py-3 text-sm font-medium text-[#9f2f17]">
                {masterError}
              </div>
            ) : null}

            <div className="mt-8 grid gap-4">
              {(masterDocs || []).map((doc) => (
                <article
                  key={doc.id}
                  className="rounded-[24px] border border-[#f0d4c1] bg-[linear-gradient(180deg,#ffffff_0%,#fff8f1_100%)] p-4 shadow-[0_16px_45px_rgba(171,73,26,0.05)]"
                >
                  {editingDocId === doc.id ? (
                    <div className="grid gap-3">
                      <input
                        value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        className="w-full rounded-[18px] border border-[#e7c6ad] bg-white px-4 py-3 text-sm text-[#4d2211] outline-none transition focus:border-[#d87439]"
                      />
                      <div className="flex flex-wrap gap-3">
                        <PrimaryButton type="button" onClick={() => saveDocTitle(doc.id)}>
                          <Check size={16} />
                          Save title
                        </PrimaryButton>
                        <SecondaryButton
                          type="button"
                          onClick={() => {
                            setEditingDocId("");
                            setEditingTitle("");
                          }}
                        >
                          Cancel
                        </SecondaryButton>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-lg font-semibold tracking-[-0.03em] text-[#2e1409]">{doc.title}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#845946]">
                            <StatusChip tone="soft">
                              <File size={14} />
                              {doc.chunkCount} chunks
                            </StatusChip>
                            <StatusChip tone="soft">
                              <Edit3 size={14} />
                              Updated {formatTimestamp(doc.updatedAt || doc.createdAt)}
                            </StatusChip>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <SecondaryButton
                            type="button"
                            onClick={() => {
                              setEditingDocId(doc.id);
                              setEditingTitle(doc.title || "");
                            }}
                          >
                            <Edit3 size={15} />
                            Rename
                          </SecondaryButton>
                          <SecondaryButton type="button" onClick={() => deleteMasterDocById(doc.id)}>
                            <Trash2 size={15} />
                            Delete
                          </SecondaryButton>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              ))}

              {!masterDocs.length ? (
                <div className="rounded-[24px] border border-dashed border-[#e5c7b0] bg-[#fff9f4] px-5 py-8 text-center">
                  <p className="text-base font-semibold text-[#582512]">No guidance library yet</p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8a624f]">
                    Upload a review PDF and this workspace will use it later when comparing repo diffs against your standards.
                  </p>
                </div>
              ) : null}
            </div>
          </Panel>

          <div className="grid gap-6">
            <Panel className="px-5 py-5 sm:px-7 sm:py-6">
              <SurfaceHeading
                eyebrow="Repo intelligence"
                title="Open a GitHub tree view"
                copy="Keep the existing repo logic and jump into the diff summary experience from a public repo URL or owner/repo pair."
                icon={GitBranch}
              />

              <form onSubmit={openRepoView} className="mt-8 grid gap-5">
                <Field label="Public repository" hint="github.com or owner/repo">
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(event) => setRepoUrl(event.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="w-full rounded-[22px] border border-[#eccbb3] bg-white px-4 py-3 text-sm text-[#4d2211] outline-none transition placeholder:text-[#b08773] focus:border-[#d87439]"
                  />
                </Field>

                <div className="flex flex-wrap items-center gap-3">
                  <PrimaryButton type="submit">
                    <ExternalLink size={16} />
                    Open repo tree view
                  </PrimaryButton>
                  <StatusChip tone="soft">
                    <Search size={14} />
                    Latest commit summaries stay untouched
                  </StatusChip>
                </div>
              </form>
            </Panel>

            <Panel className="px-5 py-5 sm:px-7 sm:py-6">
              <SurfaceHeading
                eyebrow="Document Q and A"
                title="PDF RAG studio"
                copy="Upload a document, ask a focused question, and export the response in markdown or PDF without changing your current generation pipeline."
                icon={Zap}
              />

              <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
                <Field label="Target PDF" hint={pdf ? pdf.name : "Upload before running"}>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => setPdf(event.target.files?.[0] || null)}
                    className="w-full rounded-[22px] border border-[#eccbb3] bg-white px-4 py-3 text-sm text-[#4d2211] file:mr-4 file:rounded-full file:border-0 file:bg-[#ffe7d1] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#9d4314] focus:border-[#d87439] focus:outline-none"
                  />
                </Field>

                <Field label="Question" hint="Kept from current logic">
                  <textarea
                    rows={6}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask anything about the uploaded PDF..."
                    className="w-full rounded-[22px] border border-[#eccbb3] bg-white px-4 py-3 text-sm leading-6 text-[#4d2211] outline-none transition placeholder:text-[#b08773] focus:border-[#d87439]"
                  />
                </Field>

                <div className="flex flex-wrap items-center gap-3">
                  <PrimaryButton type="submit" disabled={loading}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    {loading ? "Processing PDF..." : "Run RAG"}
                  </PrimaryButton>
                  <StatusChip tone="warm">
                    <Flame size={14} />
                    Uses your current API flow exactly as before
                  </StatusChip>
                </div>
              </form>
            </Panel>
          </div>
        </section>

        <Panel className="px-5 py-5 sm:px-7 sm:py-6">
          <SurfaceHeading
            eyebrow="Response deck"
            title={answer ? "Generated answer and traceable context" : "Result area"}
            copy={
              answer
                ? "The answer, generation mode, export controls, and retrieved chunks remain wired to the same state and report-generation logic."
                : "Once you run RAG, the answer, mode, downloads, and retrieved chunks will appear here in a cleaner readout."
            }
            icon={answer ? Check : BookOpen}
          />

          {answer ? (
            <div className="mt-8 grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
              <div className="rounded-[28px] border border-[#f0d4c1] bg-white p-5 shadow-[0_16px_45px_rgba(171,73,26,0.05)] sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone="success">
                      <Check size={14} />
                      Answer ready
                    </StatusChip>
                    {generationMode ? <StatusChip tone="soft">{generationMode}</StatusChip> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton type="button" onClick={downloadEditableReport}>
                      <Download size={15} />
                      Markdown
                    </SecondaryButton>
                    <PrimaryButton type="button" onClick={downloadPdfReport}>
                      <Download size={15} />
                      PDF
                    </PrimaryButton>
                  </div>
                </div>

                <div className="mt-6 rounded-[24px] border border-[#f3dccd] bg-[linear-gradient(180deg,#fffdfa_0%,#fff7f0_100%)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b45309]">Answer</p>
                  <div className="mt-4 whitespace-pre-wrap text-[15px] leading-8 text-[#432013]">{answer}</div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#f0d4c1] bg-[linear-gradient(180deg,#fff8ef_0%,#fff4eb_100%)] p-5 shadow-[0_16px_45px_rgba(171,73,26,0.05)] sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b45309]">Retrieved chunks</p>
                    <p className="mt-2 text-sm text-[#7d5643]">{sources.length} supporting excerpts returned</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#f2ceb7] bg-white text-[#d55a1d]">
                    <BookOpen size={20} />
                  </div>
                </div>

                {sources.length ? (
                  <div className="mt-5 grid max-h-[34rem] gap-3 overflow-y-auto pr-1">
                    {sources.map((source) => (
                      <article
                        key={source.label + source.score}
                        className="rounded-[22px] border border-[#edd0bc] bg-white px-4 py-4"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#5f2813]">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#fff0df] text-[#c6531b]">
                            <File size={15} />
                          </span>
                          {source.label}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#7f5a47]">{source.text}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[22px] border border-dashed border-[#e5c7b0] bg-white/80 px-4 py-6 text-sm text-[#8a624f]">
                    No retrieval chunks were returned for this run.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              <div className="rounded-[26px] border border-[#f0d4c1] bg-white px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b45309]">01</p>
                <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[#30150a]">Upload and ask</p>
                <p className="mt-2 text-sm leading-6 text-[#845b48]">Your PDF and prompt stay tied to the current submit handler and retrieval endpoint.</p>
              </div>
              <div className="rounded-[26px] border border-[#f0d4c1] bg-white px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b45309]">02</p>
                <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[#30150a]">Generate and review</p>
                <p className="mt-2 text-sm leading-6 text-[#845b48]">The answer, mode, and retrieved chunks show up in a readable split view instead of one giant bland block.</p>
              </div>
              <div className="rounded-[26px] border border-[#f0d4c1] bg-white px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b45309]">03</p>
                <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[#30150a]">Export immediately</p>
                <p className="mt-2 text-sm leading-6 text-[#845b48]">Markdown and PDF downloads remain available from the exact same report text generation pipeline.</p>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}
