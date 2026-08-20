const PAGESPEED_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
const CATEGORY_KEYS = { performance: 'performance', accessibility: 'accessibility', 'best-practices': 'bestPractices', seo: 'seo' }

function scoreTo100(raw) {
  if (typeof raw !== 'number' || Number.isNaN(raw)) return null
  return Math.round(raw * 100)
}

function extractCoreWebVitals(loadingExperience) {
  if (!loadingExperience || typeof loadingExperience !== 'object') return null
  const metrics = loadingExperience.metrics || {}
  const pick = (key) => {
    const m = metrics[key]
    if (!m) return null
    return { percentile: m.percentile ?? null, category: m.category || null }
  }
  return {
    overallCategory: loadingExperience.overall_category || null,
    id: loadingExperience.id || null,
    metrics: {
      lcp: pick('LARGEST_CONTENTFUL_PAINT_MS'),
      cls: pick('CUMULATIVE_LAYOUT_SHIFT_SCORE'),
      inp: pick('INTERACTION_TO_NEXT_PAINT'),
      fcp: pick('FIRST_CONTENTFUL_PAINT_MS'),
      ttfb: pick('EXPERIMENTAL_TIME_TO_FIRST_BYTE'),
    },
  }
}

/** Run PageSpeed Insights for one strategy (mobile | desktop). Soft-fails. */
export async function runPagespeed({ url, strategy, apiKey, signal }) {
  if (!apiKey) {
    return { ok: false, error: 'GOOGLE_PAGESPEED_API_KEY is not configured', strategy }
  }
  const params = new URLSearchParams({ url, strategy, key: apiKey })
  for (const category of CATEGORIES) params.append('category', category)

  try {
    const res = await fetch(`${PAGESPEED_ENDPOINT}?${params.toString()}`, {
      method: 'GET', signal, headers: { Accept: 'application/json' },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = data?.error?.message || data?.error?.errors?.[0]?.message || `PageSpeed API error (${res.status})`
      return { ok: false, error: message, strategy, status: res.status }
    }
    const lighthouse = data.lighthouseResult || {}
    const categories = lighthouse.categories || {}
    const scores = {}
    for (const cat of CATEGORIES) scores[CATEGORY_KEYS[cat]] = scoreTo100(categories[cat]?.score)
    return {
      ok: true,
      strategy,
      scores,
      coreWebVitals: {
        url: extractCoreWebVitals(data.loadingExperience),
        origin: extractCoreWebVitals(data.originLoadingExperience),
      },
      fetchTime: lighthouse.fetchTime || null,
      finalUrl: lighthouse.finalUrl || data.id || url,
    }
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, error: 'PageSpeed request timed out', strategy }
    return { ok: false, error: err?.message || 'PageSpeed request failed', strategy }
  }
}

/** Panel: mobile + desktop, sequential to avoid rate limits. */
export async function runPagespeedPanel({ siteUrl, signal }) {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || ''
  if (!apiKey) {
    return { ok: false, error: 'GOOGLE_PAGESPEED_API_KEY is not configured', panel: 'pagespeed' }
  }
  try {
    const mobile = await runPagespeed({ url: siteUrl, strategy: 'mobile', apiKey, signal })
    const desktop = await runPagespeed({ url: siteUrl, strategy: 'desktop', apiKey, signal })
    const ok = Boolean(mobile?.ok || desktop?.ok)
    return {
      ok, panel: 'pagespeed', siteUrl, mobile, desktop,
      error: ok ? null : mobile?.error || desktop?.error || 'PageSpeed checks failed',
    }
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, error: 'PageSpeed panel timed out', panel: 'pagespeed' }
    return { ok: false, error: err?.message || 'PageSpeed panel failed', panel: 'pagespeed' }
  }
}
