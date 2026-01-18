import puppeteer from "puppeteer-core";
import { getRedirectUri } from "@/lib/utils/redirect-uri";

export type WaitUntil = "load" | "domcontentloaded" | "networkidle0" | "networkidle2";

export interface AnalyzeOptions {
  wsEndpoint?: string;
  timeoutMs?: number;
  waitUntil?: WaitUntil;
  viewport?: { width: number; height: number };
  maxColors?: number;
  maxFonts?: number;
  crawlDepth?: number;
  maxPages?: number;
}

export interface ContentAnalysis {
  title: string;
  language: string | null;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  wordCount: number;
  paragraphCount: number;
  links: {
    internal: number;
    external: number;
  };
  images: {
    total: number;
    withAlt: number;
    withoutAlt: number;
  };
  textSample: string;
}

export interface DesignAnalysis {
  palette: string[];
  paletteWithUsage?: Array<{ color: string; count: number }>;
  fonts: string[];
  baseFontSize: string | null;
  textColors: string[];
  backgroundColors: string[];
  backgroundColorsByArea?: string[];
  borderColors?: string[];
  outlineColors?: string[];
  svgColors?: string[];
  variableColors?: string[];
  hasViewportMeta: boolean;
  layout: {
    bodyWidth: number;
    mainWidth: number | null;
    columnCountEstimate: number;
  };
}

export interface SiteAnalysis {
  url: string;
  fetchedAt: string;
  content: ContentAnalysis;
  design: DesignAnalysis;
}

export interface GeminiSiteAnalysis {
  backgroundDescription: string;
}

export interface SiteAnalysisWithGemini extends SiteAnalysis {
  gemini: GeminiSiteAnalysis;
}

export interface SitePageAnalysis {
  url: string;
  content: ContentAnalysis;
  design: DesignAnalysis;
}

function getWsEndpoint(options?: AnalyzeOptions): string {
  if (options?.wsEndpoint) return options.wsEndpoint;

  const envEndpoint = process.env.LIGHTPANDA_WS_ENDPOINT;
  if (envEndpoint) return envEndpoint;

  const token = process.env.LIGHTPANDA_TOKEN;
  const base = process.env.LIGHTPANDA_WS_BASE || "wss://euwest.cloud.lightpanda.io/ws";
  if (token) return `${base}?token=${token}`;

  throw new Error(
    "Lightpanda WS endpoint manquant. Definis LIGHTPANDA_WS_ENDPOINT ou LIGHTPANDA_TOKEN.",
  );
}

