import { Store, STATUS } from "./store.js";
import { syncFromGithub, checkHealth } from "./github.js";

const state = {
  search: "",
  status: "",
  sort: "updated_desc",
  tags: new Set(),
  view: "list",
};

/* ============ toast ============ */
function toast(msg) {
  const c = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  c.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 2400);
}

/* ============ helpers ============ */
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return "-";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function parseTagsInput(str) {
  return (str || "")
    .split(/[,、\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function deriveRepoName(repoUrl) {
  const m = (repoUrl || "").match(/github\.com\/[^/]+\/([^/#?]+)/i);
  return m ? m[1].replace(/\.git$/, "") : "";
}

function faviconFor(app) {
  const url = app.pagesUrl || app.repoUrl;
  if (!url) return "";
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return "";
  }
}

// 手動サムネイルが無ければ、GitHubが自動生成しているリポジトリのOGP画像を流用する
function thumbnailFor(app) {
  if (app.thumbnail) return app.thumbnail;
  const m = (app.repoUrl || "").match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) return "";
  return `https://opengraph.githubassets.com/1/${m[1]}/${m[2].replace(/\.git$/, "")}`;
}

/* ============ filtering / sorting ============ */
function getFilteredApps() {
  let apps = Store.listApps();

  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    apps = apps.filter((a) =>
      [a.name, a.description, a.techStack, ...(a.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }
  if (state.status) {
    apps = apps.filter((a) => a.status === state.status);
  }
  if (state.tags.size) {
    apps = apps.filter((a) => (a.tags || []).some((t) => state.tags.has(t)));
  }

  const sorters = {
    updated_desc: (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
    created_desc: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    created_asc: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    name_asc: (a, b) => a.name.localeCompare(b.name, "ja"),
  };
  apps = [...apps].sort(sorters[state.sort] || sorters.updated_desc);
  apps.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  return apps;
}

/* ============ rendering: summary ============ */
function renderSummary() {
  const all = Store.listApps();
  const el = document.getElementById("summary-bar");
  const counts = { published: 0, developing: 0, planning: 0, stopped: 0 };
  all.forEach((a) => { if (counts[a.status] !== undefined) counts[a.status] += 1; });
  el.innerHTML = `
    <div class="summary-pill"><b>${all.length}</b>合計</div>
    <div class="summary-pill"><b>${counts.published}</b>公開中</div>
    <div class="summary-pill"><b>${counts.developing}</b>開発中</div>
    <div class="summary-pill"><b>${counts.planning}</b>構想中</div>
  `;
}

/* ============ rendering: tag chips ============ */
function renderTagChips() {
  const el = document.getElementById("tag-chips");
  const tags = Store.allTags();
  if (!tags.length) { el.innerHTML = ""; return; }
  el.innerHTML = tags
    .map(
      (t) =>
        `<button type="button" class="chip ${state.tags.has(t) ? "on" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`
    )
    .join("");
  el.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.tag;
      if (state.tags.has(t)) state.tags.delete(t);
      else state.tags.add(t);
      renderAll();
    });
  });
}

/* ============ rendering: list ============ */
function statusBadge(status) {
  return `<span class="badge badge-${status}">${STATUS[status] || status}</span>`;
}

function healthDot(app) {
  const cls = app.healthStatus === "ok" ? "dot-ok" : app.healthStatus === "fail" ? "dot-fail" : "dot-unknown";
  const title = app.healthStatus === "ok" ? `到達確認OK (${fmtDate(app.healthCheckedAt)})`
    : app.healthStatus === "fail" ? `到達できませんでした (${fmtDate(app.healthCheckedAt)})`
    : "未チェック";
  return `<span class="dot ${cls}" title="${title}"></span>`;
}

function renderList() {
  const el = document.getElementById("app-list");
  const apps = getFilteredApps();
  if (!apps.length) {
    el.innerHTML = `<div class="empty">📦<div>まだアプリが登録されていません</div><button class="link-btn" id="empty-add">最初の1件を追加する</button></div>`;
    document.getElementById("empty-add")?.addEventListener("click", () => openEditModal(null));
    return;
  }
  el.innerHTML = apps.map((a) => cardHtml(a)).join("");
  wireCardActions(el);
}

function cardHtml(a) {
  const thumb = thumbnailFor(a);
  const tags = (a.tags || []).map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join(" ");
  return `
  <div class="card" data-id="${a.id}">
    ${thumb ? `<div class="card-thumb"><img src="${escapeHtml(thumb)}" alt="" loading="lazy" onerror="this.remove()"></div>` : ""}
    <div class="card-top">
      <div class="card-title-wrap">
        <div class="card-title-row">
          <button type="button" class="pin-btn ${a.pinned ? "on" : ""}" data-act="pin" aria-label="ピン留め">${a.pinned ? "⭐" : "☆"}</button>
          <div class="card-title">${escapeHtml(a.name || "(無題)")}</div>
        </div>
        ${a.description ? `<div class="card-desc">${escapeHtml(a.description)}</div>` : ""}
      </div>
      ${statusBadge(a.status)}
    </div>
    <div class="card-meta">
      ${healthDot(a)}
      <span class="muted">更新 ${fmtDate(a.updatedAt)}</span>
      ${a.stars != null ? `<span class="muted">★${a.stars}</span>` : ""}
      ${a.techStack ? `<span class="tag">${escapeHtml(a.techStack)}</span>` : ""}
      ${tags}
    </div>
    <div class="card-actions">
      ${a.pagesUrl ? `<a class="btn-mini" href="${escapeHtml(a.pagesUrl)}" target="_blank" rel="noopener">開く</a>` : ""}
      ${a.repoUrl ? `<a class="btn-mini" href="${escapeHtml(a.repoUrl)}" target="_blank" rel="noopener">リポジトリ</a>` : ""}
      <button type="button" class="btn-mini" data-act="health">疎通確認</button>
      <button type="button" class="btn-mini" data-act="edit">編集</button>
      <button type="button" class="btn-mini danger" data-act="delete">削除</button>
    </div>
  </div>`;
}

function wireCardActions(container) {
  container.querySelectorAll(".card").forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('[data-act="pin"]')?.addEventListener("click", () => {
      const app = Store.getApp(id);
      Store.updateApp(id, { pinned: !app.pinned });
      renderAll();
    });
    card.querySelector('[data-act="edit"]')?.addEventListener("click", () => openEditModal(Store.getApp(id)));
    card.querySelector('[data-act="delete"]')?.addEventListener("click", () => {
      if (confirm("このアプリの記録を削除しますか？")) {
        Store.deleteApp(id);
        toast("削除しました");
        renderAll();
      }
    });
    card.querySelector('[data-act="health"]')?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const app = Store.getApp(id);
      if (!app.pagesUrl) { toast("公開URLが未設定です"); return; }
      btn.textContent = "確認中…";
      btn.disabled = true;
      const result = await checkHealth(app.pagesUrl);
      Store.updateApp(id, { healthStatus: result, healthCheckedAt: new Date().toISOString() });
      renderAll();
      toast(result === "ok" ? "到達できました" : "到達できませんでした");
    });
  });
}

