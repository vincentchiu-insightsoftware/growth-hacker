import { marked } from "marked@12";

// Railway Function「question-dashboard」的原始碼（AI Token King 專案）。
// 問題總表從 GitHub 即時讀取：推送 02-現況盤點/問題總表.md 到 main 即可更新（快取 CACHE_MS）。
// 「團隊統整」分頁也從 GitHub 讀取 dashboard/team.html（內含該頁的樣式），修改後推送到 main 即可。
const RAW = "https://raw.githubusercontent.com/vincentchiu-insightsoftware/growth-hacker/main/";
const TEAM_URL = RAW + "dashboard/team.html";
const SOURCE_URL =
  "https://raw.githubusercontent.com/vincentchiu-insightsoftware/growth-hacker/main/02-%E7%8F%BE%E6%B3%81%E7%9B%A4%E9%BB%9E/%E5%95%8F%E9%A1%8C%E7%B8%BD%E8%A1%A8.md";
const CACHE_MS = 60_000;

type Cached = { at: number; md: string; fetchedAt: string };
const caches = new Map<string, Cached>();

async function load(url: string): Promise<Cached> {
  const hit = caches.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    const fetchedAt = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
    const fresh = { at: Date.now(), md, fetchedAt };
    caches.set(url, fresh);
    return fresh;
  } catch (e) {
    if (!hit) throw e;
    return hit;
  }
}

