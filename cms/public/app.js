const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

async function api(path, options = {}) {
  const opts = { ...options };
  if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== "string") {
    opts.headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    opts.body = JSON.stringify(opts.body);
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch (err) {
    throw new Error(err.message || "Network error");
  }
  const data = await res.json().catch(() => null);
  if (!data) throw new Error("CMS returned a non-JSON response");
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function banner(n) {
  const el = $("#session-banner");
  if (!el) return;
  const count = Number(sessionStorage.getItem("cmsUpdated") || "0") + (n || 0);
  sessionStorage.setItem("cmsUpdated", String(count));
  if (count > 0) {
    el.classList.remove("hidden");
    el.textContent = `${count} articles updated this session — remember to commit, push, and deploy.`;
  }
}

function showBanner() {
  banner(0);
}

function bindDrop(zone, input, onFiles) {
  if (!zone || !input) return;
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    onFiles(e.dataTransfer.files);
  });
  input.addEventListener("change", () => onFiles(input.files));
}

function counter(text, min, max) {
  const n = (text || "").length;
  const ok = n >= min && n <= max;
  return `<span class="counter ${ok ? "ok" : "bad"}">${n}/${min}–${max}</span>`;
}

function renderMissing(validation, id) {
  const missing = validation?.missing || [];
  const checklist = validation?.checklist || [];
  const incomplete = checklist.filter((c) => !c.valid).length;
  const missingTitle =
    missing.length === 0 ? "All required fields present" : `Missing Fields (${missing.length})`;
  return `
    <details class="panel">
      <summary>${missingTitle}</summary>
      ${
        missing.length
          ? `<ul>${missing.map((m) => `<li class="bad">${m.field}: ${m.message}</li>`).join("")}</ul>`
          : `<p class="ok">All required fields present</p>`
      }
    </details>
    <details class="panel">
      <summary>Field Checklist (${incomplete} incomplete)</summary>
      <ul>
        ${checklist
          .map(
            (c) =>
              `<li class="${c.valid ? "ok" : "bad"}">${c.valid ? "✓" : "✗"} ${c.field}: ${c.message}</li>`
          )
          .join("")}
      </ul>
    </details>
    ${
      (validation?.warnings || []).length
        ? `<ul>${validation.warnings.map((w) => `<li class="warn">${w.message}</li>`).join("")}</ul>`
        : ""
    }
  `;
}

function repeatable(name, rows, fields) {
  const list = rows && rows.length ? rows : [{ label: "", url: "" }];
  return `<div data-repeat="${name}">${list
    .map(
      (row, i) => `
      <div class="row" data-repeat-row>
        ${fields
          .map(
            (f) =>
              `<input data-k="${f}" placeholder="${f}" value="${String(row[f] || "").replace(/"/g, "&quot;")}" />`
          )
          .join("")}
        <button type="button" data-del>×</button>
      </div>`
    )
    .join("")}
    <button type="button" data-add>Add ${name}</button>
  </div>`;
}

function collectRepeat(name, fields) {
  return $$(`[data-repeat="${name}"] [data-repeat-row]`).map((row) => {
    const obj = {};
    fields.forEach((f) => {
      obj[f] = $("[data-k='" + f + "']", row)?.value.trim() || "";
    });
    return obj;
  }).filter((row) => fields.some((f) => row[f]));
}

function bindRepeat() {
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    const del = e.target.closest("[data-del]");
    if (add) {
      const wrap = add.closest("[data-repeat]");
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.repeatRow = "1";
      const keys = $$("[data-k]", wrap).map((el) => el.dataset.k);
      const unique = [...new Set(keys)];
      row.innerHTML =
        unique.map((k) => `<input data-k="${k}" placeholder="${k}" />`).join("") +
        `<button type="button" data-del>×</button>`;
      wrap.insertBefore(row, add);
    }
    if (del) del.closest("[data-repeat-row]")?.remove();
  });
}

let teamList = [];
let singleState = {
  data: null,
  body: "",
  stagingId: null,
  filename: "",
  isEdit: false,
};
let batchRows = [];
let batchFallbackHero = null;
let receipts = [];

