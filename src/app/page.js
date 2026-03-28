"use client";

import { useState } from "react";

export default function Page() {
  const [pdf, setPdf] = useState(null);
  const [question, setQuestion] = useState("Summarize this PDF in 5 bullets.");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setAnswer("");
    setSources([]);

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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      setAnswer(data.answer);
      setSources(data.sources || []);
    } catch (submitError) {
      setError(submitError.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="rag-shell">
      <section className="rag-card">
        <h1>PDF RAG (Upload + Ask)</h1>
        <p className="muted">
          Uses Ollama Cloud embeddings + LanceDB vector search + Ollama generation.
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
            <p>{answer}</p>
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


