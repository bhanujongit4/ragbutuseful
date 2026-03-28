import { answerFromPdf } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const pdf = formData.get("pdf");
    const question = formData.get("question");

    if (!pdf || typeof pdf === "string") {
      return Response.json({ error: "PDF file is required." }, { status: 400 });
    }

    if (!question || typeof question !== "string" || !question.trim()) {
      return Response.json({ error: "Question is required." }, { status: 400 });
    }

    const bytes = await pdf.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const result = await answerFromPdf(buffer, question.trim());

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error: error.message || "RAG pipeline failed.",
      },
      { status: 500 },
    );
  }
}
