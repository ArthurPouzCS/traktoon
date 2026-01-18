import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const url = process.argv[2] || "https://www.allocine.fr";

  const { analyzeSite } = await import("@/lib/lightpanda/analyze-site");
  const { generateSiteAnalysis } = await import("@/lib/gemini/client");

  const site = await analyzeSite(url, {
    waitUntil: "domcontentloaded",
    timeoutMs: 90000,
  });

  const gemini = await generateSiteAnalysis({
    url,
    content: site.content,
    design: site.design,
  });

  const output = {
    url,
    fetchedAt: site.fetchedAt,
    content: {
      title: site.content.title,
      language: site.content.language,
      wordCount: site.content.wordCount,
      paragraphCount: site.content.paragraphCount,
      headings: site.content.headings,
      links: site.content.links,
      images: site.content.images,
      textSample: site.content.textSample,
    },
    design: {
      palette: site.design.palette,
      fonts: site.design.fonts,
      baseFontSize: site.design.baseFontSize,
      hasViewportMeta: site.design.hasViewportMeta,
      layout: site.design.layout,
    },
    gemini,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error("Erreur lightpanda:", error);
  process.exitCode = 1;
});
