import { marked } from "marked@12";

// Railway Function「question-dashboard」的原始碼（AI Token King 專案）。
// 問題總表從 GitHub 即時讀取：推送 02-現況盤點/問題總表.md 到 main 即可更新（快取 CACHE_MS）。
// 「團隊統整」分頁是靜態內容，修改時要重新部署這個檔案。
const SOURCE_URL =
  "https://raw.githubusercontent.com/vincentchiu-insightsoftware/growth-hacker/main/02-%E7%8F%BE%E6%B3%81%E7%9B%A4%E9%BB%9E/%E5%95%8F%E9%A1%8C%E7%B8%BD%E8%A1%A8.md";
const CACHE_MS = 60_000;

let cache: { at: number; md: string; fetchedAt: string } | null = null;

async function loadMd() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  try {
    const res = await fetch(`${SOURCE_URL}?t=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    const fetchedAt = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
    cache = { at: Date.now(), md, fetchedAt };
  } catch (e) {
    if (!cache) throw e;
  }
  return cache!;
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
.sec-no{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:var(--text);color:var(--bg);font-size:15px;font-weight:700;margin-right:10px;vertical-align:2px}
.lead{font-size:17px;margin:4px 0 0}
.muted{color:var(--muted)}
.tag{display:inline-block;font-size:12px;padding:0 8px;border-radius:999px;background:var(--code);color:var(--muted);margin-left:6px;vertical-align:2px;font-weight:400}
/* problems */
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.prob{border:1px solid var(--line);border-radius:12px;padding:16px;background:var(--bg)}
.prob .ic{font-size:26px;line-height:1}
.prob b{display:block;margin:8px 0 4px;font-size:17px}
.prob p{margin:0;color:var(--muted);font-size:15px}
.arrow-down{text-align:center;font-size:22px;color:var(--muted);margin:10px 0}
.fix{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.fix div{border-radius:12px;padding:14px 16px;background:var(--accent-soft);border:1px solid var(--accent)}
.fix b{display:block;font-size:16px}
.fix span{font-size:14px;color:var(--muted)}
/* north star */
.star{text-align:center;padding:26px 16px;border-radius:14px;background:var(--accent-soft);border:2px solid var(--accent)}
.star .k{font-size:14px;color:var(--muted);letter-spacing:.08em}
.star .v{font-size:26px;font-weight:800;margin:6px 0 2px;line-height:1.4}
.star .n{font-size:15px;color:var(--muted)}
/* metric tree */
.tree{margin-top:18px}
.tree .root{max-width:520px;margin:0 auto;text-align:center;padding:12px 16px;border-radius:12px;background:var(--text);color:var(--bg);font-weight:700}
.tree .stem{width:2px;height:18px;background:var(--line);margin:0 auto}
.tree .branches{display:grid;grid-template-columns:1fr 1fr;gap:16px;position:relative;padding-top:18px}
.tree .branches:before{content:"";position:absolute;top:0;left:25%;right:25%;height:2px;background:var(--line)}
.branch{position:relative;border-radius:14px;padding:14px;border:2px solid}
.branch:before{content:"";position:absolute;top:-20px;left:50%;width:2px;height:18px;background:var(--line)}
.branch.new{border-color:var(--new);background:var(--new-soft)}
.branch.keep{border-color:var(--keep);background:var(--keep-soft)}
.branch h3{margin:0 0 4px;font-size:18px}
.branch.new h3{color:var(--new)}.branch.keep h3{color:var(--keep)}
.branch .bq{font-size:14px;color:var(--muted);margin:0 0 10px}
.leaf{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:8px}
.leaf .lt{font-weight:600}
.people{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.person{display:inline-flex;align-items:center;gap:6px;font-size:14px;padding:2px 10px 2px 3px;border-radius:999px;border:1px solid var(--line);background:var(--bg)}
.person i{font-style:normal;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--text);color:var(--bg);font-size:12px;font-weight:700}
.person.ext i{background:var(--muted)}
/* kpi cards */
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.kpi{border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--bg);border-top:4px solid var(--line)}
.kpi.new{border-top-color:var(--new)}.kpi.keep{border-top-color:var(--keep)}
.kpi .who{font-weight:700;font-size:17px}
.kpi .role{font-size:13px;color:var(--muted)}
.kpi .num{margin-top:8px;font-size:15px;line-height:1.55}
.kpi .num b{display:block;font-size:12px;color:var(--muted);font-weight:400;letter-spacing:.05em}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:14px;color:var(--muted);margin:0 0 12px}
.legend span:before{content:"";display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.legend .l-new:before{background:var(--new)}.legend .l-keep:before{background:var(--keep)}
/* matrix */
.matrix{display:grid;grid-template-columns:48px 1fr 1fr;grid-template-rows:auto 1fr 1fr;gap:8px;margin-top:14px}
.ylab{display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;line-height:1.4;color:var(--muted);font-weight:600}
.xlab{display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--muted);font-weight:600;padding:2px 0}
.corner{font-size:12px;color:var(--muted);display:flex;align-items:flex-end;justify-content:center;text-align:center;line-height:1.3}
.q{border-radius:12px;padding:14px 16px;min-height:150px;border:2px solid;position:relative}
.q .qi{font-size:24px;line-height:1}
.q b{display:block;font-size:18px;margin:6px 0 2px}
.q .cond{font-size:13px;color:var(--muted)}
.q p{margin:6px 0 0;font-size:15px}
.q.keep{border-color:var(--ok);background:var(--ok-soft)}
.q.opt{border-color:var(--info);background:var(--info-soft)}
.q.watch{border-color:var(--wait);background:var(--wait-soft)}
.q.stop{border-color:var(--draft);background:var(--draft-soft)}
.q .ax{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
.flow{display:flex;align-items:stretch;gap:10px;margin-top:16px;flex-wrap:wrap}
.flow .box{flex:1;min-width:180px;border-radius:12px;padding:12px 14px;border:1px dashed var(--line);background:var(--bg)}
.flow .to{display:flex;align-items:center;font-size:22px;color:var(--muted)}
.flow .box b{display:block}
/* priority lanes */
.lanes{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.lane{border-radius:12px;border:1px solid var(--line);background:var(--bg);overflow:hidden}
.lane .lh{padding:10px 14px;font-weight:700;color:#fff}
.lane .lh small{display:block;font-weight:400;opacity:.9;font-size:12px}
.lane.l1 .lh{background:var(--accent)}
.lane.l2 .lh{background:var(--keep)}
.lane.l3 .lh{background:var(--muted)}
.lane.l4 .lh{background:var(--line);color:var(--text)}
.lane ul{margin:0;padding:10px 14px 12px 30px;font-size:15px}
.lane li{margin:6px 0}
.lane li span{display:block;font-size:13px;color:var(--muted)}
/* steps */
.steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;counter-reset:s}
.steps li{border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--bg);counter-increment:s;position:relative}
.steps li:before{content:counter(s);display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;font-size:14px;margin-bottom:6px}
.steps li b{display:block}
.steps li span{font-size:14px;color:var(--muted)}
.three{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.three div{border-radius:10px;padding:10px 12px;background:var(--code);font-size:15px}
.three b{margin-right:6px}
@media (max-width:820px){
 .grid3,.fix,.lanes,.steps,.three{grid-template-columns:1fr}
 .kpis{grid-template-columns:1fr 1fr}
 .tree .branches{grid-template-columns:1fr}
 .tree .branches:before,.branch:before{display:none}
 .matrix{grid-template-columns:40px 1fr 1fr;gap:6px}
 .ylab{font-size:12px}
 .corner{visibility:hidden}
 .q{min-height:0;padding:12px}
 .q b{font-size:16px}
 .q p{font-size:14px}
 h1{font-size:24px}
 .card{padding:18px 16px}
}
@media (max-width:480px){.kpis{grid-template-columns:1fr}}
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

// ---------- 團隊統整（靜態） ----------
const P = (name: string, ext = false) => `<span class="person${ext ? " ext" : ""}"><i>${name.slice(0, 1)}</i>${name}</span>`;

function teamPage() {
  const body = `
<h1>🧭 團隊統整：一個目標，每人一個數字</h1>
<p class="sub">開會用：先看懂為什麼要統整，再一起盤點手上的工作，決定哪些保留、哪些停掉，把時間移到最重要的事。</p>

<section class="card">
<h2><span class="sec-no">1</span>為什麼要統整？</h2>
<div class="grid3">
 <div class="prob"><div class="ic">🧩</div><b>各做各的</b><p>每個人都在做自己領域的事，對彼此的工作不太了解。</p></div>
 <div class="prob"><div class="ic">🎯</div><b>沒有共同目標</b><p>沒有一個大家一起追的目標，也沒有明確的績效。</p></div>
 <div class="prob"><div class="ic">⏳</div><b>新任務沒有時間</b><p>老闆要擴大合作夥伴，但每個人手上已經滿了。</p></div>
</div>
<div class="arrow-down">▼ 這次會議要解決的事</div>
<div class="fix">
 <div><b>① 一個共同目標</b><span>全團隊看同一個數字</span></div>
 <div><b>② 每人一個數字</b><span>知道自己負責讓哪一塊變大</span></div>
 <div><b>③ 停掉低效的工作</b><span>把時間移去擴大合作夥伴</span></div>
</div>
</section>

<section class="card">
<h2><span class="sec-no">2</span>一個共同目標（老闆已確定）</h2>
<div class="star">
 <div class="k">北極星指標</div>
 <div class="v">每週有實際使用 AI Token King 的人數</div>
 <div class="n">目前數字：待從後台數據計算</div>
</div>
<p class="lead">為什麼是這個數字？註冊了不用，對公司沒有幫助；<b>真的在用的人，才會再儲值</b>。所有人的工作，最後都要讓這個數字變大。</p>
</section>

<section class="card">
<h2><span class="sec-no">3</span>這個數字怎麼變大？每個人在哪裡<span class="tag">分工為建議，會議中確認</span></h2>
<div class="legend"><span class="l-new">找人進來</span><span class="l-keep">讓人留下來</span><span>灰色頭像＝行銷部以外的同事</span></div>
<div class="tree">
 <div class="root">⭐ 每週有實際使用的人數</div>
 <div class="stem"></div>
 <div class="branches">
  <div class="branch new">
   <h3>➕ 新進來的人</h3>
   <p class="bq">有多少新的人開始用？</p>
   <div class="leaf"><div class="lt">合作夥伴帶來的學生 <span class="tag">老闆定的第一重點</span></div><div class="people">${P("Penny")}${P("業務（2 位）", true)}${P("Yolanda")}</div></div>
   <div class="leaf"><div class="lt">工作坊學員</div><div class="people">${P("Vincent")}</div></div>
   <div class="leaf"><div class="lt">網站、內容帶來的人</div><div class="people">${P("Serena")}${P("Anthony")}</div></div>
  </div>
  <div class="branch keep">
   <h3>🔁 留下來的人</h3>
   <p class="bq">用過的人，有沒有繼續用？</p>
   <div class="leaf"><div class="lt">學得會、做得出作品</div><div class="people">${P("Vincent")}${P("Yolanda")}</div></div>
   <div class="leaf"><div class="lt">產品好用</div><div class="people">${P("Alice", true)}</div></div>
   <div class="leaf"><div class="lt">遇到問題有人幫忙</div><div class="people">${P("客服（AI＋4 位）", true)}</div></div>
  </div>
 </div>
</div>
</section>

<section class="card">
<h2><span class="sec-no">4</span>每人一個數字<span class="tag">建議，會議中確認</span></h2>
<p class="muted" style="margin-top:0">每週會議，每個人只要回報自己的數字，就知道團隊離目標還有多遠。</p>
<div class="legend"><span class="l-new">找人進來</span><span class="l-keep">讓人留下來</span></div>
<div class="kpis">
 <div class="kpi new"><div class="who">Penny</div><div class="role">線上陌生開發</div><div class="num"><b>每週回報</b>線上新談成的合作夥伴數</div></div>
 <div class="kpi new"><div class="who">業務（2 位）</div><div class="role">線下開發</div><div class="num"><b>每週回報</b>線下新談成的合作夥伴與客戶數</div></div>
 <div class="kpi new"><div class="who">Yolanda</div><div class="role">合作提案、教材編輯</div><div class="num"><b>每週回報</b>合作夥伴簽約數、合作夥伴帶來的付費客戶數</div></div>
 <div class="kpi new"><div class="who">Serena</div><div class="role">網站、SEO、影音傳播</div><div class="num"><b>每週回報</b>網站帶來的工作坊報名數與註冊數</div></div>
 <div class="kpi new"><div class="who">Anthony</div><div class="role">深度專題、內部 KOL</div><div class="num"><b>每週回報</b>專題內容帶來的報名數與註冊數</div></div>
 <div class="kpi keep"><div class="who">Vincent</div><div class="role">工作坊、成長負責人</div><div class="num"><b>每週回報</b>工作坊學員現場註冊數、7 天內開始使用的人數</div></div>
 <div class="kpi keep"><div class="who">Alice</div><div class="role">產品管理</div><div class="num"><b>每週回報</b>產品改善進度（工作範本、手機版）</div></div>
 <div class="kpi keep"><div class="who">客服</div><div class="role">AI 客服＋真人 4 位</div><div class="num"><b>每週回報</b>主動協助的新用戶數</div></div>
</div>
</section>

<section class="card">
<h2><span class="sec-no">5</span>盤點手上的工作：保留、優化、觀察、停掉</h2>
<p class="muted" style="margin-top:0">每一件固定在做的事，回答兩個問題：<b>跟北極星指標有沒有關係？</b>以及<b>每週花多少時間？</b>然後放進下面四格。</p>
<div class="matrix">
 <div class="corner">關係＼時間</div>
 <div class="xlab">每週花的時間少</div>
 <div class="xlab">每週花的時間多</div>
 <div class="ylab">跟北極星<br>直接有關</div>
 <div class="q keep"><span class="ax">直接有關・花得少</span><div class="qi">✅</div><b>保留</b><div class="cond">划算的工作</div><p>繼續做。</p></div>
 <div class="q opt"><span class="ax">直接有關・花得多</span><div class="qi">🔧</div><b>優化</b><div class="cond">重要但很花時間</div><p>保留，但想辦法做得更快，例如交給 Claude 協助、做成模板。</p></div>
 <div class="ylab">跟北極星<br>看不出關係</div>
 <div class="q watch"><span class="ax">看不出關係・花得少</span><div class="qi">👀</div><b>觀察</b><div class="cond">影響不大</div><p>先留著，一個月後用數字再檢查一次。</p></div>
 <div class="q stop"><span class="ax">看不出關係・花得多</span><div class="qi">⛔</div><b>優先停掉</b><div class="cond">最該釋放的時間</div><p>停掉或大幅減少，時間移去做合作夥伴。</p></div>
</div>
<div class="flow">
 <div class="box"><b>⛔ 停掉的工作</b><span class="muted">釋放出來的時間</span></div>
 <div class="to">➜</div>
 <div class="box"><b>🤝 擴大合作夥伴</b><span class="muted">老闆定的第一重點</span></div>
 <div class="to">➜</div>
 <div class="box"><b>⭐ 每週使用人數變多</b><span class="muted">用數字確認有沒有效</span></div>
</div>
</section>

<section class="card">
<h2><span class="sec-no">6</span>輕重緩急：先做什麼、後做什麼<span class="tag">建議</span></h2>
<div class="lanes">
 <div class="lane l1"><div class="lh">1　現在就做<small>人力優先放這裡</small></div><ul>
  <li>擴大合作夥伴<span>Penny（線上）、業務（線下）、Yolanda（簽約）</span></li>
  <li>合作老師教學包<span>Vincent 設計、Yolanda 編輯</span></li>
  <li>算出北極星指標的起點<span>Vincent、Alice</span></li>
 </ul></div>
 <div class="lane l2"><div class="lh">2　接著做<small>支援第一重點</small></div><ul>
  <li>工作坊（資訊傳遞優先、手機版）<span>Vincent</span></li>
  <li>網站加上給小白看的頁面<span>Serena</span></li>
  <li>信任內容：老師專訪、學員作品<span>Anthony</span></li>
 </ul></div>
 <div class="lane l3"><div class="lh">3　有餘力再做<small>速度不在我們手上</small></div><ul>
  <li>手機版改善<span>Alice 對接深圳團隊</span></li>
  <li>註冊後工作範本<span>Alice 對接深圳團隊</span></li>
  <li>模型比較表<span>Alice 提供價格資料</span></li>
 </ul></div>
 <div class="lane l4"><div class="lh">暫緩<small>先不投入時間</small></div><ul>
  <li>AI 短劇<span>老闆排在三個方向的最後</span></li>
  <li>跟目前主力客群不符的工作<span>由工作盤點決定</span></li>
 </ul></div>
</div>
</section>

<section class="card">
<h2><span class="sec-no">7</span>這次會議怎麼進行</h2>
<ol class="steps">
 <li><b>會前</b><span>每個人把手上固定在做的事列出來，填下面的盤點表。</span></li>
 <li><b>輪流分享</b><span>每人 3 分鐘：我在做什麼、每週花多少時間。</span></li>
 <li><b>一起分類</b><span>用第 5 節的四格，把每件事放進保留、優化、觀察、停掉。</span></li>
 <li><b>做決定</b><span>停掉哪些事、時間移到哪裡、每個人每週回報哪個數字。</span></li>
</ol>
<h3>會前盤點表（每人一份）</h3>
<div class="tw"><table>
<thead><tr><th>我固定在做的事</th><th>跟北極星的關係<br><span class="muted" style="font-weight:400">直接／間接／看不出</span></th><th>每週花幾小時</th><th>我覺得應該<br><span class="muted" style="font-weight:400">保留／優化／觀察／停掉</span></th></tr></thead>
<tbody>
<tr><td class="muted">範例：每週更新社群貼文</td><td class="muted">間接</td><td class="muted">4</td><td class="muted">優化</td></tr>
<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
</tbody></table></div>
<h3>之後每週的同步會議（30 分鐘，每人 3 分鐘）</h3>
<div class="three">
 <div><b>①</b>我的數字這週是多少</div>
 <div><b>②</b>下週要做什麼</div>
 <div><b>③</b>我卡在哪裡、需要誰幫忙</div>
</div>
</section>`;
  return page("🧭 團隊統整｜AI Token King", "team", body, "團隊統整頁的分工與數字為建議，請在會議中確認後再更新。");
}
const TEAM_HTML = teamPage();

// ---------- auth + server ----------
const PASSWORD = Bun.env.DASHBOARD_PASSWORD ?? "";
function authorized(req: Request) {
  if (!PASSWORD) return false;
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
    if (url.pathname === "/team") return new Response(TEAM_HTML, { headers });
    let data;
    try {
      data = await loadMd();
    } catch (e) {
      return new Response(`暫時無法讀取 GitHub 上的問題總表，請稍後再試。（${e}）`, { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (url.pathname === "/" || url.pathname === "/priority") return new Response(prioPage(data.md, data.fetchedAt), { headers });
    if (url.pathname === "/all") return new Response(allPage(data.md, data.fetchedAt), { headers });
    return new Response("找不到頁面", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  },
});
