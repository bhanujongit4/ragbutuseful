import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { v4 as uuidv4 } from "uuid";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const TOP_K = 4;
const PINECONE_API = "https://api.pinecone.io";
const PINECONE_API_VERSION = "2025-10";

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

function pineconeHeaders(apiKey) {
  return {
    "Api-Key": apiKey,
    "X-Pinecone-Api-Version": PINECONE_API_VERSION,
  };
}

function getPineconeConfig() {
  const apiKey = process.env.PINECONE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing PINECONE_API_KEY in .env.local");
  }

  return {
    apiKey,
    indexName: process.env.PINECONE_INDEX_NAME || "ragteams-pdf",
    cloud: process.env.PINECONE_CLOUD || "aws",
    region: process.env.PINECONE_REGION || "us-east-1",
    embedModel: process.env.PINECONE_EMBED_MODEL || "llama-text-embed-v2",
  };
}

async function pineconeRequest(url, options = {}) {
  const response = await fetch(url, options);
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`Pinecone request failed: ${response.status} ${raw}`);
  }

  if (!raw || !raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function getOrCreateIntegratedIndex() {
  const cfg = getPineconeConfig();
  const list = await pineconeRequest(`${PINECONE_API}/indexes`, {
    headers: pineconeHeaders(cfg.apiKey),
  });

  let index = list.indexes?.find((idx) => idx.name === cfg.indexName);
  if (!index) {
    await pineconeRequest(`${PINECONE_API}/indexes/create-for-model`, {
      method: "POST",
      headers: {
        ...pineconeHeaders(cfg.apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: cfg.indexName,
        cloud: cfg.cloud,
        region: cfg.region,
        embed: {
          model: cfg.embedModel,
          field_map: {
            text: "chunk_text",
          },
        },
      }),
    });
  }

  for (let i = 0; i < 30; i += 1) {
    const latest = await pineconeRequest(`${PINECONE_API}/indexes`, {
      headers: pineconeHeaders(cfg.apiKey),
    });
    index = latest.indexes?.find((idx) => idx.name === cfg.indexName);
    if (index?.host && index?.status?.ready) {
      return { apiKey: cfg.apiKey, host: index.host };
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Pinecone index is not ready yet. Try again in a minute.");
}

async function upsertChunksToNamespace(host, apiKey, namespace, chunks) {
  const records = chunks.map((chunk, i) =>
    JSON.stringify({
      _id: uuidv4(),
      chunk_text: chunk,
      source: `chunk-${i + 1}`,
    }),
  );

  await pineconeRequest(
    `https://${host}/records/namespaces/${encodeURIComponent(namespace)}/upsert`,
    {
      method: "POST",
      headers: {
        ...pineconeHeaders(apiKey),
        "Content-Type": "application/x-ndjson",
      },
      body: `${records.join("\n")}\n`,
    },
  );
}

async function searchNamespace(host, apiKey, namespace, question) {
  const result = await pineconeRequest(
    `https://${host}/records/namespaces/${encodeURIComponent(namespace)}/search`,
    {
      method: "POST",
      headers: {
        ...pineconeHeaders(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          inputs: { text: question },
          top_k: TOP_K,
        },
        fields: ["chunk_text", "source"],
      }),
    },
  );

  const hits = result?.result?.hits || [];
  return hits.map((hit, i) => ({
    label: `[${i + 1}]`,
    text: hit?.fields?.chunk_text || "",
    score: hit?._score ?? null,
  }));
}

async function callOllamaChat(context, question) {
  const apiKey = process.env.OLLAMA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing OLLAMA_API_KEY in .env.local");
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
    const text = await response.text();
    throw new Error(`Ollama chat failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data?.message?.content?.trim() || "No answer returned.";
}

function buildExtractiveFallback(question, sources) {
  const lines = sources
    .slice(0, TOP_K)
    .map((s, i) => `${i + 1}. ${s.text}`)
    .join("\n\n");
  return [
    "Could not use the generation model right now (provider auth/rate issue).",
    `Question: ${question}`,
    "Top retrieved passages from Pinecone:",
    lines || "No retrieved passages.",
  ].join("\n\n");
}

export async function answerFromPdf(fileBuffer, question) {
  const parsed = await pdfParse(fileBuffer);
  const chunks = chunkText(parsed.text);
  if (!chunks.length) {
    throw new Error("Could not extract readable text from PDF.");
  }

  const namespace = `pdf-${Date.now()}`;
  const { apiKey, host } = await getOrCreateIntegratedIndex();
  await upsertChunksToNamespace(host, apiKey, namespace, chunks);
  const sources = await searchNamespace(host, apiKey, namespace, question);

  const context = sources.map((s) => `${s.label} ${s.text}`).join("\n\n");
  let answer = "";
  let generationMode = "ollama";
  try {
    answer = await callOllamaChat(context, question);
  } catch (error) {
    const msg = String(error?.message || "");
    if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
      generationMode = "extractive-fallback";
      answer = buildExtractiveFallback(question, sources);
    } else {
      throw error;
    }
  }

  return { answer, sources, namespace, generationMode };
}
