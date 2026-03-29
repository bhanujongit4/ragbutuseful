import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { v4 as uuidv4 } from "uuid";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

const PINECONE_API = "https://api.pinecone.io";
const PINECONE_API_VERSION = "2025-10";
const MASTER_NAMESPACE_PREFIX = "master-docs";
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const TOP_K = 6;
const MAX_COMPARE_HITS = 4;
const MAX_HIT_CHARS = 600;
const MASTER_DOC_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function getStorePaths() {
  const configuredDir = process.env.MASTER_DOCS_STORE_DIR?.trim();
  const baseDir = configuredDir
    ? configuredDir
    : process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
      ? path.join(tmpdir(), "ragteams")
      : path.join(process.cwd(), "data");

  return {
    dir: baseDir,
    file: path.join(baseDir, "master-docs.json"),
  };
}

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
          field_map: { text: "chunk_text" },
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

async function ensureStore() {
  const { dir, file } = getStorePaths();
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify({ docs: [] }, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStore();
  const { file } = getStorePaths();
  const raw = await fs.readFile(file, "utf8");
  const data = raw ? JSON.parse(raw) : { docsByOwner: {} };
  if (data && typeof data === "object" && data.docsByOwner && typeof data.docsByOwner === "object") {
    return data;
  }
  if (Array.isArray(data?.docs)) {
    return { docsByOwner: { anonymous: data.docs } };
  }
  return { docsByOwner: {} };
}

async function writeStore(store) {
  await ensureStore();
  const { file } = getStorePaths();
  await fs.writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

function normalizeOwnerKey(ownerKey) {
  return String(ownerKey || "").trim() || "anonymous";
}

function namespaceForOwner(ownerKey) {
  const normalized = normalizeOwnerKey(ownerKey);
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 24);
  return `${MASTER_NAMESPACE_PREFIX}-${hash}`;
}

function docsForOwner(store, ownerKey) {
  const key = normalizeOwnerKey(ownerKey);
  return Array.isArray(store.docsByOwner?.[key]) ? store.docsByOwner[key] : [];
}

function setDocsForOwner(store, ownerKey, docs) {
  const key = normalizeOwnerKey(ownerKey);
  return {
    ...store,
    docsByOwner: {
      ...(store.docsByOwner || {}),
      [key]: docs,
    },
  };
}

function isDocExpired(doc) {
  const base = doc?.createdAt || doc?.updatedAt;
  const ts = new Date(base || "").getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts >= MASTER_DOC_TTL_MS;
}

async function purgeExpiredDocsAcrossOwners() {
  const store = await readStore();
  const owners = Object.keys(store.docsByOwner || {});
  if (!owners.length) return;

  const expiredByOwner = owners.map((ownerKey) => ({
    ownerKey,
    expired: docsForOwner(store, ownerKey).filter(isDocExpired),
  }));

  const hasExpired = expiredByOwner.some((entry) => entry.expired.length > 0);
  if (!hasExpired) return;

  const { apiKey, host } = await getOrCreateIntegratedIndex();
  let nextStore = store;

  for (const { ownerKey, expired } of expiredByOwner) {
    if (!expired.length) continue;
    const namespace = namespaceForOwner(ownerKey);
    await Promise.all(
      expired.map(async (doc) => {
        await deleteMasterDocChunks(host, apiKey, namespace, doc.id);
      }),
    );
    const remaining = docsForOwner(nextStore, ownerKey).filter((doc) => !isDocExpired(doc));
    nextStore = setDocsForOwner(nextStore, ownerKey, remaining);
  }

  await writeStore(nextStore);
}

async function upsertMasterDocChunks(host, apiKey, namespace, chunks, docMeta) {
  const records = chunks.map((chunk, i) =>
    JSON.stringify({
      _id: `${docMeta.id}::${i + 1}`,
      chunk_text: chunk,
      source: `${docMeta.title}#chunk-${i + 1}`,
      doc_id: docMeta.id,
      doc_title: docMeta.title,
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

async function deleteMasterDocChunks(host, apiKey, namespace, docId) {
  await pineconeRequest(
    `https://${host}/vectors/delete`,
    {
      method: "POST",
      headers: {
        ...pineconeHeaders(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        namespace,
        filter: {
          doc_id: { $eq: docId },
        },
      }),
    },
  );
}

async function searchMasterDocChunks(host, apiKey, namespace, query) {
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
          inputs: { text: query },
          top_k: TOP_K,
        },
        fields: ["chunk_text", "source", "doc_id", "doc_title"],
      }),
    },
  );

  const hits = result?.result?.hits || [];
  return hits.map((hit, i) => ({
    label: `[${i + 1}]`,
    text: hit?.fields?.chunk_text || "",
    source: hit?.fields?.source || "",
    docId: hit?.fields?.doc_id || "",
    docTitle: hit?.fields?.doc_title || "",
    score: hit?._score ?? null,
  }));
}

