"use client";

import { useState } from "react";

export default function Page() {
  const [pdf, setPdf] = useState(null);
  const [question, setQuestion] = useState("Summarize this PDF in 5 bullets.");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [generationMode, setGenerationMode] = useState("");
  const [reportText, setReportText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        <h1>PDF RAG (Upload + Ask)</h1>
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