/* ============ rendering: timeline ============ */
function renderTimeline() {
  const el = document.getElementById("app-timeline");
  const apps = [...getFilteredApps()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (!apps.length) {
    el.innerHTML = `<div class="empty">📦<div>まだアプリが登録されていません</div></div>`;
    return;
  }
  let lastMonth = "";
  const rows = apps.map((a) => {
    const d = new Date(a.createdAt);
    const monthKey = isNaN(d) ? "不明" : `${d.getFullYear()}年${d.getMonth() + 1}月`;
    let monthHeader = "";
    if (monthKey !== lastMonth) {
      monthHeader = `<div class="tl-month">${monthKey}</div>`;
      lastMonth = monthKey;
    }
    return `${monthHeader}
    <div class="tl-item">
      <div class="tl-dot2"></div>
      <div class="tl-body">
        <div class="tl-date">${fmtDate(a.createdAt)} ${statusBadge(a.status)}</div>
        <div class="tl-name">${escapeHtml(a.name || "(無題)")}</div>
        ${a.description ? `<div class="tl-desc">${escapeHtml(a.description)}</div>` : ""}
      </div>
    </div>`;
  });
  el.innerHTML = rows.join("");
}

/* ============ rendering: group (タグ重複の可視化) ============ */
function renderGroup() {
  const el = document.getElementById("app-group");
  const apps = getFilteredApps();
  if (!apps.length) {
    el.innerHTML = `<div class="empty">📦<div>まだアプリが登録されていません</div></div>`;
    return;
  }
  const byTag = new Map();
  const untagged = [];
  apps.forEach((a) => {
    if (!a.tags || !a.tags.length) { untagged.push(a); return; }
    a.tags.forEach((t) => {
      if (!byTag.has(t)) byTag.set(t, []);
      byTag.get(t).push(a);
    });
  });
  const groups = [...byTag.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "ja"));

  const blockHtml = (title, items, isOverlap) => `
    <div class="group-block ${isOverlap ? "overlap" : ""}">
      <div class="group-head">
        <h3>#${escapeHtml(title)}</h3>
        ${isOverlap ? `<span class="group-warn">${items.length}件 重複の可能性</span>` : `<span class="muted">${items.length}件</span>`}
      </div>
      <ul class="group-items">
        ${items.map((a) => `<li>${statusBadge(a.status)} ${escapeHtml(a.name || "(無題)")}</li>`).join("")}
      </ul>
    </div>`;

  const html = groups.map(([tag, items]) => blockHtml(tag, items, items.length >= 2)).join("");
  const untaggedHtml = untagged.length ? blockHtml("タグなし", untagged, false) : "";
  el.innerHTML = html + untaggedHtml || `<div class="empty">📦<div>タグが登録されていません</div></div>`;
}

