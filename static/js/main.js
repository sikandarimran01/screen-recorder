document.addEventListener("DOMContentLoaded", () => {
  // --- Helpers & State (Unchanged) ---
  const $ = (s) => document.querySelector(s);
  const copy = (text, btn) => {
    navigator.clipboard.writeText(text).then(() => {
      if (!btn) return;
      const prevHTML = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
      btn.disabled = true;
      setTimeout(() => { btn.innerHTML = prevHTML; btn.disabled = false; }, 1700);
    });
  };
  const apiFetch = (url, opts = {}) => fetch(url, opts);
  const fullUrl = (f) => `${location.origin}/recordings/${f}`;
  
  // --- DOM References (Unchanged) ---
  const recorderView = $("#recorderView"), privacyView = $("#privacyView"), contactView = $("#contactView");
  const startBtn = $("#startBtn"), stopBtn = $("#stopBtn");
  const statusMsg = $("#statusMsg"), previewArea = $("#previewArea"), preview = $("#preview");
  const actionsPanel = $("#actionsPanel"), clipPanel = $("#clipPanel"), filesPanel = $("#filesPanel");
  const mediaGrid = $("#mediaGrid"), resumeBtn = $("#resumeBtn"), forgetBtn = $("#forgetSession");
  const trimSliderEl = $("#trim-slider"), trimStartTime = $("#trim-start-time"), trimEndTime = $("#trim-end-time");

  // --- State ---
  let mediaRecorder, chunks = [], currentFile = null;
  let trimSlider = null;

  // --- Time formatting helper ---
  const formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '00:00.0';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    const ms = Math.floor((seconds - Math.floor(seconds)) * 10);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${ms}`;
  };
  
  // --- SPA View Management (Unchanged) ---
  const showView = (viewName) => {
    recorderView.classList.add("hidden");
    privacyView.classList.add("hidden");
    contactView.classList.add("hidden");
    if (viewName === 'recorder') recorderView.classList.remove("hidden");
    else if (viewName === 'privacy') privacyView.classList.remove("hidden");
    else if (viewName === 'contact') contactView.classList.remove("hidden");
  };
  $("#showPrivacyLink").addEventListener("click", (e) => { e.preventDefault(); showView('privacy'); });
  $("#showContactLink").addEventListener("click", (e) => { e.preventDefault(); showView('contact'); });
  document.querySelectorAll(".back-btn").forEach(btn => btn.addEventListener("click", () => showView('recorder')));
  
  // --- Core Functions (Unchanged) ---
  const activateFile = (filename) => { /* ... */ };
  const renderActionsPanel = (filename) => { /* ... */ };
  const addFileToGrid = (filename) => { /* ... */ };
  const renderFiles = (files = []) => { /* ... */ };
  (async () => { try { const { files = [] } = await apiFetch("/session/files").then(r => r.json()); renderFiles(files.reverse()); } catch {} })();
  
  // --- Main Event Listeners (Unchanged) ---
  startBtn?.addEventListener("click", async () => { /* ... */ });
  stopBtn?.addEventListener("click", () => { /* ... */ });
  resumeBtn?.addEventListener("click", () => { /* ... */ });
  forgetBtn?.addEventListener("click", async () => { /* ... */ });
  actionsPanel.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    const action = button.dataset.action;
    if (!currentFile) return;
    if (action === "clip") {
      setupTrimSlider();
    }
    // ... other actions are the same
  });
  
  // --- Trimmer Slider Logic ---

  // UPDATED: More robust setup function
  const setupTrimSlider = () => {
    // Check if duration is a valid, finite number.
    if (!preview.duration || !isFinite(preview.duration)) {
      statusMsg.textContent = "⏳ Waiting for video metadata to load...";
      
      // Define the handler function so we can remove it later if needed
      const onMetadataLoaded = () => {
        statusMsg.textContent = ""; // Clear the message
        setupTrimSlider(); // Retry setup
      };
      
      preview.addEventListener('loadedmetadata', onMetadataLoaded, { once: true });
      return; // Stop execution until metadata is loaded
    }
    
    // If we reach here, the duration is valid.
    if (trimSlider) {
      trimSlider.destroy();
    }

    const videoDuration = preview.duration;
    const startValues = [0, Math.min(10, videoDuration)];

    trimSlider = noUiSlider.create(trimSliderEl, {
      start: startValues,
      connect: true,
      range: {
        'min': 0,
        'max': videoDuration
      },
      step: 0.1,
    });

    trimSlider.on('update', (values) => {
      const [start, end] = values.map(v => parseFloat(v));
      trimStartTime.textContent = formatTime(start);
      trimEndTime.textContent = formatTime(end);
    });

    trimSlider.on('slide', (values, handle) => {
        preview.currentTime = parseFloat(values[handle]);
    });

    clipPanel.classList.remove("hidden");
    clipPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  $("#clipCancel")?.addEventListener("click", () => {
    clipPanel.classList.add("hidden");
    // Clean up just in case
    if (trimSlider) {
      trimSlider.destroy();
      trimSlider = null;
    }
    // If the metadata listener was added but hasn't fired, remove it to prevent memory leaks
    preview.removeEventListener('loadedmetadata', setupTrimSlider);
    statusMsg.textContent = ""; // Clear any waiting messages
  });

  $("#clipGo")?.addEventListener("click", async () => {
    if (!currentFile || !trimSlider) return alert("⚠ Trimmer not initialized.");
    const [start, end] = trimSlider.get().map(v => parseFloat(v));
    if (start >= end) return alert("⚠ Invalid range.");

    const btn = $("#clipGo");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Cutting...`;
    
    const r = await apiFetch(`/clip/${currentFile}`, {
      method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ start, end })
    }).then(x => x.json());

    if (r.status === "ok") {
      addFileToGrid(r.clip);
      activateFile(r.clip);
      $("#clipCancel").click();
    } else {
      alert("❌ " + r.error);
    }
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-share-nodes"></i> Create & Share Clip`;
  });

  // Email Modal Logic
  $("#emailClose")?.addEventListener("click", () => $("#emailModal").close());
  $("#emailSend")?.addEventListener("click", async () => {
    // ... same as before
  });

  // --- Helper function implementations (pasted here for completeness) ---
  function activateFile(filename) {
    if (!filename) {
      previewArea.classList.add("hidden");
      currentFile = null;
      return;
    }
    currentFile = filename;
    preview.src = fullUrl(filename);
    previewArea.classList.remove("hidden");
    renderActionsPanel(filename);
    document.querySelectorAll(".media-card").forEach(card => {
      card.classList.toggle("selected", card.dataset.filename === filename);
    });
    previewArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function renderActionsPanel(filename) {
    actionsPanel.innerHTML = `<a href="/download/${filename}" class="btn" download><i class="fa-solid fa-download"></i> Download</a><button class="btn" data-action="secure-link"><i class="fa-solid fa-lock"></i> Secure Link</button><button class="btn" data-action="public-link"><i class="fa-solid fa-globe"></i> Public Link</button><button class="btn" data-action="email"><i class="fa-solid fa-envelope"></i> Email</button><button class="btn" data-action="clip"><i class="fa-solid fa-scissors"></i> Trim</button><button class="btn cancel" data-action="delete"><i class="fa-solid fa-trash-can"></i> Delete</button>`;
  }
  function addFileToGrid(filename) {
    if (document.querySelector(`.media-card[data-filename="${filename}"]`)) return;
    const card = document.createElement("div");
    card.className = "media-card";
    card.dataset.filename = filename;
    card.innerHTML = `<video src="${fullUrl(filename)}#t=0.1" preload="metadata"></video><p>${filename.substring(10)}</p>`;
    mediaGrid.prepend(card);
    card.addEventListener("click", () => activateFile(filename));
  }
  function renderFiles(files = []) {
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
  }
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
      stream.getVideoTracks()[0].onended = () => stopBtn.click();
      statusMsg.textContent = "🎬 Recording…";
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      alert("Screen capture permission was denied. " + err.message);
    }
  });
  stopBtn?.addEventListener("click", () => { if (mediaRecorder?.state === "recording" || mediaRecorder?.state === "paused") { mediaRecorder.stop(); stopBtn.disabled = true; }});
  resumeBtn?.addEventListener("click", () => { filesPanel.classList.toggle("hidden"); filesPanel.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  forgetBtn?.addEventListener("click", async () => { if (!confirm("Are you sure? This will clear your list of recordings from this browser.")) return; await apiFetch("/session/forget", { method: "POST" }); renderFiles([]); activateFile(null); alert("✅ Session forgotten."); });
  $("#emailSend")?.addEventListener("click", async () => { const to = $("#emailTo").value.trim(); if (!to) return ($("#emailStatus").textContent = "❌ Enter an e-mail."); const btn = $("#emailSend"); btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`; const linkRes = await apiFetch(`/link/secure/${currentFile}`).then(r => r.json()); if (linkRes.status !== 'ok') { alert('Could not generate a secure link.'); btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send`; return; } const r = await apiFetch("/send_email", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ to, url: linkRes.url }) }).then(x => x.json()); $("#emailStatus").textContent = r.status === "ok" ? "✅ Sent!" : "❌ " + (r.error || "Failed"); btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send`; if (r.status === "ok") setTimeout(() => $("#emailModal").close(), 1500); });
});
