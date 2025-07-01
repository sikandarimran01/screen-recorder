/* ───────────────────────────────────────────────
   main.js – Magic‑link session aware + media grid
   ─────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  /* ----------  helpers first (so they’re hoisted) ---------- */
  const $  = (s) => document.querySelector(s);
  const SESSION_KEY = "gs_session";

  /* theme‑agnostic clipboard helper */
  function copy(text, btn, msg = "✅ Copied!") {
    navigator.clipboard.writeText(text).then(() => {
      if (!btn) return;
      const prev = btn.textContent;
      btn.textContent = msg; btn.disabled = true;
      setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1700);
    });
  }

  /* ----------  session + fetch wrapper ---------- */
  let session = localStorage.getItem(SESSION_KEY) ||
                crypto.randomUUID().replace(/-/g, "");
  localStorage.setItem(SESSION_KEY, session);

  const apiFetch = (url, opts = {}) => {
    opts.headers = { "X-Session": session, ...(opts.headers || {}) };
    return fetch(url, opts).then(async r => {
      const m = document.cookie.match(/(?:^|;\\s*)session=([^;]+)/);
      if (m) { session = m[1]; localStorage.setItem(SESSION_KEY, session); }
      return r;
    });
  };

  /* ----------  fixed DOM refs ---------- */
  const startBtn   = $("#startBtn");
  const stopBtn    = $("#stopBtn");
  const statusMsg  = $("#statusMsg");
  const preview    = $("#preview");

  const shareWrap  = $("#shareWrap");
  const copyLinkBtn= $("#copyLink");
  const copySecure = $("#copySecure");
  const copyPublic = $("#copyPublic");
  const disablePub = $("#disablePublic");
  const shareEmail = $("#shareEmail");

  const openClip   = $("#openClip");
  const clipPane   = $("#clipPanel");
  const clipGo     = $("#clipGo");
  const clipCancel = $("#clipCancel");

  const emailDlg   = $("#emailModal");
  const emailInput = $("#emailTo");
  const emailSend  = $("#emailSend");
  const emailClose = $("#emailClose");
  const emailStat  = $("#emailStatus");

  const resumeBtn  = $("#resumeBtn");
  const forgetBtn  = $("#forgetSession");
  const filesPanel = $("#filesPanel");
  const mediaGrid  = $("#mediaGrid");   // new grid inside filesPanel

  /* ----------  computed path helpers ---------- */
  const isLocal  = ["localhost","127.0.0.1"].includes(location.hostname);
  const REC_BASE = isLocal ? "/static/recordings/" : "/recordings/";
  const fullUrl  = (f) => `${location.origin}${REC_BASE}${f}`;

  /* ----------  state ---------- */
  let mediaRecorder, chunks = [], fileName = "", secureUrl = "";
  let filesSet = new Set();            // easy lookup / update

  /* ----------  initial load of session files ---------- */
  (async () => {
    try {
      const { status, files = [] } = await apiFetch("/session/files").then(r=>r.json());
      if (status === "ok" && files.length) { renderFiles(files); }
    } catch { /* first‑visit: ignore */ }
  })();

  /* ----------  RECORD  ---------- */
  startBtn?.addEventListener("click", async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];

      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type:"video/webm" });
        const fd   = new FormData(); fd.append("video", blob, "recording.webm");

        statusMsg.textContent = "⏫ Uploading…";
        const res = await apiFetch("/upload", { method:"POST", body:fd }).then(r=>r.json());

        if (res.status === "ok") {
          fileName  = res.filename; secureUrl = res.url;
          preview.src = fullUrl(fileName);
          preview.classList.remove("hidden");
          shareWrap.classList.remove("hidden");
          statusMsg.innerHTML =
            `✅ Saved – <a href="${fullUrl(fileName)}" download>Download raw</a>`;

          addFile(fileName);               // update grid
        } else {
          statusMsg.textContent = "❌ Upload failed: "+res.error;
        }
        startBtn.disabled = false;
      };

      mediaRecorder.start();
      statusMsg.textContent = "🎬 Recording…";
      startBtn.disabled = true; stopBtn.disabled = false;
    } catch { alert("Screen‑capture denied / unsupported."); }
  });

  stopBtn?.addEventListener("click", () => {
    if (mediaRecorder?.state === "recording") { mediaRecorder.stop(); stopBtn.disabled = true; }
  });

  /* ----------  SHARE ---------- */
  copyLinkBtn?.addEventListener("click", () => {
    if (!fileName) return alert("⚠ No recording yet.");
    copy(fullUrl(fileName), copyLinkBtn);
  });

  copySecure?.addEventListener("click", async () => {
    if (!fileName) return alert("⚠ No recording yet.");
    const r = await apiFetch(`/link/secure/${fileName}`).then(r=>r.json());
    if (r.status === "ok") secureUrl = r.url;
    copy(secureUrl, copySecure, "✅ Secure copied");
  });

  copyPublic?.addEventListener("click", () => togglePublic(true));
  disablePub?.addEventListener("click", () => togglePublic(false));

  async function togglePublic(create) {
    if (!fileName) return alert("⚠ No recording yet.");
    const r = await apiFetch(`/link/public/${fileName}`, { method:create?"GET":"DELETE" }).then(r=>r.json());
    if (r.status === "ok") {
      if (create) copy(r.url, copyPublic);
      alert(create ? "✅ Public link copied" : "✅ Public link disabled");
    } else alert("❌ "+r.error);
  }

  /* ----------  EMAIL ---------- */
  shareEmail?.addEventListener("click", () => {
    if (!fileName) return alert("⚠ No recording yet.");
    emailInput.value = ""; emailStat.textContent = ""; emailDlg.showModal();
  });
  emailClose?.addEventListener("click", () => emailDlg.close());

  emailSend?.addEventListener("click", async () => {
    const to = emailInput.value.trim();
    if (!to) { emailStat.textContent = "❌ Enter e‑mail."; return; }
    emailSend.disabled = true; emailSend.textContent = "⏳ Sending…";
    const r = await apiFetch("/send_email", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ to, url: secureUrl || fullUrl(fileName) })
    }).then(x=>x.json()).catch(()=>({status:"fail"}));
    emailStat.textContent = r.status==="ok" ? "✅ Sent!" : "❌ "+r.error;
    emailSend.disabled = false; emailSend.textContent = "📤 Send";
  });

  /* ----------  CLIP ---------- */
  openClip?.addEventListener("click", () => clipPane.classList.toggle("hidden"));
  clipCancel?.addEventListener("click", () => clipPane.classList.add("hidden"));
  clipGo?.addEventListener("click", async () => {
    const s = +$("#clipStart").value, e = +$("#clipEnd").value;
    if (!fileName) return alert("⚠ No recording.");
    if (s >= e) return alert("⚠ Invalid range.");
    clipGo.disabled = true; clipGo.textContent = "⏳ Cutting…";
    const r = await apiFetch(`/clip/${fileName}`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ start:s, end:e })
    }).then(x=>x.json());
    if (r.status === "ok") copy(fullUrl(r.clip), clipGo, "✅ Clip copied!");
    else alert("❌ "+r.error);
    clipGo.disabled = false; clipGo.textContent = "📤 Share Clip";
  });

  /* ----------  SESSION controls ---------- */
  resumeBtn?.addEventListener("click", () => filesPanel.classList.toggle("hidden"));
  forgetBtn?.addEventListener("click", async () => {
    await apiFetch("/session/forget", { method:"POST" });
    localStorage.removeItem(SESSION_KEY);
    filesSet.clear();
    renderFiles([]);                       // clears grid
    filesPanel.classList.add("hidden");
    resumeBtn.classList.add("hidden");
    forgetBtn.classList.add("hidden");
    alert("✅ Session forgotten.");
  });

  /* ----------  grid render helpers ---------- */
  function addFile(f) {
    if (filesSet.has(f)) return;
    filesSet.add(f);
    const card = document.createElement("div");
    card.className = "media-card";
    card.innerHTML = `
        <video src="${fullUrl(f)}" controls></video>
        <p>${f}</p>`;
    mediaGrid.prepend(card);
    resumeBtn.classList.remove("hidden");
    forgetBtn.classList.remove("hidden");
  }

  function renderFiles(arr = []) {
    filesSet = new Set(arr);
    mediaGrid.innerHTML = arr.map(f => `
      <div class="media-card">
        <video src="${fullUrl(f)}" controls></video>
        <p>${f}</p>
      </div>`).join("");
    if (arr.length) {
      resumeBtn.classList.remove("hidden");
      forgetBtn.classList.remove("hidden");
    }
  }
});
/* ─────────────────────────────────────────────── */
