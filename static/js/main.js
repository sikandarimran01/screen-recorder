document.addEventListener("DOMContentLoaded", () => {
  // --- Helpers & State (Unchanged) ---
  const $ = (s) => document.querySelector(s);
  const copy ='s `load` event, which fires only after all resources (including scripts like `noUiSlider`) are fully loaded.

 (text, btn) => {
    navigator.clipboard.writeText(text).then(() => {
      Here is the corrected `main.js` file. You only need to replace this one file.

### Corrected `staticif (!btn) return;
      const prevHTML = btn.innerHTML;
      btn.innerHTML = `<i/js/main.js`

```javascript
// --- WRAPPER to ensure noUiSlider is loaded --- class="fa-solid fa-check"></i> Copied!`;
      btn.disabled = true;
      setTimeout(() => { btn.innerHTML = prevHTML; btn.disabled = false; }, 1700);
const runApp = () => {

  // --- Helpers & State ---
  const $ = (s) => document.querySelector
    });
  };
  const apiFetch = (url, opts = {}) => fetch(url, opts(s);
  const copy = (text, btn) => {
    navigator.clipboard.writeText();
  const fullUrl = (f) => `${location.origin}/recordings/${f}`;
  
  //text).then(() => {
      if (!btn) return;
      const prevHTML = btn.innerHTML; --- DOM References (Unchanged) ---
  const recorderView = $("#recorderView"), privacyView = $("#privacyView"), contactView = $("#contactView");
  const startBtn = $("#startBtn"), stopBtn = $("#stopBtn
      btn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
      btn.disabled = true;
      setTimeout(() => { btn.innerHTML = prevHTML; btn.disabled = false");
  const statusMsg = $("#statusMsg"), previewArea = $("#previewArea"), preview = $("#preview");
; }, 1700);
    });
  };
  const apiFetch = (url, opts  const actionsPanel = $("#actionsPanel"), clipPanel = $("#clipPanel"), filesPanel = $("#filesPanel");
  const mediaGrid = $("#mediaGrid"), resumeBtn = $("#resumeBtn"), forgetBtn = $("#forgetSession");

 = {}) => fetch(url, opts);
  const fullUrl = (f) => `${location.origin}/recordings/${f}`;
  
  // --- DOM References ---
  const recorderView = $("#recorderView"), privacyView = $("#privacyView"), contactView = $("#contactView");
  const startBtn = $("#startBtn"), stopBtn = $("#stopBtn");
  const statusMsg = $("#statusMsg"), previewArea = $("#previewArea"), preview =  // --- References for the trimmer ---
  const trimSliderEl = $("#trim-slider");
  const trimStartTime = $("#trim-start-time");
  const trimEndTime = $("#trim-end-time");

  // --- $("#preview");
  const actionsPanel = $("#actionsPanel"), clipPanel = $("#clipPanel"), filesPanel = $("#filesPanel");
  const mediaGrid = $("#mediaGrid"), resumeBtn = $("#resumeBtn"), forgetBtn = $("# State ---
  let mediaRecorder, chunks = [], currentFile = null;
  let trimSlider = null;

  // --- Time formatting helper ---
  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);forgetSession");
  
  const trimSliderEl = $("#trim-slider");
  const trimStartTime = $("#trim-start-time");
  const trimEndTime = $("#trim-end-time");

  // --- State ---
  
    const ms = Math.floor((seconds - Math.floor(seconds)) * 10);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0let mediaRecorder, chunks = [], currentFile = null;
  let trimSlider = null; // To hold the')}.${ms}`;
  };
  
  // --- SPA View Management (Unchanged) ---
  const showView = (viewName) => {
    recorderView.classList.add("hidden");
    privacyView slider instance

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00.0';
    const min = Math.floor(seconds / 60);
    const sec =.classList.add("hidden");
    contactView.classList.add("hidden");
    if (viewName Math.floor(seconds % 60);
    const ms = Math.floor((seconds - Math.floor(seconds)) * 10);
    return `${String(min).padStart(2, '0')}:${ === 'recorder') recorderView.classList.remove("hidden");
    else if (viewName === 'privacy')String(sec).padStart(2, '0')}.${ms}`;
  };
  
  // --- SPA View Management ---
  const showView = (viewName) => {
    recorderView.classList.add("hidden"); privacyView.classList.remove("hidden");
    else if (viewName === 'contact') contactView.classList.remove("hidden");
  };
  $("#showPrivacyLink").addEventListener("click", (e) => { e.preventDefault
    privacyView.classList.add("hidden");
    contactView.classList.add("hidden");
    (); showView('privacy'); });
  $("#showContactLink").addEventListener("click", (e) => { e.preventDefault(); showView('contact'); });
  document.querySelectorAll(".back-btn").forEach(btn => btnif (viewName === 'recorder') recorderView.classList.remove("hidden");
    else if (viewName.addEventListener("click", () => showView('recorder')));
  
  // --- Core Functions (Unchanged) ---
   === 'privacy') privacyView.classList.remove("hidden");
    else if (viewName === 'contact')const activateFile = (filename) => { /* ... same as before ... */
    if (!filename) {
      previewArea.classList.add("hidden");
      currentFile = null;
      return;
    } contactView.classList.remove("hidden");
  };
  $("#showPrivacyLink").addEventListener("click", (e) => { e.preventDefault(); showView('privacy'); });
  $("#showContactLink").addEventListener("click
    currentFile = filename;
    preview.src = fullUrl(filename);
    previewArea.classList.remove("hidden");
    renderActionsPanel(filename);
    document.querySelectorAll(".media-card").forEach(card => {
      card.classList.toggle("selected", card.dataset.filename === filename);
    ", (e) => { e.preventDefault(); showView('contact'); });
  document.querySelectorAll(".back-btn").forEach(btn => btn.addEventListener("click", () => showView('recorder')));
  
  const});
    previewArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }; activateFile = (filename) => {
    if (!filename) {
      previewArea.classList.add("hidden");
      currentFile = null;
      return;
    }
    currentFile = filename;

  const renderActionsPanel = (filename) => { /* ... same as before ... */
    actionsPanel.    preview.src = fullUrl(filename);
    previewArea.classList.remove("hidden");
    renderActionsPanel(filename);
    document.querySelectorAll(".media-card").forEach(card => {
      card.innerHTML = `
      <a href="/download/${filename}" class="btn" download><i class="fa-solid fa-download"></i> Download</a>
      <button class="btn" data-action="secure-link"><i class="fa-solid fa-lock"></i> Secure Link</button>
      <button class="btn"classList.toggle("selected", card.dataset.filename === filename);
    });
    previewArea.scrollInto data-action="public-link"><i class="fa-solid fa-globe"></i> Public Link</button>View({ behavior: 'smooth', block: 'center' });
  };
  
  const renderActionsPanel = (filename) => {
    actionsPanel.innerHTML = `
      <a href="/download/${filename}" class="btn" download><i class="fa-solid fa-download"></i> Download</a>
      <button class="btn" data-action="secure-link"><i class="fa-solid fa-lock"></i> Secure Link</button>
      <button class="btn" data-action="email"><i class="fa-solid fa-envelope"></i> Email</button>
      <button class="btn" data-action="clip"><i class="fa-solid fa-scissors"></i> Trim</button>
      <button class="btn cancel" data-action="delete
      <button class="btn" data-action="public-link"><i class="fa-solid fa-globe"></i> Public Link</button>
      <button class="btn" data-action="email"><i class"><i class="fa-solid fa-trash-can"></i> Delete</button>
    `;
  };
  const addFileToGrid = (filename) => { /* ... same as before ... */
    if (="fa-solid fa-envelope"></i> Email</button>
      <button class="btn" data-action="clip"><i class="fa-solid fa-scissors"></i> Trim</button>
      <button class="document.querySelector(`.media-card[data-filename="${filename}"]`)) return;
    const card = document.createElement("div");
    card.className = "media-card";
    card.dataset.filename =btn cancel" data-action="delete"><i class="fa-solid fa-trash-can"></i> Delete</ filename;
    card.innerHTML = `<video src="${fullUrl(filename)}#t=0.1"button>
    `;
  };
  
  const addFileToGrid = (filename) => {
 preload="metadata"></video><p>${filename.substring(10)}</p>`;
    mediaGrid.prepend    if (document.querySelector(`.media-card[data-filename="${filename}"]`)) return;
    const card = document.createElement("div");
    card.className = "media-card";
    card.dataset(card);
    card.addEventListener("click", () => activateFile(filename));
  };
  const.filename = filename;
    card.innerHTML = `<video src="${fullUrl(filename)}#t=0.1" preload="metadata"></video><p>${filename.substring(10)}</p>`;
    media renderFiles = (files = []) => { /* ... same as before ... */
    mediaGrid.innerHTML = "";
    if (files.length > 0) {
      files.forEach(addFileToGrid);
      filesPanel.classList.remove("hidden");
      resumeBtn.classList.remove("hidden");
      forgetBtn.classListGrid.prepend(card);
    card.addEventListener("click", () => activateFile(filename));
  };.remove("hidden");
    } else {
      filesPanel.classList.add("hidden");
      resumeBtn.classList.add("hidden");
      forgetBtn.classList.add("hidden");
    }
  };
  
  (async () => { try { const { files = [] } = await apiFetch("/session/files
  
  const renderFiles = (files = []) => {
    mediaGrid.innerHTML = "";
    if (files.length > 0) {
      files.forEach(addFileToGrid);
      filesPanel.classList.remove("hidden");
      resumeBtn.classList.remove("hidden");
      forgetBtn.").then(r => r.json()); renderFiles(files.reverse()); } catch {} })();
  
  // ---classList.remove("hidden");
    } else {
      filesPanel.classList.add("hidden");
      resumeBtn.classList.add("hidden");
      forgetBtn.classList.add("hidden");
    }
 Main Event Listeners ---
  startBtn?.addEventListener("click", async () => { /* ... same as before ... */  };
  
  (async () => { try { const { files = [] } = await apiFetch("/session/files 
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { mediaSource: "screen" }, audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType:").then(r => r.json()); renderFiles(files.reverse()); } catch {} })();
  
  startBtn "video/webm" });
      chunks = [];
      mediaRecorder.ondataavailable = e => chunks.push?.addEventListener("click", async () => { 
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { mediaSource: "screen" }, audio: true });
      mediaRecorder = new MediaRecorder(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(stream, { mimeType: "video/webm" });
      chunks = [];
      mediaRecorder.ondata(chunks, { type: "video/webm" });
        const fd = new FormData();
        fd.append("video", blob, "recording.webm");
        statusMsg.innerHTML = `<i class="fa-available = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {solid fa-spinner fa-spin"></i> Uploading & processing...`;
        const res = await apiFetch("/
        const blob = new Blob(chunks, { type: "video/webm" });
        const fd = new FormData();
        fd.append("video", blob, "recording.webm");
        statusMsg.innerHTMLupload", { method: "POST", body: fd }).then(r => r.json());
        if (res.status === "ok") {
          statusMsg.textContent = `✅ Recording saved!`;
          add = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading & processing...`;
        FileToGrid(res.filename);
          activateFile(res.filename);
        } else {
          const res = await apiFetch("/upload", { method: "POST", body: fd }).then(r => rstatusMsg.textContent = "❌ Upload failed: " + res.error;
        }
        startBtn..json());
        if (res.status === "ok") {
          statusMsg.textContent = `✅disabled = false;
      };
      mediaRecorder.start();
      stream.getVideoTracks()[0].onended = () Recording saved!`;
          addFileToGrid(res.filename);
          activateFile(res.filename);
        } => stopBtn.click();
      statusMsg.textContent = "🎬 Recording…";
      startBtn.disabled else {
          statusMsg.textContent = "❌ Upload failed: " + res.error;
        }
 = true;
      stopBtn.disabled = false;
    } catch (err) {
      alert("        startBtn.disabled = false;
      };
      mediaRecorder.start();
      stream.getVideoTracks()[0].Screen capture permission was denied. " + err.message);
    }
  });
  stopBtn?.addEventListeneronended = () => stopBtn.click();
      statusMsg.textContent = "🎬 Recording…";
      ("click", () => { if (mediaRecorder?.state === "recording" || mediaRecorder?.state === "pausedstartBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {") { mediaRecorder.stop(); stopBtn.disabled = true; }});
  resumeBtn?.addEventListener("click", () =>
      alert("Screen capture permission was denied. " + err.message);
    }
  });
   { filesPanel.classList.toggle("hidden"); filesPanel.scrollIntoView({ behavior: 'smooth', block: 'center'
  stopBtn?.addEventListener("click", () => { if (mediaRecorder?.state === "recording" || mediaRecorder }); });
  forgetBtn?.addEventListener("click", async () => { /* ... same as before ... */
    if (!confirm?.state === "paused") { mediaRecorder.stop(); stopBtn.disabled = true; }});
  resume("Are you sure? This will clear your list of recordings from this browser.")) return;
    await apiFetch("/Btn?.addEventListener("click", () => { filesPanel.classList.toggle("hidden"); filesPanel.scrollIntoView({ behavior:session/forget", { method: "POST" });
    renderFiles([]);
    activateFile(null);
 'smooth', block: 'center' }); });
  forgetBtn?.addEventListener("click", async () => {
    if (!confirm("Are you sure? This will clear your list of recordings from this browser.")) return;
        alert("✅ Session forgotten.");
  });
  
  // Delegated Actions Listener
  actionsPanel.addEventListener("await apiFetch("/session/forget", { method: "POST" });
    renderFiles([]);
    activateFileclick", async (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    const action = button.dataset.action;
    if (!currentFile) return(null);
    alert("✅ Session forgotten.");
  });
  
  actionsPanel.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    switch (action) {
      case "clip":
        // --- FIX IS HERE ---
        ;
    const action = button.dataset.action;
    if (!currentFile) return;
    switch// Check if the library is loaded before using it.
        if (typeof noUiSlider !== 'undefined') { (action) {
      case "clip":
        setupTrimSlider();
        break;
      case "secure
          setupTrimSlider();
        } else {
          alert('Error: Trimmer library is still loading. Please try-link": { const r = await apiFetch(`/link/secure/${currentFile}`).then(r => r. again in a moment.');
        }
        break;
      // ... other cases are unchanged
      case "securejson()); if (r.status === "ok") copy(r.url, button); break; }
      -link": { const r = await apiFetch(`/link/secure/${currentFile}`).then(r => r.case "public-link": { const r = await apiFetch(`/link/public/${currentFile}`).then(rjson()); if (r.status === "ok") copy(r.url, button); break; }
       => r.json()); if (r.status === "ok") { copy(r.url, button); buttoncase "public-link": { const r = await api-fetch(`/link/public/${currentFile}`).then(r.innerHTML = `<i class="fa-solid fa-link"></i> Public Link Active`; } break; }
 => r.json()); if (r.status === "ok") { copy(r.url, button); button      case "email": $("#emailModal").showModal(); break;
      case "delete": { if (!confirm.innerHTML = `<i class="fa-solid fa-link"></i> Public Link Active`; } break; }
(`Delete ${currentFile}? This cannot be undone.`)) return; const r = await apiFetch(`/delete/${currentFile}`, { method: "POST" }).then(r => r.json()); if (r.status === "      case "email": $("#emailModal").showModal(); break;
      case "delete": { if (!confirm(`Delete ${currentFile}? This cannot be undone.`)) return; const r = await apiFetch(`/delete/${currentok") { const card = $(`.media-card[data-filename="${currentFile}"]`); if (card) { card.classListFile}`, { method: "POST" }).then(r => r.json()); if (r.status === ".add("deleting"); card.addEventListener("animationend", () => card.remove()); } activateFile(nullok") { const card = $(`.media-card[data-filename="${currentFile}"]`); if (card) { card.classList); } else { alert("❌ Delete failed: " + r.error); } break; }
    }
.add("deleting"); card.addEventListener("animationend", () => card.remove()); } activateFile(null  });
  
  const setupTrimSlider = () => {
    if (!preview.duration || isNaN(preview.); } else { alert("❌ Delete failed: " + r.error); } break; }
    }
  });
  
  // --- Trimmer Slider Logic ---
  const setupTrimSlider = () => {
    //duration)) {
      preview.onloadedmetadata = () => setupTrimSlider();
      preview.currentTime =  Wait for the video's duration to be known
    if (!preview.duration || isNaN(preview.duration)) {
0.1; // Force metadata load on some browsers
      return;
    }
    
    if (trimSlider      preview.addEventListener('loadedmetadata', setupTrimSlider, { once: true });
      return;
    }
) {
      trimSlider.destroy();
    }

    const videoDuration = preview.duration;
        
    if (trimSlider) {
      trimSlider.destroy();
    }

    const videoDurationconst startValues = [0, Math.min(10, videoDuration)];

    trimSlider = noUiSlider. = preview.duration;
    const startValues = [0, Math.min(10, videoDuration)];create(trimSliderEl, {
      start: startValues,
      connect: true,
      range:

    trimSlider = noUiSlider.create(trimSliderEl, {
      start: startValues,
       { 'min': 0, 'max': videoDuration },
      step: 0.1,
      connect: true,
      range: { 'min': 0, 'max': videoDuration },
      step: tooltips: false,
    });

    trimSlider.on('update', (values, handle) => {
      const0.1,
    });

    trimSlider.on('update', (values, handle) => {
 [start, end] = values.map(v => parseFloat(v));
      trimStartTime.textContent = format      const [start, end] = values.map(v => parseFloat(v));
      trimStartTime.textContentTime(start);
      trimEndTime.textContent = formatTime(end);
      if (handle === 0) preview = formatTime(start);
      trimEndTime.textContent = formatTime(end);
      if (handle ===.currentTime = start;
      if (handle === 1) preview.currentTime = end;
    });

    clipPanel.classList.remove("hidden");
    clipPanel.scrollIntoView({ behavior: 'smooth', 0) {
        preview.currentTime = start;
      } else {
        preview.currentTime = end;
      }
    });

    clipPanel.classList.remove("hidden");
    clipPanel.scrollInto block: 'center' });
  };

  $("#clipCancel")?.addEventListener("click", () => {
View({ behavior: 'smooth', block: 'center' });
  };

  $("#clipCancel")?.addEventListener("click",    clipPanel.classList.add("hidden");
    if (trimSlider) {
      trimSlider.destroy();
      trimSlider = null;
    }
  });

  $("#clipGo")?.addEventListener("click () => {
    clipPanel.classList.add("hidden");
    if (trimSlider) {
      ", async () => {
    if (!currentFile || !trimSlider) return alert("⚠ Trimmer not initializedtrimSlider.destroy();
      trimSlider = null;
    }
  });

  $("#clipGo")?.addEventListener("click", async () => {
    if (!currentFile || !trimSlider) return alert("⚠.");
    const [start, end] = trimSlider.get().map(v => parseFloat(v));
    if (start >= end) return alert("⚠ Invalid range.");
    const btn = $("#clipGo");
    btn Trimmer not initialized.");
    const [start, end] = trimSlider.get().map(v => parseFloat(v));
    if (start >= end) return alert("⚠ Invalid range.");

    const btn = $("#clipGo.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Cutting...`;
    
    const r = await apiFetch(`/clip/${currentFile}`, {
      method:");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa- "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ start, endspinner fa-spin"></i> Cutting...`;
    
    const r = await apiFetch(`/clip/${currentFile}`, { })
    }).then(x => x.json());

    if (r.status === "ok") {
      method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ start, end })
    }).then(x => x.json());

    if (r.status ===
      addFileToGrid(r.clip);
      activateFile(r.clip);
      $("#clipCancel").click();
    } else {
      alert("❌ " + r.error);
    }
 "ok") {
      addFileToGrid(r.clip);
      activateFile(r.clip);
      $("#clipCancel").click();
    } else {
      alert("❌ " + r.error);    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-share-
    }
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solidnodes"></i> Create & Share Clip`;
  });

  $("#emailClose")?.addEventListener("click", () => fa-share-nodes"></i> Create & Share Clip`;
  });

  // Email Modal Logic (Unchanged $("#emailModal").close());
  $("#emailSend")?.addEventListener("click", async () => { 
    const to)
  $("#emailClose")?.addEventListener("click", () => $("#emailModal").close());
  $("#email = $("#emailTo").value.trim();
    if (!to) return ($("#emailStatus").textContent = "❌ Enter an e-mail.");
    const btn = $("#emailSend");
    btn.disabled = true;Send")?.addEventListener("click", async () => { /* ... same as before ... */ 
    const to = $("#email btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;
    To").value.trim();
    if (!to) return ($("#emailStatus").textContent = "❌ Enter anconst linkRes = await apiFetch(`/link/secure/${currentFile}`).then(r => r.json());
 e-mail.");
    const btn = $("#emailSend");
    btn.disabled = true; btn.innerHTML    if (linkRes.status !== 'ok') {
        alert('Could not generate a secure link.');
        btn. = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;
    const linkResdisabled = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send`; = await apiFetch(`/link/secure/${currentFile}`).then(r => r.json());
    if (
        return;
    }
    const r = await apiFetch("/send_email", {
      methodlinkRes.status !== 'ok') {
        alert('Could not generate a secure link.');
        btn.disabled: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ to, = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send`;
        return;
    }
    const r = await apiFetch("/send_email", {
      method: url: linkRes.url })
    }).then(x => x.json());
    $("#emailStatus"). "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ to, urltextContent = r.status === "ok" ? "✅ Sent!" : "❌ " + (r.error || "Failed");
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid: linkRes.url })
    }).then(x => x.json());
    $("#emailStatus").textContent = r.status === "ok" ? "✅ Sent!" : "❌ " + (r.error || " fa-paper-plane"></i> Send`;
    if (r.status === "ok") setTimeout(() => $("#Failed");
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid faemailModal").close(), 1500);
  });
};


// --- FIX: Initializer logic-paper-plane"></i> Send`;
    if (r.status === "ok") setTimeout(() => $("#email ---
// This ensures that our `runApp` function only executes
// after the noUiSlider library is guaranteedModal").close(), 1500);
  });
});
