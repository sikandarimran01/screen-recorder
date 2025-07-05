document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Query Helpers ---
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // --- UI & API Helpers ---
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
  
  // --- All DOM Element References ---
  const recorderView = $("#recorderView"), privacyView = $("#privacyView"), contactView = $("#contactView");
  const startBtn = $("#startBtn"), stopBtn = $("#stopBtn"), pauseBtn = $("#pauseBtn"), resumeBtn = $("#resumeBtn");
  const statusMsg = $("#statusMsg"), previewArea = $("#previewArea"), preview = $("#preview");
  const actionsPanel = $("#actionsPanel"), clipPanel = $("#clipPanel"), filesPanel = $("#filesPanel");
  const mediaGrid = $("#mediaGrid"), sessionBtn = $("#sessionBtn"), forgetBtn = $("#forgetBtn");
  const trimSliderEl = $("#trim-slider"), trimStartTime = $("#trim-start-time"), trimEndTime = $("#trim-end-time");
  const deleteModal = $("#deleteModal"), fileToDeleteEl = $("#fileToDelete"), deleteConfirmBtn = $("#deleteConfirm"), deleteCancelBtn = $("#deleteCancel");
  const emailModal = $("#emailModal"), forgetSessionModal = $("#forgetSessionModal");
  
  // --- App State ---
  let mediaRecorder, chunks = [], currentFile = null, trimSlider = null;

  // ===================================================================
  // CORE FUNCTIONS
  // ===================================================================

  const showView = (viewName) => {
    recorderView.classList.add("hidden");
    privacyView.classList.add("hidden");
    contactView.classList.add("hidden");

    if (viewName === 'recorder') recorderView.classList.remove("hidden");
    if (viewName === 'privacy') privacyView.classList.remove("hidden");
    if (viewName === 'contact') contactView.classList.remove("hidden");
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const addFileToGrid = (filename) => {
    if ($(`.media-card[data-filename="${filename}"]`)) return;
    const card = document.createElement("div");
    card.className = "media-card";
    card.dataset.filename = filename;
    card.innerHTML = `<video src="${fullUrl(filename)}#t=0.1" preload="metadata"></video><p>${filename.substring(10)}</p>`;
    mediaGrid.prepend(card);
    card.addEventListener("click", () => activateFile(filename));
  };
  
  const renderFiles = (files = []) => {
    mediaGrid.innerHTML = "";
    const hasFiles = files.length > 0;
    if (hasFiles) files.forEach(addFileToGrid);
    sessionBtn.classList.toggle("hidden", !hasFiles);
    forgetBtn.classList.toggle("hidden", !hasFiles);
    filesPanel.classList.toggle("hidden", !hasFiles);
  };
  
  const activateFile = (filename) => {
    if (!filename) {
      currentFile = null;
      previewArea.classList.add("hidden");
      actionsPanel.innerHTML = "";
      return;
    }
    currentFile = filename;
    preview.src = fullUrl(filename); 
    previewArea.classList.remove("hidden");
    actionsPanel.innerHTML = `<a href="/download/${filename}" class="btn" download><i class="fa-solid fa-download"></i> Download</a><button class="btn" data-action="secure-link"><i class="fa-solid fa-lock"></i> Secure Link</button><button class="btn" data-action="public-link"><i class="fa-solid fa-globe"></i> Public Link</button><button class="btn" data-action="email"><i class="fa-solid fa-envelope"></i> Email</button><button class="btn" data-action="clip"><i class="fa-solid fa-scissors"></i> Trim</button><button class="btn danger" data-action="delete"><i class="fa-solid fa-trash-can"></i> Delete</button>`;
    $$(".media-card").forEach(card => card.classList.toggle("selected", card.dataset.filename === filename));
    previewArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  
  const createSlider = (videoDuration) => {
    if (trimSlider) { trimSlider.destroy(); }
    const startValues = [0, Math.min(10, videoDuration)];
    trimSlider = noUiSlider.create(trimSliderEl, {
      start: startValues, connect: true, range: { min: 0, max: videoDuration }, step: 0.1,
    });
    trimSlider.on('update', (values) => {
      const [start, end] = values.map(v => parseFloat(v));
      trimStartTime.textContent = formatTime(start);
      trimEndTime.textContent = formatTime(end);
    });
    trimSlider.on('slide', (values, handle) => { preview.currentTime = parseFloat(values[handle]); });
    clipPanel.classList.remove("hidden");
    clipPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const setupTrimSlider = () => {
    statusMsg.textContent = "⏳ Initializing trimmer...";
    if (preview.readyState >= 1 && isFinite(preview.duration) && preview.duration > 0) {
      createSlider(preview.duration);
      return;
    }
    statusMsg.textContent = "⏳ Waiting for video metadata...";
    let fallbackTimeout;
    const onMetadataLoaded = () => {
      clearTimeout(fallbackTimeout);
      preview.removeEventListener('loadedmetadata', onMetadataLoaded);
      if (isFinite(preview.duration) && preview.duration > 0) {
        createSlider(preview.duration);
      } else {
        statusMsg.textContent = "❌ Metadata loaded, but the video duration is invalid.";
      }
    };
    preview.addEventListener('loadedmetadata', onMetadataLoaded);
    fallbackTimeout = setTimeout(() => {
      preview.removeEventListener('loadedmetadata', onMetadataLoaded);
      statusMsg.textContent = "❌ Timed out waiting for video.";
    }, 5000);
  };
  
  // ===================================================================
  // EVENT LISTENERS
  // ===================================================================

  // --- Main Page Navigation (Isolated and Correct) ---
  $("#showPrivacyLink")?.addEventListener("click", (e) => { e.preventDefault(); showView('privacy'); });
  $("#showContactLink")?.addEventListener("click", (e) => { e.preventDefault(); showView('contact'); });
  $$(".back-btn").forEach(btn => btn.addEventListener("click", (e) => { e.preventDefault(); showView('recorder'); }));

  // --- Recorder Controls ---
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
        startBtn.classList.remove("hidden");
        pauseBtn.classList.add("hidden");
        resumeBtn.classList.add("hidden");
        stopBtn.classList.add("hidden");
      };
      mediaRecorder.start();
      stream.getVideoTracks()[0].onended = () => stopBtn.click();
      statusMsg.textContent = "🎬 Recording…";
      startBtn.classList.add("hidden");
      stopBtn.classList.remove("hidden");
      pauseBtn.classList.remove("hidden");
    } catch (err) {
      alert("Screen capture permission was denied. " + err.message);
    }
  });

  pauseBtn?.addEventListener("click", () => { mediaRecorder.pause(); statusMsg.textContent = "⏸ Paused"; pauseBtn.classList.add("hidden"); resumeBtn.classList.remove("hidden"); });
  resumeBtn?.addEventListener("click", () => { mediaRecorder.resume(); statusMsg.textContent = "🎬 Recording…"; resumeBtn.classList.add("hidden"); pauseBtn.classList.remove("hidden"); });
  stopBtn?.addEventListener("click", () => { if (mediaRecorder?.state !== "inactive") mediaRecorder.stop(); });
  
  // --- Other Button/Panel Listeners ---
  sessionBtn?.addEventListener("click", () => { filesPanel.classList.toggle("hidden"); filesPanel.scrollIntoView({ behavior: 'smooth' }); });
  forgetBtn?.addEventListener("click", () => forgetSessionModal?.showModal());

  actionsPanel.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button || !currentFile) return;
    const action = button.dataset.action;
    
    switch (action) {
      case "clip": setupTrimSlider(); break;
      case "secure-link": { const r = await apiFetch(`/link/secure/${currentFile}`).then(r => r.json()); if (r.status === "ok") copy(r.url, button); break; }
      case "public-link": { const r = await apiFetch(`/link/public/${currentFile}`).then(r => r.json()); if (r.status === "ok") { copy(r.url, button); button.innerHTML = `<i class="fa-solid fa-link"></i> Public Link Active`; } break; }
      case "email": emailModal?.showModal(); break;
      case "delete":
        fileToDeleteEl.textContent = currentFile;
        deleteConfirmBtn.dataset.filename = currentFile;
        deleteModal?.showModal();
        break;
    }
  });

  // --- Modal Button Listeners ---
  $("#clipCancel")?.addEventListener("click", () => { clipPanel.classList.add("hidden"); if (trimSlider) { trimSlider.destroy(); trimSlider = null; } statusMsg.textContent = ""; });
  $("#clipGo")?.addEventListener("click", async (e) => {
      if (!currentFile || !trimSlider) return alert("⚠ Trimmer not initialized.");
      const [start, end] = trimSlider.get().map(v => parseFloat(v));
      if (start >= end) return alert("⚠ Invalid range.");
      const btn = e.target.closest("button");
      btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Cutting...`;
      const r = await apiFetch(`/clip/${currentFile}`, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ start, end }) }).then(x => x.json());
      if (r.status === "ok") { addFileToGrid(r.clip); activateFile(r.clip); $("#clipCancel").click(); } else { alert("❌ " + r.error); }
      btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-share-nodes"></i> Create & Share Clip`;
  });

  $("#emailClose")?.addEventListener("click", () => emailModal.close());
  $("#emailSend")?.addEventListener("click", async (e) => {
      const to = $("#emailTo").value.trim();
      if (!to) { $("#emailStatus").textContent = "❌ Enter an e-mail."; return; }
      const btn = e.target.closest("button");
      btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;
      const linkRes = await apiFetch(`/link/secure/${currentFile}`).then(r => r.json());
      if (linkRes.status !== 'ok') {
          alert('Could not generate a secure link.');
          btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send`; return;
      }
      const r = await apiFetch("/send_email", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ to, url: linkRes.url }) }).then(x => x.json());
      $("#emailStatus").textContent = r.status === "ok" ? "✅ Sent!" : "❌ " + (r.error || "Failed");
      btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send`;
      if (r.status === "ok") setTimeout(() => { emailModal.close(); $("#emailStatus").textContent = ""; }, 1500);
  });
  
  deleteCancelBtn?.addEventListener("click", () => deleteModal.close());
  deleteConfirmBtn?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      const filename = btn.dataset.filename;
      if (!filename) return;
      btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Deleting...`;
      const r = await apiFetch(`/delete/${filename}`, { method: "POST" }).then(r => r.json());
      if (r.status === "ok") {
        const card = $(`.media-card[data-filename="${filename}"]`);
        if (card) { card.classList.add("deleting"); card.addEventListener("animationend", () => card.remove()); }
        if (currentFile === filename) activateFile(null);
      } else {
        alert("❌ Delete failed: " + r.error);
      }
      btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Yes, Delete`;
      deleteModal.close();
  });

  $("#forgetCancel")?.addEventListener("click", () => forgetSessionModal.close());
  $("#forgetConfirm")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Forgetting...`;
      await apiFetch("/session/forget", { method: "POST" });
      renderFiles([]);
      activateFile(null);
      statusMsg.textContent = "✅ Session has been successfully forgotten.";
      setTimeout(() => { statusMsg.textContent = ""; }, 4000);
      forgetSessionModal.close();
      btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-eraser"></i> Yes, Forget Session`;
  });

  // --- Contact Form Modal Logic (Updated for better styling) ---
  const contactModal = $("#contactModal");
  const showContactModalBtn = $("#showContactModalBtn");
  const contactCancelBtn = $("#contactCancelBtn");
  const contactSendBtn = $("#contactSendBtn");
  const contactStatus = $("#contactStatus");

  showContactModalBtn?.addEventListener("click", () => {
    // Clear previous status and styles when opening
    contactStatus.textContent = "";
    contactStatus.className = ""; 
    contactModal?.showModal();
  });

  contactCancelBtn?.addEventListener("click", () => {
    contactModal?.close();
  });

  contactSendBtn?.addEventListener("click", async () => {
    const from_email = $("#contactFromEmail").value.trim();
    const subject = $("#contactSubject").value.trim();
    const message = $("#contactMessage").value.trim();

    if (!from_email || !subject || !message) {
      // Apply the .error class
      contactStatus.className = "error";
      contactStatus.textContent = "❌ Please fill out all fields.";
      return;
    }

    contactSendBtn.disabled = true;
    contactSendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;
    contactStatus.className = ""; // Clear old errors
    contactStatus.textContent = "";

    const res = await apiFetch("/contact_us", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_email, subject, message })
    }).then(r => r.json());

    if (res.status === "ok") {
      // Apply the .success class
      contactStatus.className = "success";
      contactStatus.textContent = "✅ Message Sent! We'll get back to you soon.";
      setTimeout(() => {
        contactModal.close();
        $("#contactFromEmail").value = "";
        $("#contactSubject").value = "";
        $("#contactMessage").value = "";
      }, 2500);
    } else {
      // Apply the .error class
      contactStatus.className = "error";
      contactStatus.textContent = `❌ ${res.error || "An unknown error occurred."}`;
    }

    contactSendBtn.disabled = false;
    contactSendBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send Message`;
  });


  // ===================================================================
  // INITIALIZATION (Runs once on page load)
  // ===================================================================
  (async () => {
    // Mobile check
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      $("#mobileWarningModal")?.showModal();
      if(startBtn) {
        startBtn.disabled = true;
        startBtn.innerHTML = `<i class="fa-solid fa-desktop"></i> Desktop Only`;
      }
    }
    // Load files
    try {
      const { files = [] } = await apiFetch("/session/files").then(r => r.json());
      renderFiles(files.reverse());
    } catch {}
  })();
});