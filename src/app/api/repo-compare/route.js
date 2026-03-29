import { compareDiffWithMasterDocs } from "@/lib/masterDocs";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await compareDiffWithMasterDocs({
      diffSummary: body?.diffSummary,
      filePath: body?.filePath,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error?.message || "Failed to compare with master docs." },
      { status: 400 },
    );
  }
}

