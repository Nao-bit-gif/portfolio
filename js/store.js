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

// 初回起動時にだけ流し込む、これまでに作った既存アプリの下敷きデータ。
// GitHub同期(js/github.js)は同じrepoNameのdescriptionが空なら上書きしないので、
// ここで書いた説明・タグは同期後も消えない。
const SEED_APPS = [
  {
    name: "作った物管理",
    description: "作ったGitHub Pagesアプリを一覧管理するPWA。GitHub連携で自動同期もできる。",
    pagesUrl: "https://nao-bit-gif.github.io/portfolio/",
    repoUrl: "https://github.com/Nao-bit-gif/portfolio",
    repoName: "portfolio",
    status: "published",
    techStack: "vanilla JS / PWA",
    tags: ["PWA", "ツール"],
    createdAt: "2026-09-14T00:00:00.000Z",
  },
  {
    name: "スケジュール（持ち物リマインド）",
    description: "予定ごとに持ち物を登録すると、通知やiPhoneカレンダー連携で教えてくれるカレンダーPWA。",
    pagesUrl: "https://nao-bit-gif.github.io/schedule/",
    repoUrl: "https://github.com/Nao-bit-gif/schedule",
    repoName: "schedule",
    status: "published",
    techStack: "vanilla JS / PWA",
    tags: ["PWA", "カレンダー"],
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    name: "株主優待トラッカー",
    description: "ほしい株の購入履歴と株主優待の条件を登録し、保有株数の推移と次の優待までの必要株数を確認できる。",
    pagesUrl: "https://nao-bit-gif.github.io/stocks/",
    repoUrl: "https://github.com/Nao-bit-gif/stocks",
    repoName: "stocks",
    status: "published",
    techStack: "vanilla JS / PWA",
    tags: ["PWA", "株"],
    createdAt: "2026-09-13T00:00:00.000Z",
  },
  {
    name: "サブスク管理",
    description: "サブスクと毎月の積立を登録すると、月額換算・支払い予定・カテゴリ別内訳をまとめて表示するPWA。",
    pagesUrl: "https://nao-bit-gif.github.io/subscription/",
    repoUrl: "https://github.com/Nao-bit-gif/subscription",
    repoName: "subscription",
    status: "published",
    techStack: "vanilla JS / PWA",
    tags: ["PWA", "家計"],
    createdAt: "2026-09-08T00:00:00.000Z",
  },
  {
    name: "デイリートラッカー",
    description: "毎日の習慣を記録すると、叱咤ボイスで応援してくれるトラッカー。",
    pagesUrl: "https://nao-bit-gif.github.io/ouendan/",
    repoUrl: "https://github.com/Nao-bit-gif/ouendan",
    repoName: "ouendan",
    status: "published",
    techStack: "vanilla JS",
    tags: ["習慣"],
    createdAt: "2026-08-20T00:00:00.000Z",
  },
  {
    name: "StudyBuddy",
    description: "みんなで勉強時間を記録するトラッカー。",
    pagesUrl: "",
    repoUrl: "",
    repoName: "",
    status: "developing",
    techStack: "vanilla JS / PWA",
    tags: ["勉強"],
    notes: "まだGitHubにリポジトリを作成・pushしていない（ローカルのみ）。公開するときは他のアプリと同じ手順でrepo作成 + Pages有効化。",
    createdAt: "2026-08-24T00:00:00.000Z",
  },
  {
    name: "名刺サイト",
    description: "名刺",
    pagesUrl: "https://nao-bit-gif.github.io/sagane-naoki/",
    repoUrl: "https://github.com/Nao-bit-gif/sagane-naoki",
    repoName: "sagane-naoki",
    status: "published",
    tags: ["名刺"],
    createdAt: "2026-07-22T00:00:00.000Z",
  },
  {
    name: "willconnect-site",
    description: "株式会社ウィルコネクトのサイト",
    pagesUrl: "https://nao-bit-gif.github.io/willconnect-site/",
    repoUrl: "https://github.com/Nao-bit-gif/willconnect-site",
    repoName: "willconnect-site",
    status: "published",
    tags: ["受託", "HP"],
    createdAt: "2026-07-29T00:00:00.000Z",
  },
  {
    name: "inobit",
    description: "inobit 案件取りに行くためのHP",
    pagesUrl: "https://nao-bit-gif.github.io/inobit/",
    repoUrl: "https://github.com/Nao-bit-gif/inobit",
    repoName: "inobit",
    status: "published",
    tags: ["受託", "HP"],
    createdAt: "2026-08-03T00:00:00.000Z",
  },
  {
    name: "otameshi",
    description: "参考になるサイトのお試し",
    pagesUrl: "",
    repoUrl: "https://github.com/Nao-bit-gif/otameshi",
    repoName: "otameshi",
    status: "stopped",
    tags: ["実験"],
    createdAt: "2026-08-06T00:00:00.000Z",
  },
  {
    name: "ima-meshi-map",
    description: "",
    pagesUrl: "https://nao-bit-gif.github.io/ima-meshi-map/",
    repoUrl: "https://github.com/Nao-bit-gif/ima-meshi-map",
    repoName: "ima-meshi-map",
    status: "published",
    tags: [],
    createdAt: "2026-09-04T00:00:00.000Z",
  },
  {
    name: "株スクリーニング通知ツール",
    description: "日足の値動き（出来高急増・高値ブレイク・ゴールデンクロス・RSI・MACD）を毎日チェックし、条件に合った銘柄をLINEに通知するPythonツール。",
    pagesUrl: "",
    repoUrl: "https://github.com/Nao-bit-gif/stock-screener",
    repoName: "stock-screener",
    status: "developing",
    techStack: "Python / GitHub Actions",
    tags: ["Python", "自動化", "株"],
    createdAt: "2026-09-13T00:00:00.000Z",
  },
  {
    name: "次の電車",
    description: "登録した駅の次の電車を開いた瞬間に表示。タップすると駅までのルートごとの出発目安もわかる。",
    pagesUrl: "https://nao-bit-gif.github.io/train/",
    repoUrl: "https://github.com/Nao-bit-gif/train",
    repoName: "train",
    status: "published",
    techStack: "vanilla JS / PWA",
    tags: ["PWA", "交通"],
    createdAt: "2026-09-16T00:00:00.000Z",
  },
  {
    name: "騰落レシオ",
    description: "騰落レシオの数値表示並びにデータ蓄積。",
    pagesUrl: "",
    repoUrl: "https://github.com/Nao-bit-gif/Touraku-resio",
    repoName: "Touraku-resio",
    status: "developing",
    tags: ["株"],
    createdAt: "2026-09-17T00:00:00.000Z",
  },
];