export async function analyzeSite(
  url: string,
  options?: AnalyzeOptions,
): Promise<SiteAnalysis> {
  const wsEndpoint = getWsEndpoint(options);
  const timeoutMs = options?.timeoutMs ?? 30000;
  const waitUntil = options?.waitUntil ?? "networkidle2";
  const viewport = options?.viewport ?? { width: 1366, height: 768 };
  const maxColors = options?.maxColors ?? 12;
  const maxFonts = options?.maxFonts ?? 8;

  const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
  const page = await browser.newPage();
  await page.setViewport(viewport);

  try {
    await page.goto(url, { waitUntil, timeout: timeoutMs });

    const evaluationScript = `
      (() => {
        const { maxColors, maxFonts } = ${JSON.stringify({ maxColors, maxFonts })};

        function trim(value) {
          return value.replace(/\\s+/g, " ").trim();
        }

        const text = document.body?.innerText ?? "";
        const words = text.trim() ? text.trim().split(/\\s+/).length : 0;

        const headings = {
          h1: Array.from(document.querySelectorAll("h1")).map((el) =>
            trim(el.textContent || ""),
          ),
          h2: Array.from(document.querySelectorAll("h2")).map((el) =>
            trim(el.textContent || ""),
          ),
          h3: Array.from(document.querySelectorAll("h3")).map((el) =>
            trim(el.textContent || ""),
          ),
        };

        const paragraphs = Array.from(document.querySelectorAll("p"));
        const links = Array.from(document.querySelectorAll("a[href]"));
        const images = Array.from(document.querySelectorAll("img")).filter(Boolean);

        const internal = links.filter((a) => a.hostname === location.hostname).length;
        const external = links.filter((a) => a.hostname !== location.hostname).length;

        const withAlt = images.filter((img) =>
          img && (img.getAttribute("alt") || "").trim().length > 0,
        ).length;

        const docEl = document.documentElement;
        const content = {
          title: document.title || "",
          language: docEl ? docEl.getAttribute("lang") : null,
          headings,
          wordCount: words,
          paragraphCount: paragraphs.length,
          links: { internal, external },
          images: {
            total: images.length,
            withAlt,
            withoutAlt: Math.max(images.length - withAlt, 0),
          },
          textSample: trim(text).slice(0, 400),
        };

        function isVisible(el) {
          let style;
          try {
            style = window.getComputedStyle(el);
          } catch {
            return false;
          }
          if (style.display === "none" || style.visibility === "hidden") return false;
          const opacity = parseFloat(style.opacity || "1");
          if (opacity <= 0) return false;
          return el.getClientRects().length > 0;
        }

        const colorCount = {};
        const bgCount = {};
        const areaBgCount = {};
        const borderCount = {};
        const outlineCount = {};
        const svgCount = {};
        const fontCount = {};
        const fontSizes = {};
        const variableColors = new Set();

        if (docEl) {
          try {
            const rootStyles = window.getComputedStyle(docEl);
            for (let i = 0; i < rootStyles.length; i += 1) {
              const prop = rootStyles[i];
              if (!prop || !prop.startsWith("--")) continue;
              const value = rootStyles.getPropertyValue(prop).trim();
              if (value && /(#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\()/i.test(value)) {
                variableColors.add(value);
              }
            }

            const htmlBg = rootStyles.backgroundColor;
            if (htmlBg && htmlBg !== "rgba(0, 0, 0, 0)") {
              bgCount[htmlBg] = (bgCount[htmlBg] || 0) + 1;
            }
          } catch {
            // Ignore style access errors in restrictive environments.
          }
        }
        if (document.body) {
          try {
            const bodyBg = window.getComputedStyle(document.body).backgroundColor;
            if (bodyBg && bodyBg !== "rgba(0, 0, 0, 0)") {
              bgCount[bodyBg] = (bgCount[bodyBg] || 0) + 1;
            }
          } catch {
            // Ignore style access errors.
          }
        }

        const elements = Array.from(document.querySelectorAll("*")).slice(0, 5000);
        for (const el of elements) {
          if (!isVisible(el)) continue;

          let style;
          try {
            style = window.getComputedStyle(el);
          } catch {
            continue;
          }
          let color;
          let bg;
          let fontFamily;
          let fontSize;
          let borderColor;
          let outlineColor;
          let fill;
          let stroke;
          let rect;
          try {
            color = style.color;
            bg = style.backgroundColor;
            fontFamily = style.fontFamily;
            fontSize = style.fontSize;
            borderColor = style.borderColor;
            outlineColor = style.outlineColor;
            fill = style.fill;
            stroke = style.stroke;
            rect = el.getBoundingClientRect();
          } catch {
            continue;
          }

          if (color) colorCount[color] = (colorCount[color] || 0) + 1;
          if (bg && bg !== "rgba(0, 0, 0, 0)") {
            bgCount[bg] = (bgCount[bg] || 0) + 1;
            if (rect) {
              const area = Math.max(0, rect.width) * Math.max(0, rect.height);
              if (area > 0) {
                areaBgCount[bg] = (areaBgCount[bg] || 0) + area;
              }
            }
          }
          if (borderColor && borderColor !== "rgba(0, 0, 0, 0)") {
            borderCount[borderColor] = (borderCount[borderColor] || 0) + 1;
          }
          if (outlineColor && outlineColor !== "rgba(0, 0, 0, 0)") {
            outlineCount[outlineColor] = (outlineCount[outlineColor] || 0) + 1;
          }
          if (fill && fill !== "none" && fill !== "rgba(0, 0, 0, 0)") {
            svgCount[fill] = (svgCount[fill] || 0) + 1;
          }
          if (stroke && stroke !== "none" && stroke !== "rgba(0, 0, 0, 0)") {
            svgCount[stroke] = (svgCount[stroke] || 0) + 1;
          }
          if (fontFamily) fontCount[fontFamily] = (fontCount[fontFamily] || 0) + 1;
          if (fontSize) fontSizes[fontSize] = (fontSizes[fontSize] || 0) + 1;
        }

        const topByCount = (map, limit) =>
          Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([key]) => key);

        const topByCountWithUsage = (map, limit) =>
          Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([key, count]) => ({ color: key, count }));

        const baseFontSize =
          Object.entries(fontSizes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        const bodyWidth = document.body?.clientWidth ?? 0;
        const mainEl = document.querySelector("main");
        const mainWidth = mainEl ? mainEl.clientWidth : null;

        const blockEls = Array.from(
          document.querySelectorAll("section, main, article, div"),
        ).filter(isVisible);
        const leftPositions = new Set();
        for (const el of blockEls.slice(0, 40)) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 40) {
            leftPositions.add(Math.round(rect.left));
          }
        }

        const combinedCount = {};
        const mergeCounts = (map) => {
          for (const [key, count] of Object.entries(map)) {
            combinedCount[key] = (combinedCount[key] || 0) + count;
          }
        };

        mergeCounts(colorCount);
        mergeCounts(bgCount);
        mergeCounts(areaBgCount);
        mergeCounts(borderCount);
        mergeCounts(outlineCount);
        mergeCounts(svgCount);

        const paletteWithUsage = topByCountWithUsage(combinedCount, maxColors);

        const design = {
          palette: paletteWithUsage.map((item) => item.color),
          paletteWithUsage,
          fonts: topByCount(fontCount, maxFonts),
          baseFontSize,
          textColors: topByCount(colorCount, maxColors),
          backgroundColors: topByCount(bgCount, maxColors),
          backgroundColorsByArea: topByCount(areaBgCount, maxColors),
          borderColors: topByCount(borderCount, maxColors),
          outlineColors: topByCount(outlineCount, maxColors),
          svgColors: topByCount(svgCount, maxColors),
          variableColors: Array.from(variableColors).slice(0, maxColors),
          hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
          layout: {
            bodyWidth,
            mainWidth,
            columnCountEstimate: leftPositions.size || 1,
          },
        };

        return { content, design };
      })()
    `;

    const result = (await page.evaluate(evaluationScript)) as {
      content: ContentAnalysis;
      design: DesignAnalysis;
    };

    return {
      url,
      fetchedAt: new Date().toISOString(),
      content: result.content,
      design: result.design,
    };
  } finally {
    try {
      await page.close();
    } catch {
      // Ignore cleanup errors when the connection is already closed.
    }
    try {
      await browser.disconnect();
    } catch {
      // Ignore cleanup errors when the connection is already closed.
    }
  }
}

