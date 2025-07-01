/* ─────────────────────────────────────────────── */
/*  main.js — full file (replace current version) */
/* ─────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  /* =============   DOM helpers   ============= */
  const $ = (sel) => document.querySelector(sel);

  /* =============   Elements   ================ */
  // Share‑related buttons
  const copySecure    = $("#copySecure");   // 🔒 15‑min link
  const copyPublic    = $("#copyPublic");   // 🌐 permanent link
  const disablePublic = $("#disablePublic");

  const startBtn   = $("#startBtn");
  const stopBtn    = $("#stopBtn");
  const statusMsg  = $("#statusMsg");
  const preview    = $("#preview");

  const shareWrap  = $("#shareWrap");
  const copyLinkBtn = $("#copyLink");
  const shareEmail = $("#shareEmail");

  const openClip   = $("#openClip");
  const clipPanel  = $("#clipPanel");
  const clipGo     = $("#clipGo");
  const clipCancel = $("#clipCancel");

  const openEmbed  = $("#openEmbed");
  const embedDlg   = $("#embedModal");
  const embedWidth = $("#embedWidth");
  const embedHeight = $("#embedHeight");
  const embedBox   = $("#embedCode");
  const embedCopy  = $("#embedCopy");
  const embedClose = $("#embedClose");

  const emailDlg    = $("#emailModal");
  const emailInput  = $("#emailTo");
  const emailSend   = $("#emailSend");
  const emailClose  = $("#emailClose");
  const emailStatus = $("#emailStatus");

  /* ----------  Helpers: recording base path ---------- */
  const isLocal  = ["localhost", "127.0.0.1"].includes(location.hostname);
  const REC_BASE = isLocal ? "/static/recordings/" : "/recordings/";
  const fullUrl  = (fname) => `${location.origin}${REC_BASE}${fname}`;

  let mediaRecorder;
  let chunks = [];
  let fileName = ""; // set after upload

  /* ----------  Screen‑record controls  ---------- */
  startBtn.onclick = async () => {
  console.log("🎬 Start button clicked");  // ✅ Button click confirmed
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

      mediaRecorder = new MediaRecorder(stream);
      chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const fd = new FormData();
        fd.append("video", blob, "recording.webm");

        statusMsg.textContent = "⏫ Uploading…";
        const res = await fetch("/upload", { method: "POST", body: fd }).then((r) => r.json());
        console.log("📤 Upload result:", res);

        if (res.status === "ok") {
          fileName = res.filename;
          const url = fullUrl(fileName);
          preview.src = url;
          preview.classList.remove("hidden");
          shareWrap.classList.remove("hidden");
          statusMsg.innerHTML = `✅ Saved <a href="${url}" download>Download</a>`;
        } else {
          alert("❌ Upload failed");
        }
        startBtn.disabled = false;
      };

      mediaRecorder.start();
      statusMsg.textContent = "🎬 Recording…";
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      console.error(err);
      alert("Screen‑capture permission denied.");
    }
  };

  stopBtn.onclick = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      stopBtn.disabled = true;
    }
  };

  /* ----------  Share: raw download link  ---------- */
  copyLinkBtn.onclick = () => {
    if (!fileName) return alert("⚠ No file to share yet.");
    copyToClipboard(fullUrl(fileName), copyLinkBtn);
  };

  /* ----------  🔒 Secure Link (15‑min)  ---------- */
  copySecure &&
    (copySecure.onclick = async () => {
      if (!fileName) {
        alert("⚠ No file to share yet.");
        console.warn("❌ Secure link clicked with empty fileName");
        return;
      }

      try {
        const res = await fetch(`/link/secure/${fileName}`).then((r) => r.json());
        console.log("🔐 Secure link response:", res);

        if (res.status === "ok") {
          copyToClipboard(res.url, copySecure, "✅ Secure link copied (15 min)");
        } else {
          console.error("❌ Secure link error from server:", res.error);
          alert("❌ " + res.error);
        }
      } catch (err) {
        console.error("❌ Secure link fetch failed:", err);
        alert("❌ Network error");
      }
    });

  /* ----------  🌐 Public Link (permanent) ---------- */
  copyPublic &&
    (copyPublic.onclick = async () => {
      if (!fileName) return alert("⚠ No file to share yet.");
      const res = await fetch(`/link/public/${fileName}`).then((r) => r.json());
      if (res.status === "ok") {
        copyToClipboard(res.url, copyPublic, "✅ Public link copied");
      } else {
        alert("❌ " + res.error);
      }
    });

  /* ----------  ❌ Disable Public Link  ---------- */
  disablePublic &&
    (disablePublic.onclick = async () => {
      if (!fileName) return alert("⚠ No public link to disable.");
      const res = await fetch(`/link/public/${fileName}`, {
        method: "DELETE",
      }).then((r) => r.json());
      if (res.status === "ok") {
        alert("✅ Public link disabled.");
      } else {
        alert("❌ " + res.error);
      }
    });

  /* ----------  Email modal  ---------- */
  shareEmail.onclick = () => {
    if (!fileName) return alert("⚠ No recording available.");
    emailInput.value = "";
    emailStatus.textContent = "";
    emailDlg.showModal();
  };
  emailClose.onclick = () => emailDlg.close();

  emailSend.onclick = async () => {
    const to = emailInput.value.trim();
    if (!to) {
      emailStatus.textContent = "❌ Please enter a valid e‑mail.";
      emailStatus.style.color = "var(--danger)";
      return;
    }
    emailSend.disabled = true;
    emailSend.textContent = "⏳ Sending…";

    try {
      const res = await fetch("/send_email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, url: fullUrl(fileName) }),
      }).then((r) => r.json());

      if (res.status === "ok") {
        emailStatus.textContent = "✅ Email sent!";
        emailStatus.style.color = "var(--success)";
      } else {
        emailStatus.textContent = "❌ Failed: " + res.error;
        emailStatus.style.color = "var(--danger)";
      }
    } catch {
      emailStatus.textContent = "❌ Network error.";
      emailStatus.style.color = "var(--danger)";
    } finally {
      emailSend.disabled = false;
      emailSend.textContent = "📤 Send";
    }
  };

  /* ----------  Clip panel  ---------- */
  openClip.onclick = () => {
    const hidden = clipPanel.classList.toggle("hidden");
    clipPanel.classList.toggle("fade-in", !hidden);
  };
  clipCancel.onclick = () => {
    clipPanel.classList.add("hidden");
    clipPanel.classList.remove("fade-in");
  };

  clipGo.onclick = async () => {
    const start = +$("#clipStart").
