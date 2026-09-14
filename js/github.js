import { Store } from "./store.js";

function guessPagesUrl(username, repo) {
  const isUserSite = repo.toLowerCase() === `${username.toLowerCase()}.github.io`;
  return isUserSite ? `https://${username.toLowerCase()}.github.io/` : `https://${username.toLowerCase()}.github.io/${repo}/`;
}

async function fetchRepos(username) {
  const res = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
    { headers: { Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) {
    if (res.status === 403) throw new Error("GitHub APIのレート制限に達しました。しばらくしてから再試行してください。");
    throw new Error(`GitHub APIエラー: ${res.status}`);
  }
  return res.json();
}

async function syncFromGithub(username) {
  const repos = await fetchRepos(username);
  let created = 0;
  let updated = 0;
  for (const repo of repos) {
    if (repo.fork) continue;
    const existing = Store.listApps().find((a) => a.repoName === repo.name);
    const fields = {
      repoUrl: repo.html_url,
      // GitHub側のdescriptionが空のときは手入力済みの説明を消さない
      description: repo.description || existing?.description || "",
      stars: repo.stargazers_count ?? null,
      updatedAt: repo.pushed_at || repo.updated_at,
      pagesUrl: repo.has_pages ? guessPagesUrl(username, repo.name) : existing?.pagesUrl || "",
    };
    if (!existing || !existing.createdAt) {
      fields.createdAt = repo.created_at;
    }
    const { created: wasCreated } = Store.upsertByRepoName(repo.name, fields);
    if (wasCreated) created += 1;
    else updated += 1;
  }
  return { total: repos.length, created, updated };
}

// GitHub Pagesの死活確認はCORS制約でno-corsのopaqueレスポンスしか取れず、
// 404ページでも「到達」と判定されてしまう。ここではDNS消失やサーバ完全停止など
// 明確な通信失敗だけを「fail」として検出するベストエフォート実装。
async function checkHealth(url, timeoutMs = 6000) {
  if (!url) return "unknown";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store", signal: controller.signal });
    return "ok";
  } catch (e) {
    return "fail";
  } finally {
    clearTimeout(timer);
  }
}

export { syncFromGithub, checkHealth, guessPagesUrl };