async function loadTeamSelect(sel) {
  const data = await api("/api/team");
  teamList = data.team || [];
  sel.innerHTML =
    `<option value="">Select author</option>` +
    teamList
      .map(
        (t) =>
          `<option value="${t.data.slug || t.slug}">${t.data.name || t.slug}</option>`
      )
      .join("");
}

function renderSingleForm() {
  const data = singleState.data;
  if (!data) return;
  $("#single-form").innerHTML = `
    ${renderMissing(singleState.validation)}
    <label>Title ${counter(data.title, 55, 60)}
      <input id="f-title" value="${esc(data.title)}" />
    </label>
    <label>Description ${counter(data.description, 140, 160)}
      <textarea id="f-description" rows="3">${esc(data.description)}</textarea>
    </label>
    <label>H1 (optional)
      <input id="f-h1" value="${esc(data.h1 || data.title)}" />
    </label>
    <div class="grid-2">
      <label>Slug <input id="f-slug" value="${esc(data.slug)}" /></label>
      <label>Date <input id="f-date" value="${esc(data.date)}" /></label>
      <label>Updated <input id="f-updatedDate" value="${esc(data.updatedDate || data.date)}" /></label>
      <label>Category <input id="f-category" value="${esc(data.category)}" /></label>
    </div>
    <label>Tags (comma) <input id="f-tags" value="${esc((data.tags || []).join(", "))}" /></label>
    <label>imageAlt <input id="f-imageAlt" value="${esc(data.imageAlt)}" /></label>
    <label>Draft <select id="f-draft"><option value="false" ${!data.draft ? "selected" : ""}>published</option><option value="true" ${data.draft ? "selected" : ""}>draft</option></select></label>
    <h2>Internal links</h2>
    ${repeatable("internalLinks", data.internalLinks, ["label", "url"])}
    <h2>External links</h2>
    ${repeatable("externalLinks", data.externalLinks, ["label", "url"])}
    <h2>FAQs</h2>
    ${repeatable("faqs", data.faqs, ["question", "answer"])}
  `;
  $("#single-author").value = data.author || "";
  ["f-title", "f-description"].forEach((id) => {
    $("#" + id)?.addEventListener("input", () => {
      pullSingleForm();
      renderSingleForm();
      refreshSingleGenerate();
    });
  });
  refreshSingleGenerate();
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function pullSingleForm() {
  if (!singleState.data) return;
  const d = singleState.data;
  d.title = $("#f-title")?.value ?? d.title;
  d.description = $("#f-description")?.value ?? d.description;
  d.h1 = $("#f-h1")?.value || undefined;
  d.slug = $("#f-slug")?.value ?? d.slug;
  d.date = $("#f-date")?.value ?? d.date;
  d.updatedDate = $("#f-updatedDate")?.value ?? d.updatedDate;
  d.category = $("#f-category")?.value ?? d.category;
  d.tags = ($("#f-tags")?.value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  d.imageAlt = $("#f-imageAlt")?.value ?? d.imageAlt;
  d.draft = $("#f-draft")?.value === "true";
  d.author = $("#single-author")?.value || null;
  d.internalLinks = collectRepeat("internalLinks", ["label", "url"]);
  d.externalLinks = collectRepeat("externalLinks", ["label", "url"]);
  d.faqs = collectRepeat("faqs", ["question", "answer"]);
}

async function revalidateSingle() {
  pullSingleForm();
  const data = await api("/api/parse", {
    method: "POST",
    body: {
      markdown:
        "---\n" +
        "title: x\n---\n",
      isEdit: singleState.isEdit,
      stagedHero: Boolean(singleState.stagingId),
    },
  }).catch(() => null);
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      markdown: matterish(singleState.data, singleState.body),
      isEdit: singleState.isEdit,
      stagedHero: Boolean(singleState.stagingId),
    }),
  });
  const parsed = await res.json();
  singleState.validation = parsed.validation;
}

function matterish(data, body) {
  return (
    "---\n" +
    Object.entries(data)
      .map(([k, v]) => {
        if (v == null) return `${k}: null`;
        if (Array.isArray(v)) return `${k}: []`;
        return `${k}: ${JSON.stringify(v)}`;
      })
      .join("\n") +
    "\n---\n" +
    body
  );
}