function blankApp() {
  return {
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
    pinned: false,
    thumbnail: "",
    healthStatus: "unknown",
    healthCheckedAt: null,
  };
}

function buildSeedDB() {
  const db = defaultDB();
  const now = todayISO();
  db.apps = SEED_APPS.map((seed) => ({
    ...blankApp(),
    source: seed.repoName ? "github" : "manual",
    updatedAt: seed.createdAt || now,
    ...seed,
  }));
  return db;
}

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      const seeded = buildSeedDB();
      saveDB(seeded);
      return seeded;
    }
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
    const app = { ...blankApp(), createdAt: now, updatedAt: now, ...fields };
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
      const app = { ...blankApp(), name: repoName, repoName, source: "github", createdAt: now, updatedAt: now, ...fields };
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

  // mode "merge": idまたはrepoNameが一致する既存アプリは更新、なければ追加。
  // mode "replace": 現在の一覧を読み込んだ内容で完全に置き換える。
  importApps(importedApps, mode = "merge") {
    if (!Array.isArray(importedApps)) throw new Error("JSONの形式が不正です（配列ではありません）");
    const db = loadDB();
    const normalize = (imp) => ({ ...blankApp(), createdAt: todayISO(), updatedAt: todayISO(), ...imp, id: imp.id || uid() });

    if (mode === "replace") {
      db.apps = importedApps.map(normalize);
    } else {
      importedApps.forEach((imp) => {
        const idx = db.apps.findIndex((a) => a.id === imp.id || (imp.repoName && a.repoName === imp.repoName));
        if (idx === -1) db.apps.unshift(normalize(imp));
        else db.apps[idx] = { ...db.apps[idx], ...imp };
      });
    }
    saveDB(db);
    return db.apps.length;
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
