/* ───────────────────────────────────────────────
   main.js  – GrabScreen front‑end (secure‑link aware)
   ─────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  /* ── DOM helper ── */
  const $ = (sel) => document.querySelector(sel);

  /* ── Element handles ── */
  const startBtn   = $("#startBtn");
  const stopBtn    = $("#stopBtn");
  const statusMsg  = $("#statusMsg");
  const preview    = $("#preview");

  const shareWrap  = $("#shareWrap");
  const copyLinkBtn = $("#copyLink");
  const copySecure  = $("#copySecure");
  const copyPublic  = $("#copyPublic");
  const disablePublic = $("#disablePublic");
  const shareEmail = $("#shareEmail");

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

  const emailDlg   = $("#emailModal");
  const emailInput = $("#emailTo");
  const emailSend  = $("#emailSend");
  const emailClose = $("#emailClose");
  const emailStatus= $("#emailStatus");

  /* ── Helpers ── */
  const isLocal  = ["localhost", "127.0.0.1"].includes(location.hostname);
  const REC_BASE = isLocal ? "/static/recordings/" : "/recordings/";
  const fullUrl  = (f) => `${location.origin}${REC_BASE}${f}`;

  let mediaRecorder, chunks = [];
  let fileName  = "";
  let secureUrl = "";       // cached /secure/<token> link (15‑min lifetime)

  /* ========== Screen recording ========== */
  startBtn.onclick = async () => {
    console.log("🎬 Start button clicked");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:true });
      console.log("✅ Got stream", stream);

      mediaRecorder = new MediaRecorder(stream);
      chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type:"video/webm" });
        const fd   = new FormData();
        fd.append("video", blob, "recording.webm");

        statusMsg.textContent = "⏫ Uploading…";
        const res = await fetch("/upload", { method:"POST", body:fd }).then(r=>r.json());
        console.log("📤 Upload result:", res);

        if (res.status === "ok") {
          fileName  = res.filename;
          secureUrl = "";              // reset – will be fetched on demand
          const url = fullUrl(fileName);

          preview.src = url;
          preview.classList.remove("hidden");
          shareWrap.classList.remove("hidden");
          statusMsg.innerHTML = `✅ Saved – <a href="${url}" download>Download</a>`;
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
      console.error("❌ Recording error:", err);
      alert("Screen‑capture permission denied.");
    }
  };

  stopBtn.onclick = () => {
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.stop();
      stopBtn.disabled = true;
    }
  };

  /* ========== Share links ========== */
  copyLinkBtn.onclick = () => {
    if (!fileName) return alert("⚠ No file to share yet.");
    copyToClipboard(fullUrl(fileName), copyLinkBtn);
  };

  /* –– Secure link –– */
  copySecure?.addEventListener("click", async () => {
    if (!fileName) return alert("⚠ No file to share yet.");

    // If we already fetched a token during this 15‑min window, reuse it.
    if (secureUrl) {
      copyToClipboard(secureUrl, copySecure, "✅ Secure link copied (15 min)");
      return;
    }

    try {
      const res = await fetch(`/link/secure/${fileName}`).then(r=>r.json());
      console.log("🔐 Secure link response:", res);
      if (res.status === "ok") {
        secureUrl = res.url;
        copyToClipboard(secureUrl, copySecure, "✅ Secure link copied (15 min)");
      } else {
        alert("❌ " + res.error);
      }
    } catch (err) {
      console.error("❌ Secure link error:", err);
      alert("❌ Network error");
    }
  });

  /* –– Public link –– */
  copyPublic?.addEventListener("click", async () => {
    if (!fileName) return alert("
