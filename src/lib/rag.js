import * as lancedb from "@lancedb/lancedb";
import path from "path";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { v4 as uuidv4 } from "uuid";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const TOP_K = 4;

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const chunks = [];
  let index = 0;

  while (index < cleaned.length) {
    const end = Math.min(index + size, cleaned.length);
    const chunk = cleaned.slice(index, end).trim();
    if (chunk) chunks.push(chunk);
    if (end === cleaned.length) break;
    index += size - overlap;
  }

  return chunks;
}

function getOllamaConfig() {
  const baseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com/api";
  const apiKey = process.env.OLLAMA_API_KEY?.trim();
  const chatModel = process.env.OLLAMA_CHAT_MODEL || "gpt-oss:20b";
  const embedModel = process.env.OLLAMA_EMBED_MODEL || "embeddinggemma";

  return { baseUrl, apiKey, chatModel, embedModel };
}

function authHeaders(apiKey) {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

async function callOllamaEmbeddings(input) {
  const { baseUrl, apiKey, embedModel } = getOllamaConfig();
  if (!apiKey) {
    throw new Error("Missing OLLAMA_API_KEY in .env.local");
  }
  const response = await fetch(`${baseUrl}/embed`, {
    method: "POST",
    headers: {
      ...authHeaders(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: embedModel,
      input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama embed failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.embeddings)) {
    throw new Error("Ollama embed response missing embeddings array.");
  }

  return data.embeddings;
}

async function callOllamaChat(context, question) {
  const { baseUrl, apiKey, chatModel } = getOllamaConfig();
  if (!apiKey) {
    throw new Error("Missing OLLAMA_API_KEY in .env.local");
  }
  const response = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: {
      ...authHeaders(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: chatModel,
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "You are a RAG assistant. Answer only from the provided context. If context is insufficient, say that clearly.",
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama chat failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data?.message?.content?.trim() || "No answer returned.";
}

export async function answerFromPdf(fileBuffer, question) {
  const parsed = await pdfParse(fileBuffer);
  const chunks = chunkText(parsed.text);

  if (!chunks.length) {
    throw new Error("Could not extract readable text from PDF.");
  }

  const dbPath = path.join(process.cwd(), ".lancedb");
  const db = await lancedb.connect(dbPath);
  let matches = [];
  let retrievalMode = "vector";

  try {
    const chunkEmbeddings = await callOllamaEmbeddings(chunks);
    const queryEmbedding = (await callOllamaEmbeddings([question]))[0];

    if (!queryEmbedding) {
      throw new Error("No query embedding returned.");
    }

    const rows = chunks.map((chunk, i) => ({
      id: uuidv4(),
      chunk,
      source: `chunk-${i + 1}`,
      vector: chunkEmbeddings[i],
    }));

    const table = await db.createTable("pdf_chunks", rows, { mode: "overwrite" });
    matches = await table.vectorSearch(queryEmbedding).limit(TOP_K).toArray();
  } catch (error) {
    const msg = String(error?.message || "");
    if (!msg.includes("unauthorized")) {
      throw error;
    }

    retrievalMode = "fts";
    const rows = chunks.map((chunk, i) => ({
      id: uuidv4(),
      chunk,
      source: `chunk-${i + 1}`,
    }));
    const table = await db.createTable("pdf_chunks", rows, { mode: "overwrite" });
    matches = await table.search(question, "fts", "chunk").limit(TOP_K).toArray();
  }

  const context = matches.map((m, i) => `[${i + 1}] ${m.chunk}`).join("\n\n");

  const answer = await callOllamaChat(context, question);
  return {
    answer,
    retrievalMode,
    sources: matches.map((m, i) => ({
      label: `[${i + 1}]`,
      text: m.chunk,
      score: m._distance ?? null,
    })),
  };
}
