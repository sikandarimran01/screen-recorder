document.addEventListener("DOMContentLoaded", () => {
  // --- Helpers ---
  const $ = (s) => document.querySelector(s);
  const copy = (text, btn) => {
    navigator.clipboard.writeText(text).then(() => {
      if (!btn) return;
      const prevHTML = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = prevHTML;
        btn.disabled = false;
      }, 1700);
    });
  };
  // Simplified fetch wrapper, relies on browser's default cookie handling
  const apiFetch = (url, opts = {}) => fetch(url, opts);
  const fullUrl = (f) => `${location.origin}/recordings/${f}`;

  // --- DOM References ---
  const startBtn = $("#startBtn"), stopBtn = $("#stopBtn");
  const statusMsg = $("#statusMsg"), previewArea = $("#previewArea"), preview = $("#preview");
  const actionsPanel = $("#actionsPanel"), clipPanel = $("#clipPanel"), filesPanel = $("#filesPanel");
  const mediaGrid = $("#mediaGrid"), resumeBtn = $("#resumeBtn"), forgetBtn = $("#forgetSession");
  
  // --- State ---
  let mediaRecorder, chunks = [], currentFile = null;

  // --- Core Functions ---
  const activateFile = (filename) => {
    if (!filename) {
      previewArea.classList.add("hidden");
      currentFile = null;
      return;
    }
    currentFile = filename;
    preview.src = fullUrl(filename);
    previewArea.classList.remove("hidden");
    renderActionsPanel(filename);
    // Highlight the selected card in the grid
    document.querySelectorAll(".media-card").forEach(card => {
      card.classList.toggle("selected", card.dataset.filename === filename);
    });
    // Scroll the preview area into view if on a small screen
    previewArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const renderActionsPanel = (filename) => {
    actionsPanel.innerHTML = `
      <a href="/download/${filename}" class="btn" download><i class="fa-solid fa-download"></i> Download</a>
      <button class="btn" data-action="secure-link"><i class="fa-solid fa-lock"></i> Secure Link</button>
      <button class="btn" data-action="public-link"><i class="fa-solid fa-globe"></i> Public Link</button>
      <button class="btn" data-action="email"><i class="fa-solid fa-envelope"></i> Email</button>
      <button class="btn" data-action="clip"><i class="fa-solid fa-scissors"></i> Trim</button>
      <button class="btn cancel" data-action="delete"><i class="fa-solid fa-trash-can"></i> Delete</button>
    `;
  };

  const addFileToGrid = (filename) => {
    if (document.querySelector(`.media-card[data-filename="${filename}"]`)) return;
    const card = document.createElement("div");
    card.className = "media-card";
    card.dataset.filename = filename;
    // Use substring to make the filename in the UI cleaner
    card.innerHTML = `<video src="${fullUrl(filename)}#t=0.1" preload="metadata"></video><p>${filename.substring(10)}</p>`;
    mediaGrid.prepend(card);
    card.addEventListener("click", () => activateFile(filename));
  };
  
  const renderFiles = (files = []) => {
    mediaGrid.innerHTML = "";
    if (files.length > 0) {
      files.forEach(addFileToGrid);
      filesPanel.classList.remove("hidden");
      resumeBtn.classList.remove("hidden");
      forgetBtn.classList.remove("hidden");
    } else {
      filesPanel.classList.add("hidden");
      resumeBtn.classList.add("hidden");
      forgetBtn.classList.add("hidden");
    }
  };

  // --- Initial Load ---
  (async () => {
    try {
      const { files = [] } = await apiFetch("/session/files").then(r => r.json());
      renderFiles(files.reverse()); // Show newest first
    } catch { /* Ignore first-visit errors */ }
  })();

  // --- Event Listeners ---
  startBtn?.addEventListener("click", async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { mediaSource: "screen" }, audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      chunks = [];
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const fd = new FormData();
        fd.append("video", blob, "recording.webm");

        statusMsg.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading & processing...`;
        const res = await apiFetch("/upload", { method: "POST", body: fd }).then(r => r.json());

        if (res.status === "ok") {
          statusMsg.textContent = `✅ Recording saved!`;
          addFileToGrid(res.filename);
          activateFile(res.filename);
        } else {
          statusMsg.textContent = "❌ Upload failed: " + res.error;
        }
        startBtn.disabled = false;
      };
      mediaRecorder.start();
      // Automatically stop recording if user clicks the browser's native "Stop sharing" button
      stream.getVideoTracks()[0].onended = () => stopBtn.click();
      statusMsg.textContent = "🎬 Recording…";
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      alert("Screen capture permission was denied or is not supported. " + err.message);
    }
  });

  stopBtn?.addEventListener("click", () => {
    if (mediaRecorder?.state === "recording" || mediaRecorder?.state === "paused") {
      mediaRecorder.stop();
      stopBtn.disabled = true;
    }
  });

  resumeBtn?.addEventListener("click", () => {
      filesPanel.classList.toggle("hidden");
      filesPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  forgetBtn?.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to forget this session? This will clear your list of recordings from this browser.")) return;
    await apiFetch("/session/forget", { method: "POST" });
    renderFiles([]);
    activateFile(null);
    alert("✅ Session forgotten.");
  });

  // Delegated event listener for the dynamic actions panel
  actionsPanel.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    if (!currentFile) return;

    switch (action) {
      case "secure-link": {
        const r = await apiFetch(`/link/secure/${currentFile}`).then(r => r.json());
        if (r.status === "ok") copy(r.url, button);
        break;
      }
      case "public-link": {
        const r = await apiFetch(`/link/public/${currentFile}`).then(r => r.json());
        if (r.status === "ok") {
            copy(r.url, button);
            button.innerHTML = `<i class="fa-solid fa-link"></i> Public Link Active`;
        }
        break;
      }
      case "email": {
        $("#emailTo").value = "";
        $("#emailStatus").textContent = "";
        $("#emailModal").showModal();
        break;
      }
      case "clip": {
        clipPanel.classList.remove("hidden");
        clipPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
      case "delete": {
        if (!confirm(`Are you sure you want to permanently delete ${currentFile}? This cannot be undone.`)) return;
        const r = await apiFetch(`/delete/${currentFile}`, { method: "POST" }).then(r => r.json());
        if (r.status === "ok") {
          const card = $(`.media-card[data-filename="${currentFile}"]`);
          if (card) {
            card.classList.add("deleting");
            card.addEventListener("animationend", () => card.remove());
          }
          activateFile(null); // Hide preview
        } else {
          alert("❌ Delete failed: " + r.error);
        }
        break;
      }
    }
  });
  
  // Clip Panel Logic
  $("#clipCancel")?.addEventListener("click", () => clipPanel.classList.add("hidden"));
  $("#clipGo")?.addEventListener("click", async () => {
    const s = +$("#clipStart").value, e = +$("#clipEnd").value;
    if (!currentFile) return alert("⚠ No recording selected.");
    if (s >= e) return alert("⚠ Invalid range.");

    const btn = $("#clipGo");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Cutting...`;

    const r = await apiFetch(`/clip/${currentFile}`, {
      method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ start: s, end: e })
    }).then(x => x.json());

    if (r.status === "ok") {
      addFileToGrid(r.clip);
      activateFile(r.clip);
      clipPanel.classList.add("hidden");
    } else {
      alert("❌ " + r.error);
    }
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-share-nodes"></i> Create & Share Clip`;
  });

  // Email Modal Logic
  $("#emailClose")?.addEventListener("click", () => $("#emailModal").close());
  $("#emailSend")?.addEventListener("click", async () => {
    const to = $("#emailTo").value.trim();
    if (!to) return ($("#emailStatus").textContent = "❌ Enter an e-mail.");
    
    const btn = $("#emailSend");
    btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;

    const linkRes = await apiFetch(`/link/secure/${currentFile}`).then(r => r.json());
    if (linkRes.status !== 'ok') {
        alert('Could not generate a secure link to email.');
        btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send`;
        return;
    }

    const r = await apiFetch("/send_email", {
      method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ to, url: linkRes.url })
    }).then(x => x.json());

    $("#emailStatus").textContent = r.status === "ok" ? "✅ Sent!" : "❌ " + (r.error || "Failed to send");
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send`;
    if (r.status === "ok") setTimeout(() => $("#emailModal").close(), 1500);
  });
});
