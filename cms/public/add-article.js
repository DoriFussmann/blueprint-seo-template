import { api } from "/app.js";

const state = {
  mode: "single",
  team: [],
  defaultAuthor: "",
  single: { md: null, hero: null, draft: false, author: "", parse: null },
  batch: { files: [], rows: [], unassigned: [] },
};

const $ = (id) => document.getElementById(id);

function fillAuthors(select, selected) {
  select.innerHTML = state.team.map((t) => `<option value="${t.slug}" ${t.slug === selected ? "selected" : ""}>${t.data.name} (${t.slug})</option>`).join("");
}

async function boot() {
  const session = await api("/api/session");
  const team = await api("/api/team");
  state.team = team.team;
  state.defaultAuthor = session.defaultAuthor;
  state.single.author = session.defaultAuthor;
  fillAuthors($("single-author"), session.defaultAuthor);
  fillAuthors($("batch-author"), session.defaultAuthor);
}

function setMode(mode) {
  state.mode = mode;
  $("single-panel").hidden = mode !== "single";
  $("batch-panel").hidden = mode !== "batch";
  $("mode-single").className = mode === "single" ? "" : "secondary";
  $("mode-batch").className = mode === "batch" ? "" : "secondary";
  refreshGenerate();
}

function missingList(parse) {
  const items = [...(parse?.errors || []), ...(parse?.ok ? [] : [])];
  if (parse && !parse.hasImage && !(parse.data && parse.data.image)) {
    items.push({ field: "image", message: "Hero image required" });
  }
  return items;
}

async function parseSingle() {
  if (!state.single.md) return;
  const fd = new FormData();
  fd.append("files", state.single.md);
  if (state.single.hero) fd.append("files", state.single.hero);
  fd.append("author", $("single-author").value);
  const data = await api("/api/parse", { method: "POST", body: fd });
  state.single.parse = data.rows[0];
  const missing = state.single.parse?.errors || [];
  $("single-count").textContent = String(missing.length);
  $("single-missing").innerHTML = missing.map((e) => `<li class="err">${e.field || ""}: ${e.message}</li>`).join("") || "<li class='ok'>Ready</li>";
  refreshGenerate();
}

function refreshGenerate() {
  if (state.mode === "single") {
    const row = state.single.parse;
    $("generate").disabled = !(row && row.ok && (state.single.hero || row.hasImage));
  } else {
    $("generate").disabled = !(state.batch.rows.length && state.batch.rows.every((r) => r.ok));
  }
}

async function parseBatch() {
  const fd = new FormData();
  for (const f of state.batch.files) fd.append("files", f);
  fd.append("author", $("batch-author").value);
  const data = await api("/api/parse", { method: "POST", body: fd });
  state.batch.rows = data.rows;
  state.batch.unassigned = data.unassigned;
  $("unassigned").innerHTML = data.unassigned.map((u) => `<li>${u.filename} (${u.stem})</li>`).join("") || "<li class='muted'>None</li>";
  $("batch-rows").innerHTML = data.rows.map((row, i) => `
    <div class="row" data-i="${i}">
      <strong>${row.slug}</strong>
      <span class="${row.ok ? "ok" : "err"}">${row.ok ? "valid" : "invalid"}</span>
      ${row.hasImage ? "<span class='ok'>image</span>" : "<span class='warn'>no image</span>"}
      <label>Author override <select class="row-author">${$("batch-author").innerHTML}</select></label>
      <label>Replace image <input type="file" class="row-image" accept=".png,.jpg,.jpeg,.webp" /></label>
      <label><input type="checkbox" class="row-draft" /> save as draft</label>
      <details>
        <summary>Missing fields <span class="badge">${row.errors.length}</span></summary>
        <ul>${row.errors.map((e) => `<li class="err">${e.message}</li>`).join("") || "<li class='ok'>None</li>"}
        ${row.warnings.map((w) => `<li class="warn">${w.message}</li>`).join("")}</ul>
      </details>
    </div>`).join("");
  document.querySelectorAll(".row-author").forEach((el, i) => { el.value = $("batch-author").value; });
  refreshGenerate();
}

$("mode-single").onclick = () => setMode("single");
$("mode-batch").onclick = () => setMode("batch");
$("single-md").onchange = (e) => { state.single.md = e.target.files[0]; parseSingle(); };
$("single-hero").onchange = (e) => { state.single.hero = e.target.files[0]; parseSingle(); };
$("single-author").onchange = parseSingle;
$("batch-md").onchange = (e) => { state.batch.files.push(...e.target.files); parseBatch(); };
$("batch-img").onchange = (e) => { state.batch.files.push(...e.target.files); parseBatch(); };
$("batch-author").onchange = parseBatch;
$("batch-hero-all").onchange = (e) => {
  const file = e.target.files[0];
  if (file) state.batch.files.push(file);
  parseBatch();
};

async function generateOne(files, row, index, total) {
  $("progress").textContent = `Generating ${index} of ${total}: ${row.slug}`;
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  fd.append("rows", JSON.stringify([row]));
  fd.append("author", row.author);
  const data = await api("/api/generate", { method: "POST", body: fd });
  const r = data.results[0];
  $("results").insertAdjacentHTML("beforeend", `<p class="${r.ok ? "ok" : "err"}">${r.ok ? "✓" : "✗"} ${r.slug} ${r.error || ""}</p>`);
}

$("generate").onclick = async () => {
  $("results").innerHTML = "";
  if (state.mode === "single") {
    await generateOne(
      [state.single.md, state.single.hero].filter(Boolean),
      { slug: state.single.parse.slug, author: $("single-author").value, draft: $("single-draft").checked },
      1,
      1,
    );
    $("progress").textContent = "Done";
    return;
  }
  const rowEls = [...document.querySelectorAll("#batch-rows .row")];
  const payload = state.batch.rows.map((row, i) => ({
    slug: row.slug,
    author: rowEls[i].querySelector(".row-author").value,
    draft: rowEls[i].querySelector(".row-draft").checked,
  }));
  const files = [...state.batch.files];
  for (const el of rowEls) {
    const extra = el.querySelector(".row-image").files[0];
    if (extra) files.push(extra);
  }
  for (let i = 0; i < payload.length; i++) {
    try {
      await generateOne(files, payload[i], i + 1, payload.length);
    } catch (err) {
      $("results").insertAdjacentHTML("beforeend", `<p class="err">✗ ${payload[i].slug} ${err.message}</p>`);
    }
  }
  $("progress").textContent = "Done";
};

boot();
