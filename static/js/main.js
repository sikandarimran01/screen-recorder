/* ───────────────────────────────────────────────
   main.js – Magic‑link / session‑aware version
   ─────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  /* ─────  Anonymous‑session helper  ───── */
  const SESSION_KEY = "gs_session";
  let session = localStorage.getItem(SESSION_KEY) || crypto.randomUUID().replace(/-/g, "");
  localStorage.setItem(SESSION_KEY, session);

  /** always sends X‑Session and refreshes token if server gives newer cookie */
  const apiFetch = (url, opts = {}) => {
    opts.headers = Object.assign({ "X-Session": session }, opts.headers || {});
    return fetch(url, opts).then(async (r) => {
      /* cookie wins – keeps browser + server in sync */
      const m = document.cookie.match(/(?:^|;\s*)session=([^;]+)/);
      if (m) {
        session = m[1];
        localStorage.setItem(SESSION_KEY, session);
      }
      return r;
    });
  };

  /* ─────  Quick DOM helpers  ───── */
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ----------  Static refs ---------- */
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

  const openClip = $("#openClip");
  const clipPane = $("#clipPanel");
  const clipGo   = $("#clipGo");
  const clipCancel = $("#clipCancel");

  const openEmbed = $("#openEmbed");
  const embedDlg  = $("#embedModal");
  const embedWidth = $("#embedWidth");
  const embedHeight= $("#embedHeight");
  const embedBox  = $("#embedCode");
  const embedCopy = $("#embedCopy");
  const embedClose= $("#embedClose");

  const emailDlg   = $("#emailModal");
  const emailInput = $("#emailTo");
  const emailSend  = $("#emailSend");
  const emailClose = $("#emailClose");
  const emailStat  = $("#emailStatus");

  /* ▲ NEW resume / forget UI elements (added to HTML) */
  const resumeBtn  = $("#resumeBtn");
  const forgetBtn  = $("#forgetSession");
  const filesPanel = document.createElement("div");
  filesPanel.id = "filesPanel";
  filesPanel.className = "panel hidden";
  document.body.appendChild(filesPanel);

  /* ----------  Helpers ---------- */
  const isLocal  = ["localhost","127.0.0.1"].includes(location.hostname);
  const REC_BASE = isLocal ? "/static/recordings/" : "/recordings/";
  const fullUrl  = (f) => `${location.origin}${REC_BASE}${f}`;

  let mediaRecorder, chunks = [], fileName = "", secureUrl = "";

  /* ──────────  INITIALISE RESUME UI  ────────── */
  (async () => {
    try {
      const r = await apiFetch("/session/files").then(x=>x.json());
      if (r.status === "ok" && r.files.length) {
        renderFiles(r.files);
        resumeBtn.classList.remove("hidden");
        forgetBtn.classList.remove("hidden");
      }
    } catch {/* silent – very first visit */}
  })();

  resumeBtn?.addEventListener("click", () => filesPanel.classList.toggle("hidden"));
  forgetBtn?.addEventListener("click", async () => {
    await apiFetch("/session/forget", { method:"POST" });
    localStorage.removeItem(SESSION_KEY);
    filesPanel.innerHTML = "";
    filesPanel.classList.add("hidden");
    resumeBtn.classList.add("hidden");
    forgetBtn.classList.add("hidden");
    alert("✅ Session forgotten – local history cleared.");
  });

  function renderFiles(arr){
    filesPanel.innerHTML = `<h3>Your recordings</h3><ul>${arr.map(f=>(
      `<li><a href="${fullUrl(f)}" target="_blank">${f}</a></li>`)).join("")}</ul>`;
  }

  /* ==========  Screen‑record controls  ========== */
  startBtn.onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];

      mediaRecorder.ondataavailable = e => chunks.push(e.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, {type:"video/webm"});
        const fd   = new FormData();
        fd.append("video", blob, "recording.webm");

        statusMsg.textContent = "⏫ Uploading…";
        const res = await apiFetch("/upload", {method:"POST",body:fd}).then(r=>r.json());

        if (res.status === "ok") {
          fileName  = res.filename;
          secureUrl = res.url;
          preview.src = fullUrl(fileName);
          preview.classList.remove("hidden");
          shareWrap.classList.remove("hidden");
          statusMsg.innerHTML = `✅ Saved – <a href="${fullUrl(fileName)}" download>Download raw</a>`;

          /* add to files list immediately */
          renderFiles([fileName, ...Array.from(filesPanel.querySelectorAll("li a")).map(a=>a.textContent)]);
          resumeBtn.classList.remove("hidden");
          forgetBtn.classList.remove("hidden");
        } else {
          statusMsg.textContent = "❌ Upload failed: "+res.error;
        }
        startBtn.disabled=false;
      };

      mediaRecorder.start();
      statusMsg.textContent = "🎬 Recording…";
      startBtn.disabled=true; stopBtn.disabled=false;
    } catch(err){ alert("Screen‑capture denied / unsupported."); }
  };

  stopBtn.onclick = () => {
    if (mediaRecorder?.state==="recording"){ mediaRecorder.stop(); stopBtn.disabled=true; }
  };

  /* ==========  Share links ========== */
  copyLinkBtn.onclick = () => !fileName ? alert("⚠ Nothing yet.") : copy(fullUrl(fileName),copyLinkBtn);
  copySecure.onclick  = async () => {
    if(!fileName) return alert("⚠ Nothing yet.");
    const r = await apiFetch(`/link/secure/${fileName}`).then(x=>x.json());
    if(r.status==="ok")secureUrl=r.url;
    copy(secureUrl,copySecure,"✅ Secure (15 min) copied");
  };
  copyPublic.onclick  = async () => sharePublic(true);
  disablePub.onclick  = async () => sharePublic(false);

  async function sharePublic(create){
    if(!fileName) return alert("⚠ Nothing yet.");
    const r = await apiFetch(`/link/public/${fileName}`,{method:create?"GET":"DELETE"}).then(x=>x.json());
    alert(r.status==="ok"?(create?"✅ Public URL copied to clipboard":"✅ Public link disabled"):("❌ "+r.error));
    if(create && r.url) copy(r.url, copyPublic);
  }

  /* ==========  Email  ========== */
  shareEmail.onclick = () => !fileName ? alert("⚠ Nothing yet.") : (emailInput.value="",emailStat.textContent="",emailDlg.showModal());
  emailClose.onclick = () => emailDlg.close();
  emailSend.onclick  = async () => {
    const to = emailInput.value.trim();
    if(!to) return emailStat.textContent="❌ Enter e‑mail.";
    emailSend.disabled=true; emailSend.textContent="⏳ Sending…";
    const r = await apiFetch("/send_email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to,url:secureUrl||fullUrl(fileName)})}).then(x=>x.json()).catch(()=>({status:"fail"}));
    emailStat.textContent = r.status==="ok"?"✅ Sent!":"❌ "+r.error;
    emailSend.disabled=false; emailSend.textContent="📤 Send";
  };

  /* ==========  Clip  ========== */
  openClip.onclick   = () => clipPane.classList.toggle("hidden");
  clipCancel.onclick = () => clipPane.classList.add("hidden");
  clipGo.onclick     = async () => {
    const s=+$("#clipStart").value, e=+$("#clipEnd").value;
    if(!fileName) return alert("⚠ Nothing yet.");
    if(s>=e)      return alert("⚠ Invalid range.");
    clipGo.disabled=true; clipGo.textContent="⏳ Cutting…";
    const r = await apiFetch(`/clip/${fileName}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({start:s,end:e})}).then(x=>x.json());
    if(r.status==="ok") copy(fullUrl(r.clip),clipGo,"✅ Clip copied!");
    else alert("❌ "+r.error);
    clipGo.disabled=false; clipGo.textContent="📤 Share Clip";
  };

  /* ==========  Embed  ========== */
  openEmbed.onclick = () => !fileName ? alert("⚠ Nothing yet.") : (embedBox.value=iframe(),embedDlg.showModal());
  embedWidth.oninput = embedHeight.oninput = ()=>embedBox.value=iframe();
  embedCopy.onclick = () => copy(embedBox.value,embedCopy);
  embedClose.onclick = () => embedDlg.close();

  /* ───── helpers ───── */
  const iframe = () =>
    `<iframe width="${embedWidth.value}" height="${embedHeight.value}" src="${fullUrl(fileName)}" frameborder="0" allowfullscreen></iframe>`;

  const copy = (txt, btn, msg="✅ Copied!") =>
    navigator.clipboard.writeText(txt).then(()=>{
      const p=btn.textContent; btn.textContent=msg; btn.disabled=true;
      setTimeout(()=>{btn.textContent=p;btn.disabled=false;},1700);
    });
});
/* ─────────────────────────────────────────────── */
