/* ───────────────────────────────────────────────
   main.js  –  full file (session‑aware version)
   ─────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  /* ----------  Anonymous‑session helper  ---------- */
  const SESSION_KEY = "gs_session";
  // 1️⃣  try cookie first (set by Flask)  2️⃣  else localStorage
  const cookieMatch = document.cookie.match(/(?:^|;)\s*session=([^;]+)/);
  let session = cookieMatch ? cookieMatch[1] : localStorage.getItem(SESSION_KEY);
  if (!session) {
    // provisional token – server may replace it on first response
    session = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(SESSION_KEY, session);
  }
  // tiny wrapper: same as window.fetch but always adds header
  const apiFetch = (url, opts = {}) => {
    opts.headers = Object.assign({ "X-Session": session }, opts.headers || {});
    return fetch(url, opts).then(async (r) => {
      // if server sent a fresher cookie, store it
      const newMatch = document.cookie.match(/(?:^|;)\s*session=([^;]+)/);
      if (newMatch) {
        session = newMatch[1];
        localStorage.setItem(SESSION_KEY, session);
      }
      return r;
    });
  };

  /* === Quick DOM helper === */
  const $ = (sel) => document.querySelector(sel);

  /* === Element refs === */
  const startBtn      = $("#startBtn");
  const stopBtn       = $("#stopBtn");
  const statusMsg     = $("#statusMsg");
  const preview       = $("#preview");

  const shareWrap     = $("#shareWrap");
  const copyLinkBtn   = $("#copyLink");
  const copySecure    = $("#copySecure");
  const copyPublic    = $("#copyPublic");
  const disablePublic = $("#disablePublic");
  const shareEmail    = $("#shareEmail");

  const openClip  = $("#openClip");
  const clipPanel = $("#clipPanel");
  const clipGo    = $("#clipGo");
  const clipCancel = $("#clipCancel");

  const openEmbed  = $("#openEmbed");
  const embedDlg   = $("#embedModal");
  const embedWidth = $("#embedWidth");
  const embedHeight= $("#embedHeight");
  const embedBox   = $("#embedCode");
  const embedCopy  = $("#embedCopy");
  const embedClose = $("#embedClose");

  const emailDlg    = $("#emailModal");
  const emailInput  = $("#emailTo");
  const emailSend   = $("#emailSend");
  const emailClose  = $("#emailClose");
  const emailStatus = $("#emailStatus");

  /* === Helpers === */
  const isLocal  = ["localhost", "127.0.0.1"].includes(location.hostname);
  const REC_BASE = isLocal ? "/static/recordings/" : "/recordings/";
  const fullUrl  = (f) => `${location.origin}${REC_BASE}${f}`;

  let mediaRecorder, chunks = [], fileName = "", secureUrl = "";

  /* ==========  Recording  ========== */
