import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DetailedPlan } from "@/types/detailed-plan";
import { generateLandingPageSite } from "@/lib/gemini/client";

interface LandingVercelRequest {
  planId: string;
  channel: "LandingPage";
  force?: boolean;
}

interface LandingVercelResponse {
  url: string;
}

interface VercelDeploymentResponse {
  url?: string;
  id?: string;
  readyState?: string;
  alias?: string[];
  automaticAliases?: string[];
}

interface DetailedPlanWithVercel extends DetailedPlan {
  vercelDeploymentUrl?: string;
  vercelProjectName?: string;
}

interface GtmPlanRow {
  detailed_plans: Record<string, DetailedPlanWithVercel> | null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!process.env.VERCEL_TOKEN) {
      return NextResponse.json(
        { error: "VERCEL_TOKEN manquant dans les variables d'environnement" },
        { status: 500 },
      );
    }

    const body: LandingVercelRequest = await request.json();

    if (!body.planId) {
      return NextResponse.json(
        { error: "planId est requis" },
        { status: 400 },
      );
    }

    if (body.channel !== "LandingPage") {
      return NextResponse.json(
        { error: "Cette route ne supporte que le channel LandingPage" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 },
      );
    }

    const { data: planRow, error: fetchError } = await supabase
      .from("gtm_plans")
      .select("detailed_plans")
      .eq("id", body.planId)
      .eq("user_id", user.id)
      .single<GtmPlanRow>();

    if (fetchError || !planRow) {
      return NextResponse.json(
        { error: "Plan introuvable pour cet utilisateur" },
        { status: 404 },
      );
    }

    const detailedPlans = planRow.detailed_plans ?? {};
    const currentLandingPlan = detailedPlans["LandingPage"] as DetailedPlanWithVercel | undefined;
    const projectName = `traktoon-landing-${body.planId}`;

    if (!currentLandingPlan) {
      return NextResponse.json(
        { error: "Aucun plan détaillé LandingPage trouvé. Générez d'abord le plan détaillé." },
        { status: 400 },
      );
    }

    if (currentLandingPlan.vercelDeploymentUrl && !body.force) {
      const existingResponse: LandingVercelResponse = { url: currentLandingPlan.vercelDeploymentUrl };
      return NextResponse.json(existingResponse);
    }

    const site = await generateLandingPageSite(currentLandingPlan);

    const vercelResponse = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN as string}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectName,
        files: [
          {
            file: "index.html",
            data: site.html,
          },
          {
            file: "styles.css",
            data: site.css,
          },
        ],
        projectSettings: {
          framework: null,
        },
        target: "production",
      }),
    });

    if (!vercelResponse.ok) {
      const errorBody = await vercelResponse.text();
      console.error("Erreur Vercel:", errorBody);
      return NextResponse.json(
        { error: "Erreur lors du déploiement sur Vercel" },
        { status: 502 },
      );
    }

    let vercelData = (await vercelResponse.json()) as VercelDeploymentResponse;
    // Log initial de la réponse Vercel pour inspection (sans inclure le token)
    console.log("Vercel deployment response (LandingPage, initial):", JSON.stringify(vercelData));

    // Polling pendant ~1 minute pour récupérer l'état final et l'URL publique
    const deploymentId = vercelData.id;
    if (deploymentId) {
      const maxWaitMs = 60000;
      const pollIntervalMs = 5000;
      const start = Date.now();

      // eslint-disable-next-line no-constant-condition
      while (Date.now() - start < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

        const pollResponse = await fetch(
          `https://api.vercel.com/v13/deployments/${deploymentId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${process.env.VERCEL_TOKEN as string}`,
            },
          },
        );

        if (!pollResponse.ok) {
          const pollErrorBody = await pollResponse.text();
          console.error("Erreur lors du polling Vercel:", pollErrorBody);
          break;
        }

        const polledData = (await pollResponse.json()) as VercelDeploymentResponse;
        console.log(
          "Vercel deployment poll response (LandingPage):",
          JSON.stringify(polledData),
        );
        vercelData = polledData;

        if (polledData.readyState === "READY") {
          break;
        }
      }
    }

    // Utiliser l'URL renvoyée par Vercel (hostname *.vercel.app) après polling
    const aliasCandidates: string[] = [
      ...((vercelData.alias ?? []) as string[]),
      ...((vercelData.automaticAliases ?? []) as string[]),
    ];

    const aliasHostname =
      aliasCandidates.find((a) => typeof a === "string" && a.includes(".vercel.app")) ??
      undefined;

    const deploymentUrl = aliasHostname ?? vercelData.url;

    if (!deploymentUrl) {
      return NextResponse.json(
        { error: "Réponse Vercel invalide: URL manquante" },
        { status: 502 },
      );
    }

    const updatedLandingPlan: DetailedPlanWithVercel = {
      ...currentLandingPlan,
      vercelDeploymentUrl: deploymentUrl,
      vercelProjectName: projectName,
    };

    const updatedDetailedPlans: Record<string, DetailedPlanWithVercel> = {
      ...detailedPlans,
      LandingPage: updatedLandingPlan,
    };

    const { error: updateError } = await supabase
      .from("gtm_plans")
      .update({
        detailed_plans: updatedDetailedPlans,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.planId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Erreur lors de la mise à jour de detailed_plans:", updateError);
      // On continue quand même à renvoyer l'URL au client
    }

    const responseBody: LandingVercelResponse = { url: deploymentUrl };
    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("Erreur API LandingPage Vercel:", error);

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

