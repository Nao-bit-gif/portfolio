const DB_KEY = "portfolio.v1.db";

const STATUS = {
  planning: "構想中",
  developing: "開発中",
  published: "公開中",
  stopped: "メンテ停止",
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayISO() {
  return new Date().toISOString();
}

function defaultDB() {
  return {
    settings: {
      githubUsername: "Nao-bit-gif",
    },
    apps: [],
  };
}

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return defaultDB();
    const parsed = JSON.parse(raw);
    return {
      settings: { ...defaultDB().settings, ...(parsed.settings || {}) },
      apps: Array.isArray(parsed.apps) ? parsed.apps : [],
    };
  } catch (e) {
    console.error("DB読み込み失敗", e);
    return defaultDB();
  }
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

const Store = {
  get() {
    return loadDB();
  },

  getSettings() {
    return loadDB().settings;
  },

  saveSettings(patch) {
    const db = loadDB();
    db.settings = { ...db.settings, ...patch };
    saveDB(db);
    return db.settings;
  },

  listApps() {
    return loadDB().apps;
  },

  getApp(id) {
    return loadDB().apps.find((a) => a.id === id) || null;
  },

  addApp(fields) {
    const db = loadDB();
    const now = todayISO();
    const app = {
      id: uid(),
      name: "",
      description: "",
      pagesUrl: "",
      repoUrl: "",
      repoName: "",
      tags: [],
      status: "published",
      techStack: "",
      notes: "",
      stars: null,
      source: "manual",
      createdAt: now,
      updatedAt: now,
      healthStatus: "unknown",
      healthCheckedAt: null,
      ...fields,
    };
    db.apps.unshift(app);
    saveDB(db);
    return app;
  },

  updateApp(id, patch) {
    const db = loadDB();
    const idx = db.apps.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    db.apps[idx] = { ...db.apps[idx], ...patch, updatedAt: todayISO() };
    saveDB(db);
    return db.apps[idx];
  },

  deleteApp(id) {
    const db = loadDB();
    db.apps = db.apps.filter((a) => a.id !== id);
    saveDB(db);
  },

  upsertByRepoName(repoName, fields) {
    const db = loadDB();
    const idx = db.apps.findIndex((a) => a.repoName === repoName);
    const now = todayISO();
    if (idx === -1) {
      const app = {
        id: uid(),
        name: repoName,
        description: "",
        pagesUrl: "",
        repoUrl: "",
        repoName,
        tags: [],
        status: "published",
        techStack: "",
        notes: "",
        stars: null,
        source: "github",
        createdAt: now,
        updatedAt: now,
        healthStatus: "unknown",
        healthCheckedAt: null,
        ...fields,
      };
      db.apps.unshift(app);
      saveDB(db);
      return { app, created: true };
    }
    db.apps[idx] = { ...db.apps[idx], ...fields };
    saveDB(db);
    return { app: db.apps[idx], created: false };
  },

  allTags() {
    const set = new Set();
    loadDB().apps.forEach((a) => (a.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  },

  exportJSON() {
    return JSON.stringify(loadDB().apps, null, 2);
  },

  exportPublishedEmbed() {
    const apps = loadDB()
      .apps.filter((a) => a.status === "published" && a.pagesUrl)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const items = apps
      .map(
        (a) =>
          `  <li><a href="${a.pagesUrl}" target="_blank" rel="noopener">${a.name}</a>${
            a.description ? ` — ${a.description}` : ""
          }</li>`
      )
      .join("\n");
    return `<ul class="portfolio-list">\n${items}\n</ul>`;
  },
};

export { Store, STATUS };