startBtn.onclick = async () => {
       console.log("✅ Start button was clicked"); // ADD THIS
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video:true,audio:true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const fd   = new FormData().append("video", blob, "recording.webm");

        statusMsg.textContent = "⏫ Uploading…";
        const res = await apiFetch("/upload", { method:"POST", body:fd }).then(r=>r.json());

        if (res.status === "ok") {
          fileName  = res.filename;
          secureUrl = res.url;
          preview.src = fullUrl(fileName);
          preview.classList.remove("hidden");
          shareWrap.classList.remove("hidden");
          statusMsg.innerHTML = ✅ Saved – <a href="${fullUrl(fileName)}" download>Download raw</a>;
        } else {
          statusMsg.textContent = "❌ Upload failed: " + res.error;
        }
        startBtn.disabled = false;
      };

      mediaRecorder.start();
      statusMsg.textContent = "🎬 Recording…";
      startBtn.disabled = true;
      stopBtn.disabled  = false;
    } catch (err) {
      console.error(err);
      alert("Screen‑capture permission denied.");
    }
  };

  stopBtn.onclick = () => {
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.stop();
      stopBtn.disabled = true;
    }
  };

  /* ==========  Share links  ========== */
  copyLinkBtn.onclick = () => {
    if (!fileName) return alert("⚠ No file yet.");
    copy(fullUrl(fileName), copyLinkBtn);
  };

  copySecure?.onclick = async () => {
    if (!fileName) return alert("⚠ No file yet.");
    try {
      const r = await apiFetch(/link/secure/${fileName}).then(x=>x.json());
      if (r.status === "ok") secureUrl = r.url;
      copy(secureUrl, copySecure, "✅ Secure link copied (15 min)");
    } catch { alert("❌ Network error."); }
  };

  copyPublic?.onclick = async () => {
    if (!fileName) return alert("⚠ No file yet.");
    const r = await apiFetch(/link/public/${fileName}).then(x=>x.json());
    if (r.status === "ok") copy(r.url, copyPublic, "✅ Public link copied");
    else alert("❌ "+r.error);
  };

  disablePublic?.onclick = async () => {
    if (!fileName) return alert("⚠ No file yet.");
    const r = await apiFetch(/link/public/${fileName}, {method:"DELETE"}).then(x=>x.json());
    alert(r.status==="ok" ? "✅ Public link disabled." : "❌ "+r.error);
  };

  /* ==========  Share links  ========== */
  copyLinkBtn.onclick = () => {
    if (!fileName) return alert("⚠ No file yet.");
    copy(fullUrl(fileName), copyLinkBtn);
  };

  copySecure?.onclick = async () => {
    if (!fileName) return alert("⚠ No file yet.");
    try {
      const r = await apiFetch(`/link/secure/${fileName}`).then(x=>x.json());
      if (r.status === "ok") secureUrl = r.url;
      copy(secureUrl, copySecure, "✅ Secure link copied (15 min)");
    } catch { alert("❌ Network error."); }
  };

  copyPublic?.onclick = async () => {
    if (!fileName) return alert("⚠ No file yet.");
    const r = await apiFetch(`/link/public/${fileName}`).then(x=>x.json());
    if (r.status === "ok") copy(r.url, copyPublic, "✅ Public link copied");
    else alert("❌ "+r.error);
  };

  disablePublic?.onclick = async () => {
    if (!fileName) return alert("⚠ No file yet.");
    const r = await apiFetch(`/link/public/${fileName}`, {method:"DELETE"}).then(x=>x.json());
    alert(r.status==="ok" ? "✅ Public link disabled." : "❌ "+r.error);
  };

  /* ==========  Email  ========== */
  shareEmail.onclick = () => {
    if (!fileName) return alert("⚠ No recording.");
    emailInput.value = ""; emailStatus.textContent = ""; emailDlg.showModal();
  };
  emailClose.onclick = () => emailDlg.close();

  emailSend.onclick = async () => {
    const to = emailInput.value.trim();
    if (!to) { emailStatus.textContent="❌ Enter e‑mail."; return; }
    emailSend.disabled=true; emailSend.textContent="⏳ Sending…";
    const r = await apiFetch("/send_email", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ to, url: secureUrl||fullUrl(fileName)})
    }).then(x=>x.json()).catch(()=>({status:"fail"}));
    emailStatus.textContent = r.status==="ok" ? "✅ Sent!" : "❌ "+r.error;
    emailSend.disabled=false; emailSend.textContent="📤 Send";
  };

  /* ==========  Clip  ========== */
  openClip.onclick = () => { clipPanel.classList.toggle("hidden"); };
  clipCancel.onclick = () => { clipPanel.classList.add("hidden"); };
  clipGo.onclick = async () => {
    const s=+$("#clipStart").value, e=+$("#clipEnd").value;
    if (!fileName) return alert("⚠ No recording."); if (s>=e) return alert("⚠ Invalid range.");
    clipGo.disabled=true; clipGo.textContent="⏳ Cutting…";
    const r = await apiFetch(`/clip/${fileName}`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({start:s,end:e})
    }).then(x=>x.json());
    if (r.status==="ok") copy(fullUrl(r.clip), clipGo, "✅ Clip link copied!");
    else alert("❌ "+r.error);
    clipGo.disabled=false; clipGo.textContent="📤 Share Clip";
  };

  /* ==========  Embed  ========== */
  openEmbed.onclick = () => {
    if (!fileName) return alert("⚠ No recording.");
    embedBox.value = iframe(); embedDlg.showModal();
  };
  embedWidth.oninput = embedHeight.oninput = () => embedBox.value = iframe();
  embedCopy.onclick = () => copy(embedBox.value, embedCopy);
  embedClose.onclick = () => embedDlg.close();

  /* === utilities === */
  const iframe = () =>
    `<iframe width="${embedWidth.value}" height="${embedHeight.value}" src="${fullUrl(fileName)}" frameborder="0" allowfullscreen></iframe>`;

  const copy = (txt, btn, msg="✅ Copied!") =>
    navigator.clipboard.writeText(txt).then(()=>{
      const p=btn.textContent; btn.textContent=msg; btn.disabled=true;
      setTimeout(()=>{btn.textContent=p;btn.disabled=false;},1800);
    });

});
/* ─────────────────────────────────────────────── */