function parse(MD: string) {
  const parts = MD.split(/\n(?=## )/);
  const intro = parts[0];
  const sections = parts.slice(1).map((s) => s.replace(/\n+---\s*$/, "").trim());
  const prioSec = sections.find((s) => s.startsWith("## ⭐ 老闆會議")) ?? "";
  const overviewSec = sections.find((s) => s.startsWith("## 總覽")) ?? "";
  const byNum = new Map<number, string>();
  for (const s of sections) {
    const m = s.match(/^## (?:⭐ )?Q(\d+)｜/);
    if (m) byNum.set(Number(m[1]), s);
  }
  const prio = [...prioSec.matchAll(/^\| (\d+) \| ⭐ \*\*Q(\d+) ([^*]+)\*\* \| ([^|]+) \|/gm)].map((m) => ({
    rank: Number(m[1]),
    q: Number(m[2]),
    title: m[3].trim(),
    why: m[4].trim(),
  }));
  return { intro, overviewSec, byNum, prio };
}

function md(s: string) {
  return marked.parse(s, { async: false }) as string;
}
function linkQs(html: string) {
  return html.replace(/<td>(⭐ )?Q(\d+)<\/td>/g, (_m, star, n) => `<td><a href="/all#q${n}">${star ?? ""}Q${n}</a></td>`);
}
function statusClass(s: string) {
  if (s.includes("✅")) return "ok";
  if (s.includes("🔺")) return "draft";
  return "wait";
}
function wrapTables(html: string) {
  return html.replace(/<table>/g, '<div class="tw"><table>').replace(/<\/table>/g, "</table></div>");
}

const CSS = `
:root{--bg:#f7f7f5;--card:#ffffff;--text:#1d1d1f;--muted:#6b6b70;--line:#e3e3e0;--accent:#c2410c;--accent-soft:#fff1e8;--ok:#15803d;--ok-soft:#e8f5ec;--wait:#b45309;--wait-soft:#fdf3e2;--draft:#be123c;--draft-soft:#fde8ec;--info:#1d4ed8;--info-soft:#e8eefc;--code:#f0efec;--new:#c2410c;--new-soft:#fff1e8;--keep:#0f766e;--keep-soft:#e3f4f1;color-scheme:light}
@media (prefers-color-scheme: dark){:root{--bg:#141416;--card:#1d1d20;--text:#ececef;--muted:#a0a0a8;--line:#2e2e33;--accent:#fb923c;--accent-soft:#2a1d14;--ok:#4ade80;--ok-soft:#14261b;--wait:#fbbf24;--wait-soft:#2a2210;--draft:#fb7185;--draft-soft:#2c1419;--info:#93b4fd;--info-soft:#161e33;--code:#26262a;--new:#fb923c;--new-soft:#2a1d14;--keep:#5eead4;--keep-soft:#0f2522;color-scheme:dark}}
*{box-sizing:border-box}
html{scroll-padding-top:72px}
body{margin:0;background:var(--bg);color:var(--text);font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;line-height:1.75;font-size:16px}
header{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--line)}
.bar{max-width:1040px;margin:0 auto;padding:10px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.brand{font-weight:700;letter-spacing:.02em}
nav{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}
nav a{padding:6px 14px;border-radius:999px;color:var(--text);text-decoration:none;border:1px solid var(--line);font-size:15px;white-space:nowrap}
nav a.on{background:var(--accent);border-color:var(--accent);color:#fff}
main{max-width:1040px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:28px;margin:0 0 6px;line-height:1.35}
.sub{color:var(--muted);margin:0 0 24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px 24px;margin:0 0 20px}
.card h2{margin-top:0;font-size:21px}
.card h3{font-size:17px;margin-top:22px}
.why{background:var(--accent-soft);border-left:4px solid var(--accent);padding:10px 14px;border-radius:8px;margin:0 0 16px}
.rank{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;margin-right:10px;flex:none}
.toc{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.toc li a{display:flex;align-items:center;gap:4px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--text);text-decoration:none}
.toc li a:hover{border-color:var(--accent)}
.toc .t{font-weight:600;margin-right:8px}
.toc .w{color:var(--muted);font-size:14px}
.tw{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:15px;margin:12px 0}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
th{background:var(--code)}
code{background:var(--code);padding:1px 6px;border-radius:5px;font-size:.9em}
blockquote{margin:12px 0;padding:6px 14px;border-left:3px solid var(--line);color:var(--muted)}
a{color:var(--accent)}
.pill{display:inline-block;font-size:13px;padding:1px 10px;border-radius:999px;border:1px solid currentColor;margin-left:6px;vertical-align:middle}
.pill.ok{color:var(--ok)}.pill.wait{color:var(--wait)}.pill.draft{color:var(--draft)}
.foot{color:var(--muted);font-size:13px;margin-top:30px}
@media print{header{display:none}.card{break-inside:avoid}}
`;

type Tab = "prio" | "all" | "team";
function page(title: string, active: Tab, body: string, foot: string) {
  const tab = (href: string, key: Tab, label: string) => `<a href="${href}" class="${active === key ? "on" : ""}">${label}</a>`;
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${CSS}</style></head><body>
<header><div class="bar"><span class="brand">AI Token King｜成長計畫</span><nav>${tab("/", "prio", "⭐ 優先 6 題")}${tab("/all", "all", "問題總表")}${tab("/team", "team", "🧭 團隊統整")}</nav></div></header>
<main>${body}<p class="foot">${foot}</p></main></body></html>`;
}
const mdFoot = (fetchedAt: string) => `內容自動讀取自 GitHub growth-hacker／02-現況盤點／問題總表.md，最後讀取：${fetchedAt}（台北時間）`;

function qCard(sec: string, n: number, extraTop = "") {
  const heading = sec.split("\n")[0];
  const status = heading.match(/(✅ 已有答案|⏳ 待老闆確認|🔺 初步構想)/)?.[1] ?? "";
  const titleText = heading.replace(/^## /, "").replace(status, "").trim();
  const rest = sec.split("\n").slice(1).join("\n");
  return `<section class="card" id="q${n}"><h2>${titleText}${status ? `<span class="pill ${statusClass(status)}">${status}</span>` : ""}</h2>${extraTop}${wrapTables(md(rest))}</section>`;
}

function prioPage(MD: string, fetchedAt: string) {
  const { byNum, prio } = parse(MD);
  const toc = prio
    .map((p) => `<li><a href="#q${p.q}"><span class="rank">${p.rank}</span><span class="t">Q${p.q} ${p.title}</span><span class="w">${p.why}</span></a></li>`)
    .join("");
  const cards = prio
    .map((p) => {
      const sec = byNum.get(p.q);
      if (!sec) return "";
      return qCard(sec, p.q, `<div class="why"><strong>優先順序 ${p.rank}｜為什麼要先決定：</strong>${p.why}</div>`);
    })
    .join("");
  const body = `<h1>⭐ 老闆會議：優先討論的 6 題</h1><p class="sub">這 6 題決定了，成長制度就能開始運作。其他題目可以之後陸續確認，完整內容見「問題總表」。</p>
<section class="card"><ol class="toc">${toc}</ol></section>${cards}`;
  return page("⭐ 優先 6 題｜AI Token King", "prio", body, mdFoot(fetchedAt));
}

function allPage(MD: string, fetchedAt: string) {
  const { intro, overviewSec, byNum } = parse(MD);
  const introHtml = md(intro);
  const overviewHtml = wrapTables(linkQs(md(overviewSec.split("\n").slice(1).join("\n"))));
  const cards = [...byNum.entries()].sort((a, b) => a[0] - b[0]).map(([n, s]) => qCard(s, n)).join("");
  const body = `${introHtml}<section class="card"><h2>總覽</h2>${overviewHtml}</section>${cards}`;
  return page("問題總表｜AI Token King", "all", body, mdFoot(fetchedAt));
}

// ---------- auth + server ----------
// DASHBOARD_PASSWORD 留空時不需要密碼，任何人都能查看；設定後才會要求輸入密碼。
const PASSWORD = Bun.env.DASHBOARD_PASSWORD ?? "";
function authorized(req: Request) {
  if (!PASSWORD) return true;
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Basic ")) return false;
  try {
    const decoded = atob(h.slice(6));
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    return pass === PASSWORD;
  } catch {
    return false;
  }
}

Bun.serve({
  port: Number(Bun.env.PORT ?? 3000),
  async fetch(req) {
    if (!authorized(req)) {
      return new Response("需要密碼才能查看", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="AI Token King", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const url = new URL(req.url);
    const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
    const isTeam = url.pathname === "/team";
    let data;
    try {
      data = await load(isTeam ? TEAM_URL : SOURCE_URL);
    } catch (e) {
      return new Response(`暫時無法讀取 GitHub 上的內容，請稍後再試。（${e}）`, { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (isTeam)
      return new Response(
        page("🧭 團隊統整｜AI Token King", "team", data.md, `分工與數字為建議，請在會議中確認後再更新。內容讀取自 GitHub growth-hacker／dashboard／team.html，最後讀取：${data.fetchedAt}（台北時間）`),
        { headers },
      );
    if (url.pathname === "/" || url.pathname === "/priority") return new Response(prioPage(data.md, data.fetchedAt), { headers });
    if (url.pathname === "/all") return new Response(allPage(data.md, data.fetchedAt), { headers });
    return new Response("找不到頁面", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  },
});
