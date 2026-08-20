export async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({ ok: false, error: res.statusText }));
  if (data.banner) {
    const el = document.querySelector("[data-session-banner]");
    if (el && data.sessionUpdates) el.textContent = data.banner;
  }
  if (!res.ok || data.ok === false) throw new Error(data.error || "Request failed");
  return data;
}

export function nav(active) {
  const items = [
    ["articles.html", "Articles"],
    ["add-article.html", "Add Article"],
    ["articles-health.html", "Articles Health"],
    ["articles-update.html", "Articles Update"],
    ["team.html", "Team"],
    ["dashboard.html", "Dashboard"],
  ];
  return `<nav><h1>CMS</h1>${items
    .map(([href, label]) => `<a href="${href}" class="${active === href ? "active" : ""}">${label}</a>`)
    .join("")}</nav>`;
}