async function callOllamaCompare(guidelinesContext, diffSummary, filePath) {
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
            [
              "You review code changes against engineering guideline excerpts.",
              "Use only the provided excerpts as evidence.",
              "Do not invent standards, frameworks, or policy not present in the excerpts.",
              "Return plain text only. No markdown, no bullet symbols, no asterisks.",
              "When you mention a rule, cite excerpt labels like [1] or [2].",
              "If no excerpt is relevant, say: No relevant guideline match found.",
            ].join(" "),
        },
        {
          role: "user",
          content: [
            `File path: ${filePath}`,
            "",
            "Diff summary:",
            diffSummary,
            "",
            "Guideline excerpts:",
            guidelinesContext,
            "",
            "Return exactly this structure in plain text:",
            "Alignment:",
            "Potential violations:",
            "Suggested follow-ups:",
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Ollama compare failed: ${response.status} ${raw}`);
  }
  const data = await response.json();
  return cleanModelText(data?.message?.content || "No comparison returned.");
}

function fallbackComparison(diffSummary, hits) {
  const points = hits
    .slice(0, 3)
    .map((hit) => `${hit.label} ${hit.docTitle || "Master doc"}: ${hit.text.slice(0, 180)}...`)
    .join("\n");
  return cleanModelText(
    [
      "Alignment:",
      "Master docs were retrieved, but model comparison was unavailable.",
      "",
      "Potential violations:",
      "Manual review recommended using the retrieved guideline snippets below.",
      "",
      "Suggested follow-ups:",
      "Validate this diff summary against the retrieved chunks.",
      "Add tests for any rule-sensitive behavior.",
      "",
      "Retrieved guidance:",
      points || "No guideline chunks found.",
      "",
      "Diff summary:",
      diffSummary,
    ].join("\n"),
  );
}

export async function ingestMasterPdf(fileBuffer, originalName, titleInput, ownerKey) {
  await purgeExpiredDocsAcrossOwners();
  const parsed = await pdfParse(fileBuffer);
  const chunks = chunkText(parsed.text);
  if (!chunks.length) {
    throw new Error("Could not extract readable text from master PDF.");
  }

  const namespace = namespaceForOwner(ownerKey);
  const title = (titleInput || "").trim() || originalName || `master-doc-${Date.now()}.pdf`;
  const doc = {
    id: uuidv4(),
    title,
    originalName: originalName || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chunkCount: chunks.length,
    namespace,
  };

  const { apiKey, host } = await getOrCreateIntegratedIndex();
  await upsertMasterDocChunks(host, apiKey, namespace, chunks, doc);

  const store = await readStore();
  const docs = docsForOwner(store, ownerKey);
  docs.unshift(doc);
  await writeStore(setDocsForOwner(store, ownerKey, docs));
  return doc;
}

export async function listMasterDocs(ownerKey) {
  await purgeExpiredDocsAcrossOwners();
  const store = await readStore();
  return docsForOwner(store, ownerKey);
}

export async function deleteMasterDoc(docId, ownerKey) {
  await purgeExpiredDocsAcrossOwners();
  const id = String(docId || "").trim();
  if (!id) throw new Error("docId is required.");

  const store = await readStore();
  const docs = docsForOwner(store, ownerKey);
  const exists = docs.find((doc) => doc.id === id);
  if (!exists) {
    throw new Error("Master doc not found.");
  }

  const { apiKey, host } = await getOrCreateIntegratedIndex();
  const namespace = namespaceForOwner(ownerKey);
  await deleteMasterDocChunks(host, apiKey, namespace, id);
  const remaining = docs.filter((doc) => doc.id !== id);
  await writeStore(setDocsForOwner(store, ownerKey, remaining));
  return { deleted: true, docId: id };
}

export async function updateMasterDocTitle(docId, title, ownerKey) {
  await purgeExpiredDocsAcrossOwners();
  const id = String(docId || "").trim();
  const nextTitle = String(title || "").trim();
  if (!id) throw new Error("docId is required.");
  if (!nextTitle) throw new Error("title is required.");

  const store = await readStore();
  const docs = docsForOwner(store, ownerKey);
  const idx = docs.findIndex((doc) => doc.id === id);
  if (idx < 0) throw new Error("Master doc not found.");
  docs[idx] = {
    ...docs[idx],
    title: nextTitle,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(setDocsForOwner(store, ownerKey, docs));
  return docs[idx];
}

export async function compareDiffWithMasterDocs({ diffSummary, filePath, ownerKey }) {
  await purgeExpiredDocsAcrossOwners();
  const summary = String(diffSummary || "").trim();
  const file = String(filePath || "").trim();
  if (!summary) throw new Error("diffSummary is required.");

  const docs = await listMasterDocs(ownerKey);
  if (!docs.length) {
    throw new Error("No master docs found. Upload at least one guideline PDF first.");
  }

  const { apiKey, host } = await getOrCreateIntegratedIndex();
  const namespace = namespaceForOwner(ownerKey);
  const query = `${file}\n${summary}`;
  const hits = await searchMasterDocChunks(host, apiKey, namespace, query);
  const titleById = new Map(docs.map((doc) => [doc.id, doc.title]));
  const normalizedHits = hits
    .map((hit) => ({
      ...hit,
      docTitle: titleById.get(hit.docId) || hit.docTitle,
    }))
    .slice(0, MAX_COMPARE_HITS);
  const context = normalizedHits
    .map(
      (hit) =>
        `${hit.label} (${hit.docTitle}) ${String(hit.text || "").slice(0, MAX_HIT_CHARS)}`,
    )
    .join("\n\n");

  if (!context.trim()) {
    return {
      comment: "Alignment:\nNo relevant guideline match found.\n\nPotential violations:\nNo relevant guideline match found.\n\nSuggested follow-ups:\nUpload more specific master-doc guidance or refine the diff summary.",
      sources: normalizedHits,
    };
  }

  let comment = "";
  try {
    comment = await callOllamaCompare(context, summary, file || "unknown-file");
  } catch {
    comment = fallbackComparison(summary, normalizedHits);
  }

  return {
    comment,
    sources: normalizedHits,
  };
}
