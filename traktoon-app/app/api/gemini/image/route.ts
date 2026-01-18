import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/gemini/client";

interface ImageRequest {
  description: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ImageRequest = await request.json();

    if (!body.description || typeof body.description !== "string") {
      return NextResponse.json(
        { error: "La description est requise" },
        { status: 400 },
      );
    }

    const imageBase64 = await generateImage(body.description);

    return NextResponse.json({ image: imageBase64 });
  } catch (error) {
    console.error("Erreur API Gemini Image:", error);

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