function refreshSingleGenerate() {
  const missing = singleState.validation?.missing?.length;
  const btn = $("#single-generate");
  if (btn) btn.disabled = !singleState.data || missing > 0 || !singleState.stagingId;
}

async function parseSingleFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const parsed = await api("/api/parse", { method: "POST", body: fd });
  parsed.validation = (
    await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown: file,
      }),
    }).then((r) => r.json()).catch(() => parsed)
  ).validation || parsed.validation;
  singleState.data = parsed.data;
  singleState.body = parsed.body;
  singleState.filename = parsed.filename;
  singleState.validation = parsed.validation;
  renderSingleForm();
}

async function parseSingleFromFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const parsed = await api("/api/parse", { method: "POST", body: fd });
  singleState.data = parsed.data;
  singleState.body = parsed.body;
  singleState.filename = parsed.filename;
  singleState.isEdit = false;
  const re = await api("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      markdown: await file.text(),
      stagedHero: Boolean(singleState.stagingId),
      isEdit: false,
    }),
  });
  singleState.validation = re.validation;
  renderSingleForm();
}

function symbol(color, title) {
  const ch = color === "green" ? "●" : color === "orange" ? "●" : color === "red" ? "●" : "○";
  const cls =
    color === "green" ? "ok" : color === "orange" ? "warn" : color === "red" ? "bad" : "gray";
  return `<span class="symbol ${cls}" title="${title}">${ch}</span>`;
}

async function initArticles() {
  showBanner();
  const data = await api("/api/articles");
  $("#article-list").innerHTML = (data.articles || [])
    .map(
      (a) => `
      <div class="card">
        <strong>${esc(a.title)}</strong>
        <div class="muted">${esc(a.slug)} · draft: ${a.draft ? "true" : "false"}</div>
        <div class="row">
          <a href="/add-article.html?slug=${encodeURIComponent(a.slug)}" target="_blank">Edit</a>
          <button data-unpub="${esc(a.slug)}">${a.draft ? "Publish" : "Unpublish"}</button>
          <button data-del-article="${esc(a.slug)}">Delete</button>
        </div>
      </div>`
    )
    .join("");
  $$("[data-unpub]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const slug = btn.getAttribute("data-unpub");
      const row = data.articles.find((a) => a.slug === slug);
      await api("/api/articles/" + slug, {
        method: "PATCH",
        body: { draft: !row.draft },
      });
      banner(1);
      initArticles();
    });
  });
  $$("[data-del-article]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this article?")) return;
      await api("/api/articles/" + btn.getAttribute("data-del-article"), {
        method: "DELETE",
      });
      banner(1);
      initArticles();
    });
  });
}