export async function analyzeSiteWithGemini(
  url: string,
  options?: AnalyzeOptions & { geminiEndpoint?: string; geminiTimeoutMs?: number },
): Promise<SiteAnalysisWithGemini> {
  const crawlDepth = options?.crawlDepth ?? 0;
  const maxPages = options?.maxPages ?? 6;
  const wsEndpoint = getWsEndpoint(options);
  const timeoutMs = options?.timeoutMs ?? 30000;
  const waitUntil = options?.waitUntil ?? "networkidle2";
  const viewport = options?.viewport ?? { width: 1366, height: 768 };
  const maxColors = options?.maxColors ?? 12;
  const maxFonts = options?.maxFonts ?? 8;

  const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
  const page = await browser.newPage();
  await page.setViewport(viewport);

  const evaluationScript = `
    (() => {
      const { maxColors, maxFonts } = ${JSON.stringify({ maxColors, maxFonts })};

      function trim(value) {
        return value.replace(/\\s+/g, " ").trim();
      }

      const text = document.body?.innerText ?? "";
      const words = text.trim() ? text.trim().split(/\\s+/).length : 0;

      const headings = {
        h1: Array.from(document.querySelectorAll("h1")).map((el) =>
          trim(el.textContent || ""),
        ),
        h2: Array.from(document.querySelectorAll("h2")).map((el) =>
          trim(el.textContent || ""),
        ),
        h3: Array.from(document.querySelectorAll("h3")).map((el) =>
          trim(el.textContent || ""),
        ),
      };

      const paragraphs = Array.from(document.querySelectorAll("p"));
      const links = Array.from(document.querySelectorAll("a[href]"));
      const images = Array.from(document.querySelectorAll("img")).filter(Boolean);

      const internal = links.filter((a) => a.hostname === location.hostname).length;
      const external = links.filter((a) => a.hostname !== location.hostname).length;

      const withAlt = images.filter((img) =>
        img && (img.getAttribute("alt") || "").trim().length > 0,
      ).length;

      const docEl = document.documentElement;
      const content = {
        title: document.title || "",
        language: docEl ? docEl.getAttribute("lang") : null,
        headings,
        wordCount: words,
        paragraphCount: paragraphs.length,
        links: { internal, external },
        images: {
          total: images.length,
          withAlt,
          withoutAlt: Math.max(images.length - withAlt, 0),
        },
        textSample: trim(text).slice(0, 400),
      };

      function isVisible(el) {
        let style;
        try {
          style = window.getComputedStyle(el);
        } catch {
          return false;
        }
        if (style.display === "none" || style.visibility === "hidden") return false;
        const opacity = parseFloat(style.opacity || "1");
        if (opacity <= 0) return false;
        return el.getClientRects().length > 0;
      }

      const colorCount = {};
      const bgCount = {};
      const areaBgCount = {};
      const borderCount = {};
      const outlineCount = {};
      const svgCount = {};
      const fontCount = {};
      const fontSizes = {};
      const variableColors = new Set();

      if (docEl) {
        try {
          const rootStyles = window.getComputedStyle(docEl);
          for (let i = 0; i < rootStyles.length; i += 1) {
            const prop = rootStyles[i];
            if (!prop || !prop.startsWith("--")) continue;
            const value = rootStyles.getPropertyValue(prop).trim();
            if (value && /(#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\()/i.test(value)) {
              variableColors.add(value);
            }
          }

          const htmlBg = rootStyles.backgroundColor;
          if (htmlBg && htmlBg !== "rgba(0, 0, 0, 0)") {
            bgCount[htmlBg] = (bgCount[htmlBg] || 0) + 1;
          }
        } catch {
          // Ignore style access errors in restrictive environments.
        }
      }
      if (document.body) {
        try {
          const bodyBg = window.getComputedStyle(document.body).backgroundColor;
          if (bodyBg && bodyBg !== "rgba(0, 0, 0, 0)") {
            bgCount[bodyBg] = (bgCount[bodyBg] || 0) + 1;
          }
        } catch {
          // Ignore style access errors.
        }
      }

      const elements = Array.from(document.querySelectorAll("*")).slice(0, 5000);
      for (const el of elements) {
        if (!isVisible(el)) continue;

        let style;
        try {
          style = window.getComputedStyle(el);
        } catch {
          continue;
        }
        let color;
        let bg;
        let fontFamily;
        let fontSize;
        let borderColor;
        let outlineColor;
        let fill;
        let stroke;
        let rect;
        try {
          color = style.color;
          bg = style.backgroundColor;
          fontFamily = style.fontFamily;
          fontSize = style.fontSize;
          borderColor = style.borderColor;
          outlineColor = style.outlineColor;
          fill = style.fill;
          stroke = style.stroke;
          rect = el.getBoundingClientRect();
        } catch {
          continue;
        }

        if (color) colorCount[color] = (colorCount[color] || 0) + 1;
        if (bg && bg !== "rgba(0, 0, 0, 0)") {
          bgCount[bg] = (bgCount[bg] || 0) + 1;
          if (rect) {
            const area = Math.max(0, rect.width) * Math.max(0, rect.height);
            if (area > 0) {
              areaBgCount[bg] = (areaBgCount[bg] || 0) + area;
            }
          }
        }
        if (borderColor && borderColor !== "rgba(0, 0, 0, 0)") {
          borderCount[borderColor] = (borderCount[borderColor] || 0) + 1;
        }
        if (outlineColor && outlineColor !== "rgba(0, 0, 0, 0)") {
          outlineCount[outlineColor] = (outlineCount[outlineColor] || 0) + 1;
        }
        if (fill && fill !== "none" && fill !== "rgba(0, 0, 0, 0)") {
          svgCount[fill] = (svgCount[fill] || 0) + 1;
        }
        if (stroke && stroke !== "none" && stroke !== "rgba(0, 0, 0, 0)") {
          svgCount[stroke] = (svgCount[stroke] || 0) + 1;
        }
        if (fontFamily) fontCount[fontFamily] = (fontCount[fontFamily] || 0) + 1;
        if (fontSize) fontSizes[fontSize] = (fontSizes[fontSize] || 0) + 1;
      }

      const topByCount = (map, limit) =>
        Object.entries(map)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([key]) => key);

      const topByCountWithUsage = (map, limit) =>
        Object.entries(map)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([key, count]) => ({ color: key, count }));

      const baseFontSize =
        Object.entries(fontSizes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const bodyWidth = document.body?.clientWidth ?? 0;
      const mainEl = document.querySelector("main");
      const mainWidth = mainEl ? mainEl.clientWidth : null;

      const blockEls = Array.from(
        document.querySelectorAll("section, main, article, div"),
      ).filter(isVisible);
      const leftPositions = new Set();
      for (const el of blockEls.slice(0, 40)) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 40) {
          leftPositions.add(Math.round(rect.left));
        }
      }

      const combinedCount = {};
      const mergeCounts = (map) => {
        for (const [key, count] of Object.entries(map)) {
          combinedCount[key] = (combinedCount[key] || 0) + count;
        }
      };

      mergeCounts(colorCount);
      mergeCounts(bgCount);
      mergeCounts(areaBgCount);
      mergeCounts(borderCount);
      mergeCounts(outlineCount);
      mergeCounts(svgCount);

      const paletteWithUsage = topByCountWithUsage(combinedCount, maxColors);

      const design = {
        palette: paletteWithUsage.map((item) => item.color),
        paletteWithUsage,
        fonts: topByCount(fontCount, maxFonts),
        baseFontSize,
        textColors: topByCount(colorCount, maxColors),
        backgroundColors: topByCount(bgCount, maxColors),
        backgroundColorsByArea: topByCount(areaBgCount, maxColors),
        borderColors: topByCount(borderCount, maxColors),
        outlineColors: topByCount(outlineCount, maxColors),
        svgColors: topByCount(svgCount, maxColors),
        variableColors: Array.from(variableColors).slice(0, maxColors),
        hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
        layout: {
          bodyWidth,
          mainWidth,
          columnCountEstimate: leftPositions.size || 1,
        },
      };

      return { content, design };
    })()
  `;

  const pages: SitePageAnalysis[] = [];

  async function analyzeCurrentPage(currentUrl: string) {
    await page.goto(currentUrl, { waitUntil, timeout: timeoutMs });
    const result = (await page.evaluate(evaluationScript)) as {
      content: ContentAnalysis;
      design: DesignAnalysis;
    };
    pages.push({
      url: currentUrl,
      content: result.content,
      design: result.design,
    });
  }

  async function getInternalLinksFromPage(currentUrl: string): Promise<string[]> {
    const baseOrigin = new URL(currentUrl).origin;
    const rawLinks = (await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a[href]")).filter(Boolean);
      return links.map((a) => (a && a.getAttribute("href")) || "");
    })) as string[];

    const normalized = new Set<string>();
    for (const href of rawLinks) {
      if (!href) continue;
      try {
        const absolute = new URL(href, currentUrl);
        if (absolute.origin !== baseOrigin) continue;
        if (absolute.hash) {
          absolute.hash = "";
        }
        normalized.add(absolute.toString());
      } catch {
        continue;
      }
    }

    return Array.from(normalized);
  }

  try {
    await analyzeCurrentPage(url);

    if (crawlDepth >= 1 && pages.length < maxPages) {
      const internalLinks = await getInternalLinksFromPage(url);
      for (const link of internalLinks) {
        if (pages.length >= maxPages) break;
        if (pages.find((p) => p.url === link)) continue;
        await analyzeCurrentPage(link);
      }
    }
  } finally {
    try {
      await page.close();
    } catch {
      // Ignore cleanup errors when the connection is already closed.
    }
    try {
      await browser.disconnect();
    } catch {
      // Ignore cleanup errors when the connection is already closed.
    }
  }

  const endpoint =
    options?.geminiEndpoint ||
    getRedirectUri("/api/gemini/analyze");

  const controller = new AbortController();
  const requestTimeoutMs = options?.geminiTimeoutMs ?? 45000;
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        pages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Erreur lors de l'analyse Gemini");
    }

    const data = (await response.json()) as { analysis: GeminiSiteAnalysis };

    const primary = pages[0];

    return {
      url,
      fetchedAt: new Date().toISOString(),
      content: primary?.content || {
        title: "",
        language: null,
        headings: { h1: [], h2: [], h3: [] },
        wordCount: 0,
        paragraphCount: 0,
        links: { internal: 0, external: 0 },
        images: { total: 0, withAlt: 0, withoutAlt: 0 },
        textSample: "",
      },
      design: primary?.design || {
        palette: [],
        paletteWithUsage: [],
        fonts: [],
        baseFontSize: null,
        textColors: [],
        backgroundColors: [],
        backgroundColorsByArea: [],
        borderColors: [],
        outlineColors: [],
        svgColors: [],
        variableColors: [],
        hasViewportMeta: false,
        layout: { bodyWidth: 0, mainWidth: null, columnCountEstimate: 0 },
      },
      gemini: data.analysis,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
