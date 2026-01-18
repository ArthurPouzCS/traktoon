import { NextRequest, NextResponse } from "next/server";
import { generateDetailedPlan } from "@/lib/gemini/client";
import type { ChannelPlan } from "@/types/plan";
import type { DetailedPlan } from "@/types/detailed-plan";

interface PreciseRequest {
  channelPlan: ChannelPlan;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: PreciseRequest = await request.json();

    if (!body.channelPlan) {
      return NextResponse.json(
        { error: "ChannelPlan est requis" },
        { status: 400 },
      );
    }

    const detailedPlan: DetailedPlan = await generateDetailedPlan(body.channelPlan);

    return NextResponse.json({ detailedPlan });
  } catch (error) {
    console.error("Erreur API Gemini Precise:", error);

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