async function initAdd() {
  bindRepeat();
  await loadTeamSelect($("#single-author"));
  await loadTeamSelect($("#batch-author"));
  const params = new URLSearchParams(location.search);
  const editSlug = params.get("slug");
  if (editSlug) {
    const row = await api("/api/articles/" + editSlug);
    singleState.data = row.article;
    singleState.body = row.article.body;
    singleState.isEdit = true;
    const re = await api("/api/parse", {
      method: "POST",
      body: {
        markdown: await (await fetch("/api/articles/" + editSlug)).json().then(() => {
          return "";
        }),
      },
    }).catch(() => null);
    const parsed = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown: matterish(singleState.data, singleState.body),
        stagedHero: false,
        isEdit: true,
      }),
    }).then((r) => r.json());
    singleState.validation = parsed.validation;
    renderSingleForm();
  }

  $("#mode-single").addEventListener("click", () => {
    $("#single-panel").classList.remove("hidden");
    $("#batch-panel").classList.add("hidden");
    $("#mode-single").classList.add("primary");
    $("#mode-batch").classList.remove("primary");
  });
  $("#mode-batch").addEventListener("click", () => {
    $("#batch-panel").classList.remove("hidden");
    $("#single-panel").classList.add("hidden");
    $("#mode-batch").classList.add("primary");
    $("#mode-single").classList.remove("primary");
  });

  bindDrop($("#single-drop"), $("#single-file"), async (files) => {
    const file = files[0];
    if (!file) return;
    await parseSingleFromFile(file);
  });
  bindDrop($("#single-hero-drop"), $("#single-hero"), async (files) => {
    const file = files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const up = await api("/api/upload-image", { method: "POST", body: fd });
    singleState.stagingId = up.stagingId;
    $("#single-hero-status").textContent = "Hero staged: " + up.name;
    if (singleState.data) {
      const parsed = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown: matterish(singleState.data, singleState.body),
          stagedHero: true,
          isEdit: singleState.isEdit,
        }),
      }).then((r) => r.json());
      singleState.validation = parsed.validation;
      renderSingleForm();
    }
  });
  $("#single-author").addEventListener("change", async () => {
    if (!singleState.data) return;
    singleState.data.author = $("#single-author").value || null;
    const parsed = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown: matterish(singleState.data, singleState.body),
        stagedHero: Boolean(singleState.stagingId),
        isEdit: singleState.isEdit,
      }),
    }).then((r) => r.json());
    singleState.validation = parsed.validation;
    renderSingleForm();
  });
  $("#single-generate").addEventListener("click", async () => {
    const status = $("#single-status");
    try {
      status.textContent = "Generating…";
      pullSingleForm();
      await api("/api/articles", {
        method: "POST",
        body: {
          data: singleState.data,
          body: singleState.body,
          stagingId: singleState.stagingId,
          isEdit: singleState.isEdit,
        },
      });
      status.textContent = "Wrote " + singleState.data.slug;
      banner(1);
    } catch (err) {
      status.textContent = err.message;
    }
  });

  bindDrop($("#batch-drop"), $("#batch-files"), async (files) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    const parsed = await api("/api/parse-batch", { method: "POST", body: fd });
    batchRows = parsed.rows || [];
    renderBatch();
  });
  bindDrop($("#batch-hero-drop"), $("#batch-hero"), async (files) => {
    const file = files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const up = await api("/api/upload-image", { method: "POST", body: fd });
    batchFallbackHero = up.stagingId;
  });
  $("#apply-author").addEventListener("click", () => {
    const author = $("#batch-author").value;
    batchRows.forEach((row) => {
      row.data.author = author || null;
    });
    revalidateBatch();
  });
  $("#apply-hero").addEventListener("click", () => {
    batchRows.forEach((row) => {
      if (!row.stagedHeroId) row.stagedHeroId = batchFallbackHero;
    });
    revalidateBatch();
  });
  $("#batch-generate").addEventListener("click", async () => {
    const progress = $("#batch-progress");
    const items = batchRows.map((row) => ({
      data: row.data,
      body: row.body,
      stagingId: row.stagedHeroId,
    }));
    progress.textContent = "Starting…";
    const results = [];
    for (let i = 0; i < items.length; i += 1) {
      progress.textContent = `Generating ${i + 1} of ${items.length}: ${items[i].data.slug}`;
      batchRows[i].status = "pending";
      renderBatch();
      try {
        await api("/api/articles", {
          method: "POST",
          body: { ...items[i], skipLlms: i < items.length - 1 },
        });
        batchRows[i].status = "done";
      } catch (err) {
        batchRows[i].status = "failed";
        batchRows[i].error = err.message;
      }
      renderBatch();
    }
    if (!batchRows.some((r) => r.status === "done")) {
      /* llms already skipped */
    } else {
      banner(batchRows.filter((r) => r.status === "done").length);
    }
    progress.textContent = "Batch finished";
    await api("/api/llms", { method: "POST", body: {} });
  });
}

async function revalidateBatch() {
  for (const row of batchRows) {
    const parsed = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown: matterish(row.data, row.body),
        stagedHero: Boolean(row.stagedHeroId),
      }),
    }).then((r) => r.json());
    row.validation = parsed.validation;
    row.data.author = row.data.author;
  }
  renderBatch();
}

