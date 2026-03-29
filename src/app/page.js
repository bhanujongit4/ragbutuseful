"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
      const response = await fetch("/api/master-docs", { method: "GET" });
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
        .map((s, i) => `${i + 1}. ${s.text}`)
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

    const shortMatch = value.match(
      /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/,
    );

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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
    const a = document.createElement("a");
    a.href = url;
    a.download = "rag-output.md";
    a.click();
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
    <main className="rag-shell">
      <section className="rag-card">
        <h1>RAG Workspace</h1>
        <p className="muted">Use PDF Q&A or open a public GitHub diff-tree page.</p>

        <form onSubmit={uploadMasterDoc} className="repo-form">
          <p className="chip">Master Docs (Guidelines)</p>
          <label>
            Guideline PDF
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setMasterPdf(e.target.files?.[0] || null)}
            />
          </label>
          <label>
            Title (optional)
            <input
              type="text"
              value={masterTitle}
              onChange={(e) => setMasterTitle(e.target.value)}
              placeholder="Engineering Guidelines v1"
            />
          </label>
          <button type="submit" disabled={masterLoading}>
            {masterLoading ? "Saving..." : "Save to Master Docs"}
          </button>
        </form>

        {masterError ? <p className="error">{masterError}</p> : null}
        <div className="master-list">
          {(masterDocs || []).map((doc) => (
            <article key={doc.id} className="master-item">
              {editingDocId === doc.id ? (
                <>
                  <input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    className="master-title-input"
                  />
                  <div className="actions">
                    <button type="button" onClick={() => saveDocTitle(doc.id)}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDocId("");
                        setEditingTitle("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="master-title">{doc.title}</p>
                  <p className="muted">
                    Chunks: {doc.chunkCount} | Updated:{" "}
                    {new Date(doc.updatedAt || doc.createdAt).toLocaleString()}
                  </p>
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDocId(doc.id);
                        setEditingTitle(doc.title || "");
                      }}
                    >
                      Edit title
                    </button>
                    <button type="button" onClick={() => deleteMasterDocById(doc.id)}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
          {!masterDocs.length ? (
            <p className="muted">
              No master docs yet. Upload at least one guideline PDF to enable repo comparisons.
            </p>
          ) : null}
        </div>

        <form onSubmit={openRepoView} className="repo-form">
          <label>
            Public GitHub repo URL
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
            />
          </label>
          <button type="submit">Open Repo Tree View</button>
        </form>

        <hr className="divider" />

        <h2>PDF RAG (Upload + Ask)</h2>
        <p className="muted">
          Uses Pinecone cloud retrieval + Ollama generation.
        </p>

        <form onSubmit={handleSubmit} className="rag-form">
          <label>
            PDF file
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdf(e.target.files?.[0] || null)}
            />
          </label>

          <label>
            Your question
            <textarea
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about the uploaded PDF..."
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Processing..." : "Run RAG"}
          </button>
        </form>

        {error ? <p className="error">{error}</p> : null}

        {answer ? (
          <div className="result">
            <h2>Answer</h2>
            {generationMode ? <p className="muted">Mode: {generationMode}</p> : null}
            <p>{answer}</p>
            <div className="actions">
              <button type="button" onClick={downloadEditableReport}>
                Download Editable Doc
              </button>
              <button type="button" onClick={downloadPdfReport}>
                Download PDF
              </button>
            </div>
            {sources.length ? (
              <>
                <h3>Retrieved Chunks</h3>
                <ul>
                  {sources.map((source) => (
                    <li key={source.label + source.score}>
                      <strong>{source.label}</strong> {source.text}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}


