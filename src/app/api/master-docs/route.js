import {
  deleteMasterDoc,
  ingestMasterPdf,
  listMasterDocs,
  updateMasterDocTitle,
} from "@/lib/masterDocs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const docs = await listMasterDocs();
    return Response.json({ docs });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Failed to list master docs." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const pdf = formData.get("pdf");
    const title = formData.get("title");

    if (!pdf || typeof pdf === "string") {
      return Response.json({ error: "PDF file is required." }, { status: 400 });
    }

    const bytes = await pdf.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const doc = await ingestMasterPdf(buffer, pdf.name, typeof title === "string" ? title : "");
    return Response.json({ doc });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Failed to upload master doc." },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const updated = await updateMasterDocTitle(body?.docId, body?.title);
    return Response.json({ doc: updated });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Failed to edit master doc." },
      { status: 400 },
    );
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const result = await deleteMasterDoc(body?.docId);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error?.message || "Failed to delete master doc." },
      { status: 400 },
    );
  }
}