function renderBatch() {
  const el = $("#batch-rows");
  el.innerHTML = batchRows
    .map((row, i) => {
      const st =
        row.status === "done"
          ? `<span class="ok">✓ done</span>`
          : row.status === "failed"
            ? `<span class="bad">✗ ${esc(row.error || "failed")}</span>`
            : row.status === "pending"
              ? "pending"
              : "";
      return `<div class="card">
        <strong>${esc(row.filename || row.slug)}</strong> ${st}
        <label>Author override
          <select data-row-author="${i}">
            <option value="">(batch author)</option>
            ${teamList
              .map(
                (t) =>
                  `<option value="${t.data.slug || t.slug}" ${
                    row.data.author === (t.data.slug || t.slug) ? "selected" : ""
                  }>${t.data.name}</option>`
              )
              .join("")}
          </select>
        </label>
        ${renderMissing(row.validation)}
      </div>`;
    })
    .join("");
  $$("[data-row-author]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const i = Number(sel.getAttribute("data-row-author"));
      batchRows[i].data.author = sel.value || batchRows[i].data.author;
      revalidateBatch();
    });
  });
  const ready = batchRows.length > 0 && batchRows.every((r) => (r.validation?.missing || []).length === 0);
  $("#batch-generate").disabled = !ready;
}

async function initHealth() {
  showBanner();
  const scans = JSON.parse(sessionStorage.getItem("healthScans") || "{}");
  async function refresh() {
    const data = await api("/api/health");
    $("#health-list").innerHTML = (data.articles || [])
      .map((a) => {
        const s = scans[a.slug] || {};
        return `<details class="card">
          <summary>
            ${esc(a.title)}
            ${symbol(a.links, "Links")}
            ${symbol(s.meta || "gray", "Meta")}
            ${symbol(s.schema || "gray", "Schema")}
            ${symbol(s.sitemap || "gray", "Sitemap")}
            ${symbol(s.speed || "gray", "Speed")}
          </summary>
          <section>
            <h2>Links</h2>
            <p>Status: ${a.links}. External: ${a.externalCount}. Missing internal: ${a.missingInternal.length}</p>
            <button data-connect="${esc(a.slug)}">Connect All Internal Links</button>
            <button data-propose="${esc(a.slug)}">Add External Links</button>
          </section>
          <section>
            <h2>Meta</h2>
            <button data-scan-meta="${esc(a.slug)}">Scan</button>
            <pre id="meta-${esc(a.slug)}"></pre>
          </section>
          <section>
            <h2>Schema</h2>
            <button data-scan-schema="${esc(a.slug)}">Scan</button>
            <pre id="schema-${esc(a.slug)}"></pre>
          </section>
          <section>
            <h2>Sitemap</h2>
            <button data-scan-sitemap="${esc(a.slug)}">Scan</button>
            <pre id="sitemap-${esc(a.slug)}"></pre>
          </section>
          <section>
            <h2>Speed</h2>
            <button data-scan-speed="${esc(a.slug)}">Scan / Rescan</button>
            <pre id="speed-${esc(a.slug)}"></pre>
          </section>
        </details>`;
      })
      .join("");
    bindHealth(scans, refresh);
  }
  await refresh();
  $("#connect-all").addEventListener("click", async () => {
    $("#health-progress").textContent = "Connecting…";
    try {
      const result = await api("/api/health/connect-all", { method: "POST", body: {} });
      $("#health-progress").textContent = `Connected ${result.results.length} articles`;
      banner(result.results.filter((r) => r.added?.length).length);
      await refresh();
    } catch (err) {
      $("#health-progress").textContent = err.message;
    }
  });
  $("#propose-all").addEventListener("click", async () => {
    $("#health-progress").textContent = "Searching…";
    try {
      const result = await api("/api/health/propose-all", { method: "POST", body: {} });
      renderPropose(result);
      if (result.skipped?.length) {
        $("#health-progress").textContent = result.skipped.join(" · ");
      } else {
        $("#health-progress").textContent = "Review candidates below";
      }
    } catch (err) {
      $("#health-progress").textContent = err.message;
    }
  });
  $("#speed-test").addEventListener("click", async () => {
    const url = $("#speed-url").value.trim();
    $("#speed-result").textContent = "Scanning…";
    try {
      const result = await api("/api/health/scan-speed", { method: "POST", body: { url } });
      $("#speed-result").textContent = JSON.stringify({ state: result.state, result: result.result }, null, 2);
    } catch (err) {
      $("#speed-result").textContent = err.message;
    }
  });
}

