import {
  getRepoTreeWithLatestSummaries,
  parseGitHubRepoInput,
} from "@/lib/repoSummary";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const repoInput = body?.repoUrl || body?.repo || "";
    const { owner, repo } = parseGitHubRepoInput(repoInput);
    const result = await getRepoTreeWithLatestSummaries(owner, repo);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error?.message || "Failed to analyze repository." },
      { status: 400 },
    );
  }
}

