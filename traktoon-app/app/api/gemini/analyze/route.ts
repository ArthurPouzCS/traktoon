import { NextRequest, NextResponse } from "next/server";
import { generateSiteAnalysis } from "@/lib/gemini/client";

interface AnalyzeRequest {
  url: string;
  content?: unknown;
  design?: unknown;
  pages?: Array<{
    url: string;
    content: unknown;
    design: unknown;
  }>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: AnalyzeRequest = await request.json();

    if (
      !body.url ||
      (!body.pages && (!body.content || !body.design)) ||
      (body.pages && body.pages.length === 0)
    ) {
      return NextResponse.json(
        { error: "url et pages (ou content+design) sont requis" },
        { status: 400 },
      );
    }

    const analysis = await generateSiteAnalysis({
      url: body.url,
      pages: body.pages,
      content: body.content,
      design: body.design,
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Erreur API Gemini Analyze:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}