function bindHealth(scans, refresh) {
  $$("[data-connect]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api("/api/health/connect", {
        method: "POST",
        body: { slug: btn.getAttribute("data-connect") },
      });
      banner(1);
      refresh();
    });
  });
  $$("[data-propose]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const slug = btn.getAttribute("data-propose");
      const result = await api("/api/health/propose-external", {
        method: "POST",
        body: { slug },
      });
      renderPropose({
        proposals: [{ slug, title: slug, candidates: result.candidates }],
        skipped: result.skipped,
      });
    });
  });
  $$("[data-scan-meta]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const slug = btn.getAttribute("data-scan-meta");
      const r = await api("/api/health/scan-meta", { method: "POST", body: { slug } });
      $("#meta-" + slug).textContent = JSON.stringify(r.result, null, 2);
      scans[slug] = scans[slug] || {};
      scans[slug].meta = r.result.ok ? "green" : "red";
      sessionStorage.setItem("healthScans", JSON.stringify(scans));
      refresh();
    })
  );
  $$("[data-scan-schema]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const slug = btn.getAttribute("data-scan-schema");
      const r = await api("/api/health/scan-schema", { method: "POST", body: { slug } });
      $("#schema-" + slug).textContent = JSON.stringify(r.result, null, 2);
      scans[slug] = scans[slug] || {};
      scans[slug].schema = r.result.ok ? "green" : r.result.scanned ? "red" : "gray";
      sessionStorage.setItem("healthScans", JSON.stringify(scans));
      refresh();
    })
  );
  $$("[data-scan-sitemap]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const slug = btn.getAttribute("data-scan-sitemap");
      const r = await api("/api/health/scan-sitemap", { method: "POST", body: { slug } });
      $("#sitemap-" + slug).textContent = JSON.stringify(r.result, null, 2);
      scans[slug] = scans[slug] || {};
      scans[slug].sitemap = r.result.ok ? "green" : r.result.scanned ? "red" : "gray";
      sessionStorage.setItem("healthScans", JSON.stringify(scans));
      refresh();
    })
  );
  $$("[data-scan-speed]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const slug = btn.getAttribute("data-scan-speed");
      $("#speed-" + slug).textContent = "Scanning…";
      const r = await api("/api/health/scan-speed", { method: "POST", body: { slug } });
      $("#speed-" + slug).textContent = JSON.stringify({ state: r.state, result: r.result }, null, 2);
      scans[slug] = scans[slug] || {};
      scans[slug].speed =
        r.state.state === "success" ? "green" : r.state.state === "not_configured" ? "gray" : "red";
      sessionStorage.setItem("healthScans", JSON.stringify(scans));
      refresh();
    })
  );
}

function renderPropose(result) {
  const el = $("#propose-review");
  el.classList.remove("hidden");
  const skipped = (result.skipped || [])
    .map((s) => `<p class="warn">${esc(s)}</p>`)
    .join("");
  el.innerHTML =
    skipped +
    (result.proposals || [])
      .map(
        (p) => `
      <div class="card" data-prop-slug="${esc(p.slug)}">
        <h2>${esc(p.title)}</h2>
        ${(p.candidates || [])
          .map(
            (c, i) => `
          <label>
            <input type="checkbox" data-cand ${c.confidence === "high" ? "checked" : ""} data-label="${esc(c.label)}" data-url="${esc(c.url)}" />
            ${esc(c.label)} — ${esc(c.url)} (${c.source}, ${c.confidence})
          </label>`
          )
          .join("")}
      </div>`
      )
      .join("") +
    `<button type="button" id="add-selected" class="primary">Add Selected</button>`;
  $("#add-selected")?.addEventListener("click", async () => {
    const cards = $$("[data-prop-slug]");
    let n = 0;
    for (const card of cards) {
      const slug = card.getAttribute("data-prop-slug");
      const links = $$("[data-cand]", card)
        .filter((box) => box.checked)
        .map((box) => ({ label: box.dataset.label, url: box.dataset.url }));
      if (!links.length) continue;
      await api("/api/health/add-external", { method: "POST", body: { slug, links } });
      n += 1;
    }
    banner(n);
    el.innerHTML = `<p class="ok">Added selected links to ${n} articles</p>`;
  });
}

