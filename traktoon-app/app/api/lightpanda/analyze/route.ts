import { NextRequest, NextResponse } from "next/server";
import { analyzeSite } from "@/lib/lightpanda/analyze-site";
import { generateSiteAnalysis } from "@/lib/gemini/client";

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(candidate).toString();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { url?: string };

    if (!body.url) {
      return NextResponse.json({ error: "url est requis" }, { status: 400 });
    }

    const normalizedUrl = normalizeUrl(body.url);

    const site = await analyzeSite(normalizedUrl, {
      waitUntil: "domcontentloaded",
      timeoutMs: 90000,
    });

    const gemini = await generateSiteAnalysis({
      url: normalizedUrl,
      content: site.content,
      design: site.design,
    });

    const prompt = `Website: ${normalizedUrl}\n${gemini.backgroundDescription}`;

    return NextResponse.json({
      url: normalizedUrl,
      prompt,
      gemini,
    });
  } catch (error) {
    console.error("Erreur API Lightpanda Analyze:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
