const PAGESPEED_ENDPOINT =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
];

const CATEGORY_KEYS: Record<string, string> = {
  performance: "performance",
  accessibility: "accessibility",
  "best-practices": "bestPractices",
  seo: "seo",
};

function scoreTo100(raw: unknown): number | null {
  if (typeof raw !== "number" || Number.isNaN(raw)) return null;
  return Math.round(raw * 100);
}

function extractCoreWebVitals(loadingExperience: any) {
  if (!loadingExperience || typeof loadingExperience !== "object") return null;
  const metrics = loadingExperience.metrics || {};
  const pick = (key: string) => {
    const m = metrics[key];
    if (!m) return null;
    return {
      percentile: m.percentile ?? null,
      category: m.category || null,
    };
  };
  return {
    overallCategory: loadingExperience.overall_category || null,
    id: loadingExperience.id || null,
    metrics: {
      lcp: pick("LARGEST_CONTENTFUL_PAINT_MS"),
      cls: pick("CUMULATIVE_LAYOUT_SHIFT_SCORE"),
      inp: pick("INTERACTION_TO_NEXT_PAINT"),
      fcp: pick("FIRST_CONTENTFUL_PAINT_MS"),
      ttfb: pick("EXPERIMENTAL_TIME_TO_FIRST_BYTE"),
    },
  };
}

export async function runPagespeed({
  url,
  strategy,
  apiKey,
  signal,
}: {
  url: string;
  strategy: "mobile" | "desktop";
  apiKey: string;
  signal?: AbortSignal;
}) {
  if (!apiKey) {
    return {
      ok: false as const,
      error: "GOOGLE_PAGESPEED_API_KEY is not configured",
      strategy,
    };
  }

  const params = new URLSearchParams({ url, strategy, key: apiKey });
  for (const category of CATEGORIES) params.append("category", category);

  try {
    const res = await fetch(`${PAGESPEED_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        data?.error?.message ||
        data?.error?.errors?.[0]?.message ||
        `PageSpeed API error (${res.status})`;
      return {
        ok: false as const,
        error: message,
        strategy,
        status: res.status,
      };
    }

    const lighthouse = data.lighthouseResult || {};
    const categories = lighthouse.categories || {};
    const scores: Record<string, number | null> = {};
    for (const cat of CATEGORIES) {
      const key = CATEGORY_KEYS[cat];
      scores[key] = scoreTo100(categories[cat]?.score);
    }

    return {
      ok: true as const,
      strategy,
      scores,
      coreWebVitals: {
        url: extractCoreWebVitals(data.loadingExperience),
        origin: extractCoreWebVitals(data.originLoadingExperience),
      },
      fetchTime: lighthouse.fetchTime || null,
      finalUrl: lighthouse.finalUrl || data.id || url,
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return {
        ok: false as const,
        error: "PageSpeed request timed out",
        strategy,
      };
    }
    return {
      ok: false as const,
      error: err?.message || "PageSpeed request failed",
      strategy,
    };
  }
}

export async function runPagespeedPanel({
  siteUrl,
  signal,
}: {
  siteUrl: string;
  signal?: AbortSignal;
}) {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || "";
  if (!apiKey) {
    return {
      ok: false as const,
      error: "GOOGLE_PAGESPEED_API_KEY is not configured",
      panel: "pagespeed",
    };
  }

  try {
    const mobile = await runPagespeed({
      url: siteUrl,
      strategy: "mobile",
      apiKey,
      signal,
    });
    const desktop = await runPagespeed({
      url: siteUrl,
      strategy: "desktop",
      apiKey,
      signal,
    });
    const ok = Boolean(mobile?.ok || desktop?.ok);
    return {
      ok,
      panel: "pagespeed",
      siteUrl,
      mobile,
      desktop,
      error: ok ? null : mobile?.error || desktop?.error || "PageSpeed checks failed",
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return {
        ok: false as const,
        error: "PageSpeed panel timed out",
        panel: "pagespeed",
      };
    }
    return {
      ok: false as const,
      error: err?.message || "PageSpeed panel failed",
      panel: "pagespeed",
    };
  }
}

export function speedState(result: {
  ok?: boolean;
  error?: string | null;
  mobile?: { ok?: boolean; status?: number; error?: string };
  desktop?: { ok?: boolean; status?: number; error?: string };
}) {
  if (result?.error === "GOOGLE_PAGESPEED_API_KEY is not configured") {
    return { state: "not_configured" as const, label: result.error };
  }
  if (result?.ok) {
    return { state: "success" as const, label: "ok" };
  }
  const status =
    result?.mobile?.status || result?.desktop?.status || undefined;
  const timeout = /timed out/i.test(
    String(result?.error || result?.mobile?.error || result?.desktop?.error || "")
  );
  return {
    state: "failed" as const,
    label: result?.error || "scan failed",
    status,
    timeout,
  };
}