async function initUpdate() {
  showBanner();
  bindDrop($("#update-drop"), $("#update-file"), async (files) => {
    const file = files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const parsed = await api("/api/updates/parse", { method: "POST", body: fd });
    window.__updateRows = parsed.rows;
    $("#update-rows").innerHTML = parsed.rows
      .map((row, i) => {
        if (!row.matched) {
          return `<div class="card bad">Unmatched slug: ${esc(row.slug)}</div>`;
        }
        return `<div class="card">
          <h2>${esc(row.slug)}</h2>
          ${row.markerError ? `<p class="bad">${esc(row.markerError)}</p>` : ""}
          <div class="grid-2">
            <div><h3>Current</h3><p>${esc(row.currentParagraph)}</p></div>
            <div><h3>Proposed</h3><p>${esc(row.newParagraph)}</p></div>
          </div>
          ${(row.newSources || [])
            .map(
              (s, si) =>
                `<label><input type="checkbox" checked data-src="${i}-${si}" /> ${esc(s.title || s.label)} — ${esc(s.url)}</label>`
            )
            .join("")}
          <button type="button" data-confirm="${i}">Confirm Update</button>
        </div>`;
      })
      .join("");
    $("#confirm-all").disabled = !parsed.rows.some((r) => r.matched);
    $$("[data-confirm]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const i = Number(btn.getAttribute("data-confirm"));
        await confirmOne(parsed.rows[i], i);
      });
    });
  });
  $("#confirm-all").addEventListener("click", async () => {
    const rows = (window.__updateRows || []).filter((r) => r.matched);
    const items = rows.map((row, i) => ({
      slug: row.slug,
      newParagraph: row.newParagraph,
      newUpdatedDate: row.newUpdatedDate,
      newSources: selectedSources(row, i),
    }));
    const result = await api("/api/updates/confirm-all", { method: "POST", body: { items } });
    receipts = result.receipts || [];
    banner(receipts.length);
    $("#download-receipt").classList.remove("hidden");
  });
  $("#download-receipt").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(receipts, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "article-update-receipt.json";
    a.click();
  });
}

function selectedSources(row, index) {
  return (row.newSources || []).filter((_, si) => {
    const box = document.querySelector(`[data-src="${index}-${si}"]`);
    return !box || box.checked;
  });
}

async function confirmOne(row, index) {
  const result = await api("/api/updates/confirm", {
    method: "POST",
    body: {
      slug: row.slug,
      newParagraph: row.newParagraph,
      newUpdatedDate: row.newUpdatedDate,
      newSources: selectedSources(row, index),
    },
  });
  receipts.push(result.receipt);
  banner(1);
  $("#download-receipt").classList.remove("hidden");
}

async function initTeam() {
  const data = await api("/api/team");
  $("#team-list").innerHTML = (data.team || [])
    .map(
      (t) => `<div class="card"><strong>${esc(t.data.name)}</strong><div class="muted">${esc(t.data.role)} · ${esc(t.data.slug)}</div><p>${esc(t.data.bio)}</p></div>`
    )
    .join("");
  $("#team-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("#team-status");
    try {
      const form = e.target;
      const fd = new FormData();
      const data = {
        name: form.name.value,
        slug: form.slug.value,
        role: form.role.value,
        bio: form.bio.value,
        credentials: form.credentials.value,
        sameAs: form.sameAs.value
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      fd.append("data", JSON.stringify(data));
      if (form.photo.files[0]) fd.append("photo", form.photo.files[0]);
      await api("/api/team", { method: "POST", body: fd });
      status.textContent = "Saved";
      initTeam();
    } catch (err) {
      status.textContent = err.message;
    }
  });
}

async function initDashboard() {
  const data = await api("/api/articles");
  $("#dash-body").innerHTML = (data.articles || [])
    .map(
      (a) => `<tr>
        <td>${esc(a.title)}</td>
        <td>${esc(a.slug)}</td>
        <td>${a.draft ? "true" : "false"}</td>
        <td>${a.internalLinkCount}</td>
        <td>${a.externalLinkCount}</td>
        <td>${a.faqCount}</td>
        <td>${esc(a.updatedDate || a.date)}</td>
      </tr>`
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  const run = {
    articles: initArticles,
    add: initAdd,
    health: initHealth,
    update: initUpdate,
    team: initTeam,
    dashboard: initDashboard,
  }[page];
  if (run) {
    run().catch((err) => {
      const main = document.querySelector("main");
      const p = document.createElement("p");
      p.className = "bad";
      p.textContent = err.message;
      main?.prepend(p);
    });
  }
});