/* ============ render all ============ */
function renderAll() {
  renderSummary();
  renderTagChips();
  const listEl = document.getElementById("app-list");
  const timelineEl = document.getElementById("app-timeline");
  const groupEl = document.getElementById("app-group");
  listEl.hidden = state.view !== "list";
  timelineEl.hidden = state.view !== "timeline";
  groupEl.hidden = state.view !== "group";
  if (state.view === "list") renderList();
  else if (state.view === "timeline") renderTimeline();
  else renderGroup();
}

/* ============ modal: add/edit ============ */
function openEditModal(app) {
  const isEdit = !!app;
  const root = document.getElementById("modal-root");
  const a = app || { status: "published", tags: [] };
  root.innerHTML = `
  <div class="modal-backdrop" id="backdrop">
    <div class="modal">
      <h2>${isEdit ? "アプリを編集" : "アプリを追加"}</h2>
      <form class="form" id="app-form">
        <label>名前
          <input name="name" required value="${escapeHtml(a.name || "")}">
        </label>
        <label>説明
          <textarea name="description" rows="2">${escapeHtml(a.description || "")}</textarea>
        </label>
        <label>公開URL（GitHub Pages）
          <input name="pagesUrl" type="url" placeholder="https://xxxx.github.io/xxxx/" value="${escapeHtml(a.pagesUrl || "")}">
        </label>
        <label>リポジトリURL
          <input name="repoUrl" type="url" placeholder="https://github.com/xxxx/xxxx" value="${escapeHtml(a.repoUrl || "")}">
        </label>
        <label>サムネイル画像URL（空欄ならリポジトリのOGP画像を自動使用）
          <input name="thumbnail" type="url" placeholder="https://..." value="${escapeHtml(a.thumbnail || "")}">
        </label>
        <label>状態
          <select name="status">
            ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${a.status === k ? "selected" : ""}>${v}</option>`).join("")}
          </select>
        </label>
        <label>技術スタック
          <input name="techStack" placeholder="vanilla JS / PWA など" value="${escapeHtml(a.techStack || "")}">
        </label>
        <label>タグ（カンマ区切り）
          <input name="tags" placeholder="PWA, ツール, 実験" value="${escapeHtml((a.tags || []).join(", "))}">
        </label>
        <label>作成日
          <input name="createdAt" type="date" value="${a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : ""}">
        </label>
        <label>メモ・次にやりたいこと
          <textarea name="notes" rows="3">${escapeHtml(a.notes || "")}</textarea>
        </label>
        <div class="form-actions">
          <button type="button" class="btn-ghost" id="cancel-btn">キャンセル</button>
          <button type="submit" class="btn-primary">${isEdit ? "保存" : "追加"}</button>
        </div>
      </form>
    </div>
  </div>`;

  const close = () => { root.innerHTML = ""; };
  document.getElementById("backdrop").addEventListener("click", (e) => { if (e.target.id === "backdrop") close(); });
  document.getElementById("cancel-btn").addEventListener("click", close);
  document.getElementById("app-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const repoUrl = fd.get("repoUrl").trim();
    const fields = {
      name: fd.get("name").trim(),
      description: fd.get("description").trim(),
      pagesUrl: fd.get("pagesUrl").trim(),
      repoUrl,
      thumbnail: fd.get("thumbnail").trim(),
      repoName: deriveRepoName(repoUrl),
      status: fd.get("status"),
      techStack: fd.get("techStack").trim(),
      tags: parseTagsInput(fd.get("tags")),
      notes: fd.get("notes").trim(),
      createdAt: fd.get("createdAt") ? new Date(fd.get("createdAt")).toISOString() : new Date().toISOString(),
    };
    if (isEdit) {
      Store.updateApp(a.id, fields);
      toast("保存しました");
    } else {
      Store.addApp({ ...fields, source: "manual" });
      toast("追加しました");
    }
    close();
    renderAll();
  });
}

/* ============ modal: settings ============ */
function openSettingsModal() {
  const root = document.getElementById("modal-root");
  const settings = Store.getSettings();
  root.innerHTML = `
  <div class="modal-backdrop" id="backdrop">
    <div class="modal">
      <h2>設定</h2>

      <div class="set">
        <h3>GitHub連携</h3>
        <label>GitHubユーザー名
          <input id="gh-username" value="${escapeHtml(settings.githubUsername || "")}">
        </label>
        <div class="hint">公開リポジトリを取得し、Pagesが有効なものを自動登録・更新します（フォークは除外）。</div>
        <div class="set-actions">
          <button type="button" class="btn-primary" id="save-gh-username">保存</button>
        </div>
      </div>

      <div class="set">
        <h3>エクスポート</h3>
        <div class="set-actions">
          <button type="button" class="btn-ghost" id="export-json">JSONをダウンロード</button>
          <button type="button" class="btn-ghost" id="export-embed">埋め込みHTMLをコピー</button>
        </div>
        <div id="embed-preview"></div>
      </div>

      <div class="set">
        <h3>インポート（バックアップの復元）</h3>
        <div class="hint">「JSONをダウンロード」で書き出したファイルを読み込みます。データは端末内のみの保存なので、ブラウザのデータを消す前に定期的にバックアップしておくと安心です。</div>
        <input type="file" id="import-file" accept="application/json" class="hint" style="display:block; margin-bottom:8px;">
        <div class="set-actions">
          <button type="button" class="btn-ghost" id="import-merge">追加・更新で読み込む</button>
          <button type="button" class="btn-danger" id="import-replace">全部置き換えて読み込む</button>
        </div>
      </div>

      <div class="form-actions" style="margin-top:16px;">
        <button type="button" class="btn-ghost" id="close-settings">閉じる</button>
      </div>
    </div>
  </div>`;

  const close = () => { root.innerHTML = ""; };
  document.getElementById("backdrop").addEventListener("click", (e) => { if (e.target.id === "backdrop") close(); });
  document.getElementById("close-settings").addEventListener("click", close);

  document.getElementById("save-gh-username").addEventListener("click", () => {
    const v = document.getElementById("gh-username").value.trim();
    if (!v) return;
    Store.saveSettings({ githubUsername: v });
    toast("保存しました");
  });

  document.getElementById("export-json").addEventListener("click", () => {
    const blob = new Blob([Store.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "portfolio-apps.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("export-embed").addEventListener("click", async () => {
    const html = Store.exportPublishedEmbed();
    try {
      await navigator.clipboard.writeText(html);
      toast("クリップボードにコピーしました");
    } catch {
      toast("コピーに失敗しました。下のボックスから手動でコピーしてください");
    }
    document.getElementById("embed-preview").innerHTML = `<div class="code-box">${escapeHtml(html)}</div>`;
  });

  async function readImportFile() {
    const input = document.getElementById("import-file");
    const file = input.files[0];
    if (!file) { toast("ファイルを選択してください"); return null; }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : parsed.apps;
    } catch {
      toast("JSONの読み込みに失敗しました");
      return null;
    }
  }

  document.getElementById("import-merge").addEventListener("click", async () => {
    const apps = await readImportFile();
    if (!apps) return;
    const count = Store.importApps(apps, "merge");
    toast(`読み込みました（合計${count}件）`);
    close();
    renderAll();
  });

  document.getElementById("import-replace").addEventListener("click", async () => {
    const apps = await readImportFile();
    if (!apps) return;
    if (!confirm("現在の一覧を全部消して、読み込んだ内容に置き換えます。よろしいですか？")) return;
    const count = Store.importApps(apps, "replace");
    toast(`置き換えました（合計${count}件）`);
    close();
    renderAll();
  });
}

/* ============ github sync ============ */
async function handleSync() {
  const btn = document.getElementById("sync-btn");
  const settings = Store.getSettings();
  if (!settings.githubUsername) {
    toast("設定でGitHubユーザー名を入力してください");
    openSettingsModal();
    return;
  }
  btn.textContent = "…";
  btn.disabled = true;
  try {
    const result = await syncFromGithub(settings.githubUsername);
    toast(`同期完了: 新規${result.created}件 / 更新${result.updated}件`);
    renderAll();
  } catch (e) {
    toast(e.message || "同期に失敗しました");
  } finally {
    btn.textContent = "⟳";
    btn.disabled = false;
  }
}

/* ============ bulk health check ============ */
async function handleBulkHealth() {
  const btn = document.getElementById("health-all-btn");
  const targets = Store.listApps().filter((a) => a.pagesUrl);
  if (!targets.length) { toast("公開URLが設定されたアプリがありません"); return; }
  btn.disabled = true;
  btn.textContent = "…";
  let ok = 0;
  let fail = 0;
  const CONCURRENCY = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const app = targets[cursor++];
      const result = await checkHealth(app.pagesUrl);
      Store.updateApp(app.id, { healthStatus: result, healthCheckedAt: new Date().toISOString() });
      if (result === "ok") ok += 1; else fail += 1;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
  btn.disabled = false;
  btn.textContent = "📶";
  renderAll();
  toast(`疎通確認完了: 到達${ok}件 / 失敗${fail}件`);
}

/* ============ init ============ */
function init() {
  document.getElementById("search-input").addEventListener("input", (e) => {
    state.search = e.target.value;
    renderAll();
  });
  document.getElementById("status-filter").addEventListener("change", (e) => {
    state.status = e.target.value;
    renderAll();
  });
  document.getElementById("sort-select").addEventListener("change", (e) => {
    state.sort = e.target.value;
    renderAll();
  });
  document.querySelectorAll('input[name="view"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      state.view = e.target.value;
      renderAll();
    });
  });
  document.getElementById("fab").addEventListener("click", () => openEditModal(null));
  document.getElementById("settings-btn").addEventListener("click", openSettingsModal);
  document.getElementById("sync-btn").addEventListener("click", handleSync);
  document.getElementById("health-all-btn").addEventListener("click", handleBulkHealth);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  renderAll();
}

init();
