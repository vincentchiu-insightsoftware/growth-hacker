import QRCode from "qrcode@1";

// Railway Function「survey-a」：A 版（公開市調）網頁問卷。
// 填答頁：/（可加 ?src=管道代碼，答案會記下來源）
// 管理頁：/admin?key=ADMIN_KEY（看填答、下載 Excel 用的 CSV、各管道 QR Code）
// 答案存在 Railway 的 Postgres（DATABASE_URL）；本機沒有 DATABASE_URL 時改用記憶體，只供測試。

const ADMIN_KEY = Bun.env.ADMIN_KEY ?? "";
const CHANNELS = (Bun.env.CHANNELS ?? "A-QR,A-社群,A-活動,A-社團")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type Answers = Record<string, string>;
type Row = { id: number; created_at: string; source: string; answers: Answers };

// ---------- storage ----------
let insertRow: (source: string, a: Answers) => Promise<void>;
let allRows: () => Promise<Row[]>;
let deleteRow: (id: number) => Promise<void>;

if (Bun.env.DATABASE_URL) {
  const { SQL } = await import("bun");
  const sql = new SQL(Bun.env.DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS survey_a (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT NOT NULL DEFAULT '',
    answers JSONB NOT NULL
  )`;
  insertRow = async (source, a) => {
    await sql`INSERT INTO survey_a (source, answers) VALUES (${source}, ${JSON.stringify(a)}::jsonb)`;
  };
  deleteRow = async (id) => {
    await sql`DELETE FROM survey_a WHERE id = ${id}`;
  };
  allRows = async () => {
    const rows = await sql`SELECT id, created_at, source, answers FROM survey_a ORDER BY id DESC`;
    return rows.map((r: any) => ({
      id: r.id,
      created_at: new Date(r.created_at).toISOString(),
      source: r.source,
      answers: typeof r.answers === "string" ? JSON.parse(r.answers) : r.answers,
    }));
  };
} else {
  const mem: Row[] = [];
  insertRow = async (source, a) => {
    mem.unshift({ id: mem.length + 1, created_at: new Date().toISOString(), source, answers: a });
  };
  allRows = async () => mem;
  deleteRow = async (id) => {
    const i = mem.findIndex((r) => r.id === id);
    if (i >= 0) mem.splice(i, 1);
  };
}

// ---------- questions ----------
type Q = {
  id: string;
  title: string;
  short: string;
  type: "text" | "radio" | "checkbox";
  options?: string[];
  other?: boolean;
  required?: boolean;
  help?: string;
  placeholder?: string;
};

const PAID = "有付費訂閱 AI 服務（例如 ChatGPT Plus）";
const QUESTIONS: Q[] = [
  { id: "q1", title: "1. 您是做哪一行的？", short: "1 行業", type: "text", required: true, placeholder: "例如：保險業務、補習班老師、網拍" },
  {
    id: "q2",
    title: "2. 您平常用 AI 的經驗大概是哪一種？",
    short: "2 AI 經驗",
    type: "radio",
    required: true,
    options: ["沒用過", "用過幾次，例如問過 ChatGPT 問題", "工作上偶爾會用", "幾乎每天用", PAID],
  },
  {
    id: "q3",
    title: "3. 平常工作中，哪一件事最花時間？",
    short: "3 最花時間",
    type: "radio",
    required: true,
    other: true,
    options: ["跟客戶介紹產品", "寫貼文、公告、通知", "做宣傳影片"],
  },
  {
    id: "q4",
    title: "4. 平常工作上，比較常用手機還是電腦？",
    short: "4 手機或電腦",
    type: "radio",
    required: true,
    options: ["幾乎都用手機", "手機電腦差不多", "幾乎都用電腦"],
  },
  {
    id: "q5",
    title: "5. 您最希望 AI 幫您做什麼？（可複選）",
    short: "5 希望 AI 幫忙",
    type: "checkbox",
    required: true,
    other: true,
    options: ["寫產品介紹或簡報", "寫貼文、公告、通知", "做宣傳圖片或影片"],
  },
  {
    id: "q6",
    title: "6. 您的年紀大約是？",
    short: "6 年紀",
    type: "radio",
    required: true,
    options: ["24 歲以下", "25～34 歲", "35～44 歲", "45～54 歲", "55 歲以上"],
  },
  {
    id: "q7",
    title: "7. 您用過哪些 AI 工具？（可複選）",
    short: "7 用過的 AI 工具",
    type: "checkbox",
    required: true,
    other: true,
    options: ["ChatGPT", "Gemini", "Claude", "Microsoft Copilot", "Midjourney 等圖片工具", "可靈、Runway 等影片工具", "都沒用過"],
  },
  {
    id: "q8",
    title: "8.（選填）想收到這份調查的結果，或之後有免費 AI 實作課時收到通知嗎？歡迎留下 LINE 或 Email",
    short: "8 聯絡方式",
    type: "text",
    help: "您留下的聯絡方式，只用於寄送調查結果與課程通知，不會提供給第三方。不需要的話，留白即可。",
    placeholder: "LINE ID 或 Email",
  },
];
const COLUMNS = [
  ...QUESTIONS.slice(0, 2).map((q) => ({ key: q.id, label: q.short })),
  { key: "q2n", label: "2 訂了幾套" },
  ...QUESTIONS.slice(2).map((q) => ({ key: q.id, label: q.short })),
];

// ---------- helpers ----------
const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const clip = (s: unknown, n = 300) => String(s ?? "").trim().slice(0, n);
const cleanSrc = (s: string | null) => clip(s ?? "", 40).replace(/[^\p{L}\p{N}_\- ]/gu, "");
const twTime = (iso: string) => new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
const baseUrl = (req: Request) => {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
};

const CSS = `
:root{--bg:#f6f5f2;--card:#fff;--text:#1d1d1f;--muted:#6b6b70;--line:#e2e1dc;--accent:#c2410c;--accent-soft:#fff1e8;--err:#b91c1c;color-scheme:light}
@media (prefers-color-scheme: dark){:root{--bg:#141416;--card:#1d1d20;--text:#ececef;--muted:#a0a0a8;--line:#2e2e33;--accent:#fb923c;--accent-soft:#2a1d14;--err:#f87171;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;line-height:1.7;font-size:17px}
main{max-width:640px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:26px;margin:8px 0 6px;line-height:1.35}
.lead{color:var(--muted);margin:0 0 20px}
.q{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 16px 12px;margin:0 0 14px}
.q.bad{border-color:var(--err)}
.qt{font-weight:700;margin:0 0 10px;font-size:17px}
.req{color:var(--err);margin-left:2px}
.opt{display:flex;align-items:flex-start;gap:10px;padding:9px 10px;border-radius:10px;cursor:pointer}
.opt:hover{background:var(--accent-soft)}
.opt input[type=radio],.opt input[type=checkbox]{width:20px;height:20px;margin:3px 0 0;accent-color:var(--accent);flex:none}
.opt .lbl{flex:1}
.sub{margin:6px 0 4px 40px}
input[type=text],input[type=number]{width:100%;font:inherit;font-size:16px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text)}
.sub input{max-width:220px}
.help{color:var(--muted);font-size:14px;margin:8px 0 2px}
.msg{color:var(--err);font-size:14px;margin:6px 0 0;display:none}
.q.bad .msg{display:block}
button{width:100%;font:inherit;font-weight:700;font-size:18px;padding:14px;border:0;border-radius:12px;background:var(--accent);color:#fff;cursor:pointer;margin-top:6px}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.done{text-align:center;padding:60px 8px}
.done .ic{font-size:48px}
`;

function page(title: string, body: string, extraCss = "") {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>${CSS}${extraCss}</style></head><body><main>${body}</main></body></html>`;
}

function formPage(src: string) {
  const qs = QUESTIONS.map((q) => {
    const star = q.required ? '<span class="req">*</span>' : "";
    let inner = "";
    if (q.type === "text") {
      inner = `<input type="text" name="${q.id}" maxlength="200" ${q.required ? "required" : ""} placeholder="${esc(q.placeholder ?? "")}">`;
    } else {
      const t = q.type;
      inner = (q.options ?? [])
        .map((o, i) => {
          let row = `<label class="opt"><input type="${t}" name="${q.id}" value="${esc(o)}" ${t === "radio" && q.required && i === 0 ? "required" : ""}><span class="lbl">${esc(o)}</span></label>`;
          if (q.id === "q2" && o === PAID)
            row += `<div class="sub"><input type="number" name="q2n" min="1" max="30" inputmode="numeric" placeholder="訂了幾套？（選填）"></div>`;
          return row;
        })
        .join("");
      if (q.other)
        inner += `<label class="opt"><input type="${t}" name="${q.id}" value="__other"><span class="lbl">其他</span></label><div class="sub"><input type="text" name="${q.id}_other" maxlength="100" placeholder="請填寫"></div>`;
    }
    const help = q.help ? `<p class="help">${esc(q.help)}</p>` : "";
    return `<fieldset class="q" data-type="${q.type}" data-req="${q.required ? 1 : 0}" style="border:1px solid var(--line)"><legend class="qt" style="float:left;width:100%;padding:0">${esc(q.title)}${star}</legend>${inner}${help}<p class="msg">請選擇至少一個選項</p></fieldset>`;
  }).join("");
  const body = `<h1>AI 使用情況小調查</h1>
<p class="lead">您好，我們正在做一份 AI 使用情況的小調查，想了解大家平常怎麼使用 AI，以及工作上有哪些需要。</p>
<form method="post" action="/submit" id="f" novalidate>
<input type="hidden" name="src" value="${esc(src)}">
<div class="hp" aria-hidden="true"><label>網站<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
${qs}
<button type="submit">送出</button>
</form>
<script>
document.getElementById('f').addEventListener('submit',function(e){
  var first=null;
  document.querySelectorAll('.q').forEach(function(q){
    q.classList.remove('bad');
    if(q.dataset.req!=='1')return;
    var ok;
    if(q.dataset.type==='text'){var i=q.querySelector('input[type=text]');ok=i.value.trim()!=='';}
    else{ok=!!q.querySelector('input[type=radio]:checked,input[type=checkbox]:checked');}
    if(!ok){q.classList.add('bad');q.querySelector('.msg').textContent=q.dataset.type==='text'?'請填寫這一題':'請選擇至少一個選項';if(!first)first=q;}
  });
  if(first){e.preventDefault();first.scrollIntoView({behavior:'smooth',block:'center'});}
});
document.querySelectorAll('.sub input').forEach(function(inp){
  inp.addEventListener('input',function(){
    var box=inp.closest('.sub').previousElementSibling.querySelector('input');
    if(inp.value.trim()!==''&&box&&!box.checked)box.checked=true;
  });
});
</script>`;
  return page("AI 使用情況小調查", body);
}

const thanksPage = () =>
  page(
    "謝謝您的填寫",
    `<div class="done"><div class="ic">🙏</div><h1>感謝您撥空填寫</h1><p class="lead">如果有留下聯絡方式，調查結果整理好後會寄給您。</p></div>`,
  );

function collect(fd: FormData): Answers {
  const a: Answers = {};
  for (const q of QUESTIONS) {
    if (q.type === "text") a[q.id] = clip(fd.get(q.id), 200);
    else {
      const vals = fd.getAll(q.id).map((v) => clip(v, 100));
      const other = clip(fd.get(`${q.id}_other`), 100);
      const allowed = new Set(q.options);
      const out = vals.filter((v) => allowed.has(v));
      if (vals.includes("__other") || (q.other && other)) out.push(`其他：${other}`);
      a[q.id] = (q.type === "radio" ? out.slice(0, 1) : out).join("、");
    }
  }
  const n = clip(fd.get("q2n"), 3).replace(/\D/g, "");
  a.q2n = n;
  return a;
}

function csvCell(s: string) {
  const v = String(s ?? "");
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function adminPage(req: Request) {
  const rows = await allRows();
  const base = baseUrl(req);
  const bySrc = new Map<string, number>();
  for (const r of rows) bySrc.set(r.source || "（未標記）", (bySrc.get(r.source || "（未標記）") ?? 0) + 1);
  const srcList = [...bySrc.entries()].map(([s, n]) => `<li>${esc(s)}：<b>${n}</b> 份</li>`).join("") || "<li>還沒有人填寫</li>";

  const qrs = await Promise.all(
    CHANNELS.map(async (c) => {
      const url = `${base}/?src=${encodeURIComponent(c)}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 180 });
      const png = await QRCode.toDataURL(url, { margin: 2, width: 800 });
      return `<div class="qr"><div class="qs">${svg}</div><b>${esc(c)}</b><a href="${esc(url)}" target="_blank">${esc(url)}</a><a class="dl" download="問卷QR-${esc(c)}.png" href="${png}">下載 QR Code 圖片</a></div>`;
    }),
  );

  const key = encodeURIComponent(ADMIN_KEY);
  const head = `<tr><th>時間（台北）</th><th>來源</th>${COLUMNS.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th></th></tr>`;
  const body = rows
    .map(
      (r) =>
        `<tr><td>${esc(twTime(r.created_at))}</td><td>${esc(r.source)}</td>${COLUMNS.map((c) => `<td>${esc(r.answers[c.key] ?? "")}</td>`).join("")}<td><form method="post" action="/admin/delete?key=${key}" onsubmit="return confirm('確定要刪除這一份回覆嗎？刪除後無法復原。')"><input type="hidden" name="id" value="${r.id}"><button class="del">刪除</button></form></td></tr>`,
    )
    .join("");
  const css = `main{max-width:1200px}.qrs{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.qr{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:4px;font-size:13px;word-break:break-all}
.qr .qs svg{width:100%;height:auto;background:#fff;border-radius:8px}.qr b{font-size:16px}.dl{font-weight:700}
.box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:0 0 16px}
.tw{overflow-x:auto}table{border-collapse:collapse;font-size:14px;min-width:900px;width:100%}th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{background:var(--bg);position:sticky;top:0}
.del{width:auto;margin:0;padding:4px 10px;font-size:13px;background:transparent;color:var(--err);border:1px solid var(--err);border-radius:8px}
.btn{display:inline-block;background:var(--accent);color:#fff;padding:8px 14px;border-radius:10px;text-decoration:none;font-weight:700}`;
  return page(
    "問卷管理｜AI 使用情況小調查",
    `<h1>問卷管理</h1><p class="lead">這一頁只給內部看，請不要分享網址。共 <b>${rows.length}</b> 份回覆。</p>
<div class="box"><h2 style="margin-top:0;font-size:18px">各管道份數</h2><ul>${srcList}</ul><a class="btn" href="/admin.csv?key=${key}">下載全部回覆（Excel 可開）</a></div>
<div class="box"><h2 style="margin-top:0;font-size:18px">各管道的 QR Code</h2><p class="help" style="margin-top:0">每個管道用自己的 QR Code，就能分出答案從哪裡來。</p><div class="qrs">${qrs.join("")}</div></div>
<div class="box"><h2 style="margin-top:0;font-size:18px">所有回覆（最新在上）</h2><div class="tw"><table>${head}${body}</table></div></div>`,
    css,
  );
}

async function csv() {
  const rows = await allRows();
  const head = ["時間（台北）", "來源", ...COLUMNS.map((c) => c.label)];
  const lines = [head, ...rows.map((r) => [twTime(r.created_at), r.source, ...COLUMNS.map((c) => r.answers[c.key] ?? "")])].map((l) =>
    l.map(csvCell).join(","),
  );
  return "\uFEFF" + lines.join("\r\n");
}

const isAdmin = (url: URL) => ADMIN_KEY !== "" && url.searchParams.get("key") === ADMIN_KEY;
const html = (s: string, status = 200) =>
  new Response(s, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

Bun.serve({
  port: Number(Bun.env.PORT ?? 3000),
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/") return html(formPage(cleanSrc(url.searchParams.get("src"))));
    if (req.method === "POST" && url.pathname === "/submit") {
      const fd = await req.formData();
      if (clip(fd.get("website"))) return Response.redirect(`${baseUrl(req)}/thanks`, 303);
      const a = collect(fd);
      if (!a.q1 || !a.q2 || !a.q4 || !a.q6) return html(formPage(cleanSrc(String(fd.get("src") ?? ""))), 400);
      await insertRow(cleanSrc(String(fd.get("src") ?? "")), a);
      return Response.redirect(`${baseUrl(req)}/thanks`, 303);
    }
    if (url.pathname === "/thanks") return html(thanksPage());
    if (url.pathname === "/admin") return isAdmin(url) ? html(await adminPage(req)) : html(page("找不到頁面", "<p>找不到頁面</p>"), 404);
    if (req.method === "POST" && url.pathname === "/admin/delete") {
      if (!isAdmin(url)) return html(page("找不到頁面", "<p>找不到頁面</p>"), 404);
      const id = Number((await req.formData()).get("id"));
      if (Number.isInteger(id) && id > 0) await deleteRow(id);
      return Response.redirect(`${baseUrl(req)}/admin?key=${encodeURIComponent(ADMIN_KEY)}`, 303);
    }
    if (url.pathname === "/admin.csv") {
      if (!isAdmin(url)) return html(page("找不到頁面", "<p>找不到頁面</p>"), 404);
      return new Response(await csv(), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("AI使用情況小調查_回覆.csv")}`,
          "Cache-Control": "no-store",
        },
      });
    }
    return html(page("找不到頁面", "<p>找不到頁面</p>"), 404);
  },
});
