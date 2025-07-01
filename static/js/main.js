/* ───────────────────────────────────────────────
   main.js – session‑aware with Resume / Forget
   ─────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  /* ----------  tiny helpers  ---------- */
  const $ = (s) => document.querySelector(s);
  const copy = (txt, btn, msg = "✅ Copied!") =>
    navigator.clipboard.writeText(txt).then(() => {
      const p = btn.textContent;
      btn.textContent = msg; btn.disabled = true;
      setTimeout(() => { btn.textContent = p; btn.disabled = false; }, 1800);
    });

  /* ----------  anonymous‑session helper ---------- */
  const COOKIE = document.cookie.match(/(?:^|;)\s*session=([^;]+)/)?.[1];
  const LS_KEY = "gs_session";
  let session  = COOKIE || localStorage.getItem(LS_KEY) || crypto.randomUUID().replace(/-/g,"");
  if (!COOKIE) localStorage.setItem(LS_KEY, session);

  const apiFetch = (u,o={})=>{
      o.headers = Object.assign({ "X-Session": session }, o.headers||{});
      return fetch(u,o).then(r=>{
          // grab refreshed cookie if server issues one
          const m=document.cookie.match(/(?:^|;)\s*session=([^;]+)/);
          if(m){ session=m[1]; localStorage.setItem(LS_KEY,session); }
          return r;
      });
  };

  /* ----------  refs ---------- */
  const startBtn=$("#startBtn"), stopBtn=$("#stopBtn"), statusMsg=$("#statusMsg"), preview=$("#preview");
  const shareWrap=$("#shareWrap"), copyLinkBtn=$("#copyLink"), copySecure=$("#copySecure"),
        copyPublic=$("#copyPublic"), disablePublic=$("#disablePublic"), shareEmail=$("#shareEmail");
  const openClip=$("#openClip"), clipPanel=$("#clipPanel"), clipGo=$("#clipGo"), clipCancel=$("#clipCancel");
  const openEmbed=$("#openEmbed"), embedDlg=$("#embedModal"), embedWidth=$("#embedWidth"),
        embedHeight=$("#embedHeight"), embedBox=$("#embedCode"), embedCopy=$("#embedCopy"), embedClose=$("#embedClose");
  const emailDlg=$("#emailModal"), emailInput=$("#emailTo"), emailSend=$("#emailSend"),
        emailClose=$("#emailClose"), emailStatus=$("#emailStatus");
  // NEW:
  const resumeBtn = document.createElement("button");
  resumeBtn.id="resumeBtn"; resumeBtn.className="btn"; resumeBtn.textContent="🔄 Resume My Recordings";
  const forgetBtn = document.createElement("button");
  forgetBtn.id="forgetSession"; forgetBtn.className="btn cancel"; forgetBtn.textContent="🗑️ Forget My Session";
  shareWrap.insertAdjacentElement("afterend", resumeBtn);
  shareWrap.insertAdjacentElement("afterend", forgetBtn);

  /* ----------  misc helpers ---------- */
  const REC_BASE = (["localhost","127.0.0.1"].includes(location.hostname)?"/static/recordings/":"/recordings/");
  const full = (f)=> `${location.origin}${REC_BASE}${f}`;

  let mediaRecorder, chunks=[], fileName="", secureUrl="";

  /* ==========  recording  ========== */
  startBtn.onclick = async ()=>{
    try{
      const stream = await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
      mediaRecorder=new MediaRecorder(stream); chunks=[];
      mediaRecorder.ondataavailable=e=>chunks.push(e.data);
      mediaRecorder.onstop=async()=>{
        const fd=new FormData(); fd.append("video",new Blob(chunks,{type:"video/webm"}),"rec.webm");
        statusMsg.textContent="⏫ Uploading…";
        const r = await apiFetch("/upload",{method:"POST",body:fd}).then(x=>x.json());
        if(r.status==="ok"){
          fileName=r.filename; secureUrl=r.url;
          preview.src=full(fileName); preview.classList.remove("hidden"); shareWrap.classList.remove("hidden");
          statusMsg.innerHTML=`✅ Saved – <a href="${full(fileName)}" download>Download</a>`;
        }else statusMsg.textContent="❌ "+r.error;
        startBtn.disabled=false;
      };
      mediaRecorder.start(); statusMsg.textContent="🎬 Recording…";
      startBtn.disabled=true; stopBtn.disabled=false;
    }catch(e){ alert("Screen‑capture denied."); }
  };
  stopBtn.onclick=()=>{ if(mediaRecorder?.state==="recording"){ mediaRecorder.stop(); stopBtn.disabled=true; } };

  /* ==========  share  ========== */
  copyLinkBtn.onclick = ()=> fileName?copy(full(fileName),copyLinkBtn):alert("⚠ No file.");
  copySecure.onclick  = async ()=>{
      if(!fileName) return alert("⚠ No file.");
      const r=await apiFetch(`/link/secure/${fileName}`).then(x=>x.json());
      if(r.status==="ok"){ secureUrl=r.url; copy(secureUrl,copySecure,"✅ Secure link"); }
  };
  copyPublic.onclick  = async ()=>{
      if(!fileName) return alert("⚠ No file.");
      const r=await apiFetch(`/link/public/${fileName}`).then(x=>x.json());
      r.status==="ok"?copy(r.url,copyPublic):alert("❌ "+r.error);
  };
  disablePublic.onclick=async()=>{
      if(!fileName) return alert("⚠ No file.");
      const r=await apiFetch(`/link/public/${fileName}`,{method:"DELETE"}).then(x=>x.json());
      alert(r.status==="ok"?"✅ Public link removed":"❌ "+r.error);
  };

  /* ==========  email  ========== */
  shareEmail.onclick = ()=> fileName?(emailDlg.showModal(),emailInput.focus()):alert("⚠ No recording.");
  emailClose.onclick = ()=> emailDlg.close();
  emailSend.onclick  = async ()=>{
    const to=emailInput.value.trim(); if(!to) return emailStatus.textContent="❌ Enter e‑mail.";
    emailSend.disabled=true; emailSend.textContent="⏳…";
    const r=await apiFetch("/send_email",{method:"POST",headers:{"Content-Type":"application/json"},
               body:JSON.stringify({to,url:secureUrl||full(fileName)})}).then(x=>x.json());
    emailStatus.textContent=r.status==="ok"?"✅ Sent!":"❌ "+r.error;
    emailSend.disabled=false; emailSend.textContent="📤 Send";
  };

  /* ==========  clip  ========== */
  openClip.onclick   = ()=>clipPanel.classList.toggle("hidden");
  clipCancel.onclick = ()=>clipPanel.classList.add("hidden");
  clipGo.onclick     = async ()=>{
    const s=+$("#clipStart").value,e=+$("#clipEnd").value;
    if(!fileName) return alert("⚠ No recording."); if(s>=e) return alert("⚠ Range.");
    clipGo.disabled=true; clipGo.textContent="⏳…";
    const r=await apiFetch(`/clip/${fileName}`,{method:"POST",headers:{"Content-Type":"application/json"},
                 body:JSON.stringify({start:s,end:e})}).then(x=>x.json());
    r.status==="ok"?copy(full(r.clip),clipGo,"✅ Copied!"):alert("❌ "+r.error);
    clipGo.disabled=false; clipGo.textContent="📤 Share Clip";
  };

  /* ==========  embed  ========== */
  const iframe=()=>`<iframe width="${embedWidth.value}" height="${embedHeight.value}" src="${full(fileName)}" frameborder="0" allowfullscreen></iframe>`;
  openEmbed.onclick = ()=>fileName?(embedBox.value=iframe(),embedDlg.showModal()):alert("⚠ No recording.");
  embedWidth.oninput=embedHeight.oninput=()=>embedBox.value=iframe();
  embedCopy.onclick = ()=>copy(embedBox.value,embedCopy);
  embedClose.onclick=()=>embedDlg.close();

  /* ==========  resume / forget  ========== */
  resumeBtn.onclick = async ()=>{
    const r=await apiFetch("/my/files").then(x=>x.json());
    if(r.status!=="ok"||!r.files.length) return alert("No previous recordings.");
    const links=r.files.map(f=>`<li><a href="${full(f)}" target="_blank">${f}</a></li>`).join("");
    const dlg=document.createElement("dialog"); dlg.innerHTML=`<h3>My Recordings</h3><ul>${links}</ul><button>Close</button>`;
    dlg.querySelector("button").onclick=()=>dlg.close();
    document.body.appendChild(dlg); dlg.showModal();
  };
  forgetBtn.onclick = async ()=>{
    await apiFetch("/forget_session",{method:"POST"});
    localStorage.removeItem("gs_session"); document.cookie="session=;expires=Thu,01 Jan 1970 00:00:00 GMT";
    alert("🔄 Session cleared. Reloading…"); location.reload();
  };
});
/* ─────────────────────────────────────────────── */
