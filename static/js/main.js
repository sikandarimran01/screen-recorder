/* ------- DOM helpers ------- */
const $ = sel => document.querySelector(sel);

// Elements
const startBtn    = $('#startBtn');
const stopBtn     = $('#stopBtn');
const statusMsg   = $('#statusMsg');
const preview     = $('#preview');
const shareWrap   = $('#shareWrap');
const copyLinkBtn = $('#copyLink');
const shareEmail  = $('#shareEmail');
const openClip    = $('#openClip');
const openEmbed   = $('#openEmbed');
const clipPanel   = $('#clipPanel');
const clipGo      = $('#clipGo');
const clipCancel  = $('#clipCancel');
const embedDlg    = $('#embedModal');
const embedWidth  = $('#embedWidth');
const embedHeight = $('#embedHeight');
const embedBox    = $('#embedCode');
const embedCopy   = $('#embedCopy');
const embedClose  = $('#embedClose');
const emailDlg    = $('#emailModal');
const emailInput  = $('#emailTo');
const emailSend   = $('#emailSend');
const emailClose  = $('#emailClose');

let fileName = "";

/* ------- Recording controls ------- */
startBtn.onclick = async () => {
  await fetch('/start', { method: 'POST' });
  statusMsg.textContent = '🎬 Recording...';
  startBtn.disabled = true;
  stopBtn.disabled = false;
};

stopBtn.onclick = async () => {
  const r = await fetch('/stop', { method: 'POST' }).then(r => r.json());
  fileName = r.filename;
  preview.src = `/static/recordings/${fileName}`;
  preview.classList.remove('hidden');
  shareWrap.classList.remove('hidden');
  statusMsg.innerHTML = `✅ Saved <a href="/download/${fileName}" download>Download</a>`;
  stopBtn.disabled = true;
  startBtn.disabled = false;
};

/* ------- Share options ------- */
copyLinkBtn.onclick = () => {
  if (!fileName) return alert('⚠ No file to share yet.');
  copyToClipboard(`${location.origin}/static/recordings/${fileName}`, copyLinkBtn);
};

// Show email modal
/* ---------- Email modal ---------- */
const emailStatus = $('#emailStatus');  // <-- new handle

shareEmail.onclick = () => {
  if (!fileName) return alert('⚠ No recording available.');
  emailInput.value = '';
  emailStatus.textContent = '';         // clear previous messages
  emailDlg.showModal();
};

emailClose.onclick = () => emailDlg.close();

emailSend.onclick = async () => {
  const to = emailInput.value.trim();
  if (!to) {
    emailStatus.textContent = '❌ Please enter a valid e‑mail address.';
    emailStatus.style.color = 'var(--danger)';
    return;
  }

  emailSend.disabled = true;
  emailSend.textContent = '⏳ Sending…';
  emailStatus.textContent = '';

  const url = `${location.origin}/static/recordings/${fileName}`;

  try {
    const res = await fetch('/send_email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, url })
    }).then(r => r.json());

    if (res.status === 'ok') {
      emailStatus.textContent = '✅ E‑mail sent successfully!';
      emailStatus.style.color = 'var(--success)';
    } else {
      emailStatus.textContent = '❌ Failed to send e‑mail: ' + res.error;
      emailStatus.style.color = 'var(--danger)';
    }
  } catch (err) {
    emailStatus.textContent = '❌ Network error — try again.';
    emailStatus.style.color = 'var(--danger)';
  } finally {
    emailSend.disabled = false;
    emailSend.textContent = '📤 Send';
  }
};




/* ------- Clip panel ------- */
openClip.onclick = () => {
  const hidden = clipPanel.classList.toggle('hidden');
  clipPanel.classList.toggle('fade-in', !hidden);
};

clipCancel.onclick = () => {
  clipPanel.classList.add('hidden');
  clipPanel.classList.remove('fade-in');
};

clipGo.onclick = async () => {
  const start = +$('#clipStart').value;
  const end = +$('#clipEnd').value;

  if (!fileName) return alert('⚠ No recording found to clip.');
  if (start >= end) return alert('⚠ Invalid clip range.');

  clipGo.disabled = true;
  clipGo.textContent = '⏳ Cutting...';

  try {
    const res = await fetch(`/clip/${fileName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end })
    }).then(r => r.json());

    if (res.status === 'ok') {
      const url = `${location.origin}/static/recordings/${res.clip}`;
      copyToClipboard(url, clipGo, '✅ Clip link copied!');
    } else {
      throw new Error('Clip failed');
    }
  } catch {
    alert('❌ Clip failed');
  } finally {
    clipGo.disabled = false;
    clipGo.textContent = '📤 Share Clip';
  }
};

/* ------- Embed modal ------- */
function showEmbedModal() {
  if (!fileName) return alert('⚠ No recording available to embed.');
  embedBox.value = makeIframe();
  embedDlg.showModal();
}

openEmbed.onclick = showEmbedModal;

embedWidth.oninput = embedHeight.oninput = () => {
  embedBox.value = makeIframe();
};

embedCopy.onclick = () => {
  copyToClipboard(embedBox.value, embedCopy, '✅ Copied!');
};

embedClose.onclick = () => embedDlg.close();

/* ------- Helpers ------- */
function makeIframe() {
  return `<iframe width="${embedWidth.value}" height="${embedHeight.value}" src="${location.origin}/static/recordings/${fileName}" frameborder="0" allowfullscreen></iframe>`;
}

function copyToClipboard(text, btn, ok = '✅ Copied!') {
  navigator.clipboard.writeText(text).then(() => {
    const old = btn.textContent;
    btn.textContent = ok;
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = old;
      btn.disabled = false;
    }, 2000);
  });
}
