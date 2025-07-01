/* ───────────────────────────────────────────────
   main.js – full file (replace current version)
   ─────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  /* === Quick DOM helper === */
  const $ = (sel) => document.querySelector(sel);

  /* === Mobile / tablet guard =================== */
  const isTouch = /Mobi|Android|iPad|iPhone/i.test(navigator.userAgent);
  if (isTouch) {
    // Disable recorder UI
    $("#startBtn")?.setAttribute("disabled", "true");

    // Simple branded overlay
    const blocker = document.createElement("div");
    blocker.style.cssText = `
      position:fixed; inset:0; background:#000000d9;
      display:flex; justify-content:center; align-items:center;
      z-index:9999; font-family:system-ui, sans-serif; color:#fff;
      text-align:center; padding:2rem;
    `;
    blocker.innerHTML = `
      <div style="
        max-width:420px; background:#1f1f1f; border-radius:14px;
        padding:2rem 1.75rem; box-shadow:0 0 18px #000;
      ">
        <h2 style="font-size:1.45rem; margin-bottom:1rem;">
          📵 Not Supported on Mobile
        </h2>
        <p style="font-size:1rem; line-height:1.55;">
          Screen recording isn’t available on phones or tablets.<br>
          Please switch to a desktop or laptop browser for full functionality.
        </p>
        <button style="
          margin-top:1.75rem; padding:0.8rem 1.6rem; border:none;
          background:#00c896; color:#fff; border-radius:8px;
          font-size:1rem; cursor:pointer;">
          🔁 Got it — I’ll try on desktop
        </button>
      </div>
    `;
    blocker.querySelector("button").onclick = () => blocker.remove();
    document.body.appendChild(blocker);
  }

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

  /* === Helpers === */
  const isLocal  = ["localhost", "127.0.0.1"].includes(location.hostname);
  const REC_BASE = isLocal ? "/static/recordings/" : "/recordings/";
  const fullUrl  = (fname) => `${location.origin}${REC_BASE}${fname}`;

  let mediaRecorder, chunks = [], fileName = "";
  let secureUrl = ""; // will hold /secure/<token> link

  /* ========== Screen‑record controls ========== */
  startBtn?.addEventListener("click", async () => {
    console.log("🎬 Start button clicked");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      console.log("✅ Got stream", stream);

      mediaRecorder = new MediaRecorder(stream);
      chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const fd   = new FormData();
        fd.append("video", blob, "recording.webm");

        statusMsg.textContent = "⏫ Uploading…";
        const res = await fetch("/upload", { method: "POST", body: fd })
                            .then((r) => r.json());
        console.log("📤 Upload result:", res);

        if (res.status === "ok") {
          fileName  = res.filename;
          secureUrl = res.url; // absolute secure link

          const raw = fullUrl(fileName);
          preview.src = raw;
          preview.classList.remove("hidden");
          shareWrap.classList.remove("hidden");
          statusMsg.innerHTML =
            `✅ Saved – <a href="${raw}" download>Download raw</a>`;
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
  });

  stopBtn?.addEventListener("click", () => {
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.stop();
      stopBtn.disabled = true;
    }
  });

  /* ========== Share links ========== */
  copyLinkBtn?.addEventListener("click", () => {
    if (!fileName) return alert("⚠ No file to share yet.");
    copyToClipboard(fullUrl(fileName), copyLinkBtn);
  });

  copySecure?.addEventListener("click", async () => {
    if (!fileName) return alert("⚠ No file to share yet.");
    try {
      const res = await fetch(`/link/secure/${fileName}`).then((r) => r.json());
      secureUrl = res.status === "ok" ? res.url : secureUrl;
      copyToClipboard(secureUrl, copySecure, "✅ Secure link copied (15 min)");
    } catch (err) {
      console.error("❌ Secure link error:", err);
      alert("❌ Could not generate secure link");
    }
  });

  copyPublic?.addEventListener("click", async () => {
    if (!fileName) return alert("⚠ No file to share yet.");
    const res = await fetch(`/link/public/${fileName}`).then((r) => r.json());
    if (res.status === "ok") {
      copyToClipboard(res.url, copyPublic, "✅ Public link copied");
    } else {
      alert("❌ " + res.error);
    }
  });

  disablePublic?.addEventListener("click", async () => {
    if (!fileName) return alert("⚠ No public link to disable.");
    const res = await fetch(`/link/public/${fileName}`, { method: "DELETE" })
                       .then((r) => r.json());
    alert(res.status === "ok" ? "✅ Public link disabled." : "❌ " + res.error);
  });

  /* ========== Email modal ========== */
  shareEmail?.addEventListener("click", () => {
    if (!fileName) return alert("⚠ No recording available.");
    emailInput.value = "";
    emailStatus.textContent = "";
    emailDlg.showModal();
  });
  emailClose?.addEventListener("click", () => emailDlg.close());

  emailSend?.addEventListener("click", async () => {
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
        body: JSON.stringify({ to, url: secureUrl || fullUrl(fileName) }),
      }).then((r) => r.json());

      emailStatus.textContent =
        res.status === "ok" ? "✅ Email sent!" : "❌ " + res.error;
      emailStatus.style.color =
        res.status === "ok" ? "var(--success)" : "var(--danger)";
    } catch {
      emailStatus.textContent = "❌ Network error.";
      emailStatus.style.color = "var(--danger)";
    } finally {
      emailSend.disabled = false;
      emailSend.textContent = "📤 Send";
    }
  });

  /* ========== Clip panel ========== */
  openClip?.addEventListener("click", () => {
    const hidden = clipPanel.classList.toggle("hidden");
    clipPanel.classList.toggle("fade-in", !hidden);
  });
  clipCancel?.addEventListener("click", () => {
    clipPanel.classList.add("hidden");
    clipPanel.classList.remove("fade-in");
  });

  clipGo?.addEventListener("click", async () => {
    const start = +$("#clipStart").value;
    const end   = +$("#clipEnd").value;
    if (!fileName) return alert("⚠ No recording to clip.");
    if (start >= end) return alert("⚠ Invalid range.");

    clipGo.disabled = true;
    clipGo.textContent = "⏳ Cutting…";

    const res = await fetch(`/clip/${fileName}`, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ start, end })
    }).then((r) => r.json());

    if (res.status === "ok") {
      const url = fullUrl(res.clip);
      copyToClipboard(url, clipGo, "✅ Clip link copied!");
    } else {
      alert("❌ Clip failed: " + res.error);
    }
    clipGo.disabled = false;
    clipGo.textContent = "📤 Share Clip";
  });

  /* ========== Embed modal ========== */
  openEmbed?.addEventListener("click", () => {
    if (!fileName) return alert("⚠ No recording to embed.");
    embedBox.value = makeIframe();
    embedDlg.showModal();
  });
  embedWidth.oninput = embedHeight.oninput = () =>
    (embedBox.value = makeIframe());
  embedCopy?.addEventListener("click", () =>
    copyToClipboard(embedBox.value, embedCopy, "✅ Copied!"));
  embedClose?.addEventListener("click", () => embedDlg.close());

  /* === Helper fns === */
  const makeIframe = () =>
    `<iframe width="${embedWidth.value}" height="${embedHeight.value}" src="${fullUrl(
      fileName
    )}" frameborder="0" allowfullscreen></iframe>`;

  const copyToClipboard = (text, btn, msg = "✅ Copied!") => {
    navigator.clipboard.writeText(text).then(
      () => {
        const prev = btn.textContent;
        btn.textContent = msg;
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = prev;
          btn.disabled = false;
        }, 2000);
      },
      () => alert("❌ Copy failed")
    );
  };
});
/* ─────────────────────────────────────────────── */
