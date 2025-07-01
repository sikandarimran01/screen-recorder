# app.py  –  GrabScreen backend with persistent “Magic Link” history
from flask import (
    Flask, render_template, request, jsonify, send_from_directory
)
from flask_mail import Mail, Message
import datetime, os, subprocess, json, random, string, time
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

app = Flask(__name__)

# ────────────────  Mail  ─────────────────────────────────────────
app.config.update(
    MAIL_SERVER="smtp.gmail.com",
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_DEFAULT_SENDER=("GrabScreen", os.getenv("MAIL_USERNAME")),
)
mail = Mail(app)

# ───────────────  Security  ─────────────────────────────────────
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret")
serializer           = URLSafeTimedSerializer(app.config["SECRET_KEY"])
TOKEN_EXPIRY_SECONDS = 15 * 60   # 15 minutes

# ───────────────  Paths / FFmpeg  ───────────────────────────────
EXT      = "webm"
FFMPEG   = "ffmpeg"
RECDIR   = "/mnt/recordings"
os.makedirs(RECDIR, exist_ok=True)

# ───────────────  Persistent link stores  ───────────────────────
LINKS_FILE        = "public_links.json"
SECURE_FILE       = "secure_links.json"   # NEW
public_links      = json.load(open(LINKS_FILE))  if os.path.exists(LINKS_FILE)  else {}
secure_links      = json.load(open(SECURE_FILE)) if os.path.exists(SECURE_FILE) else {}

def _save_json(path: str, data: dict):
    with open(path, "w") as fh:
        json.dump(data, fh)

def save_public(): _save_json(LINKS_FILE, public_links)
def save_secure(): _save_json(SECURE_FILE, secure_links)

def _now() -> int:               # epoch‑seconds helper
    return int(time.time())

def _token_valid(ts: int) -> bool:
    """Return True if epoch `ts` is within expiry window."""
    return _now() - ts < TOKEN_EXPIRY_SECONDS

# ─────────────────────────  Routes  ─────────────────────────────
@app.route("/")
def index():
    return render_template("index.html", year=datetime.datetime.now().year)

# ---------- Upload ----------------------------------------------------------
@app.route("/upload", methods=["POST"])
def upload():
    vid = request.files.get("video")
    if not vid:
        return jsonify(status="fail", error="No file"), 400

    fname     = datetime.datetime.now().strftime("recording_%Y%m%d_%H%M%S.webm")
    save_path = os.path.join(RECDIR, fname)
    try:
        vid.save(save_path)
    except Exception as e:
        return jsonify(status="fail", error=str(e)), 500

    return jsonify(status="ok", filename=fname, url=f"/recordings/{fname}")

# ---------- Clip / Trim ------------------------------------------------------
@app.route("/clip/<orig>", methods=["POST"])
def clip(orig):
    try:
        data   = request.get_json(force=True)
        start  = float(data["start"])
        end    = float(data["end"])
    except Exception as e:
        return jsonify(status="fail", error=f"Invalid JSON: {e}"), 400
    if start >= end:
        return jsonify(status="fail", error="start >= end"), 400

    src = os.path.join(RECDIR, orig)
    if not os.path.exists(src):
        return jsonify(status="fail", error="file not found"), 404

    dst      = datetime.datetime.now().strftime("clip_%Y%m%d_%H%M%S.webm")
    dst_path = os.path.join(RECDIR, dst)
    dur      = end - start
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error",
           "-ss", str(start), "-t", str(dur), "-i", src,
           "-c:v", "libvpx-vp9", "-b:v", "1M",
           "-c:a", "libopus", "-b:a", "128k", "-y", dst_path]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return jsonify(status="ok", clip=dst)
    except subprocess.CalledProcessError as e:
        return jsonify(status="fail", error=e.stderr), 500

# ---------- Raw file serve ---------------------------------------------------
@app.route("/recordings/<fname>")
def recordings(fname):
    return send_from_directory(RECDIR, fname)

@app.route("/download/<fname>")
def download(fname):
    return send_from_directory(RECDIR, fname, as_attachment=True)

# ---------- 🔒 Secure / “Magic” links ----------------------------------------
@app.route("/link/secure/<fname>", methods=["GET"])
def link_secure(fname):
    """Return an existing valid token OR create a new one."""
    fpath = os.path.join(RECDIR, fname)
    if not os.path.exists(fpath):
        return jsonify(status="fail", error="file not found"), 404

    # Re‑use token if still valid
    for token, meta in secure_links.items():
        if meta["file"] == fname and _token_valid(meta["ts"]):
            url = request.url_root.rstrip("/") + "/secure/" + token
            return jsonify(status="ok", url=url)

    # Otherwise mint new token
    token          = serializer.dumps(fname)
    secure_links[token] = {"file": fname, "ts": _now()}
    save_secure()
    url = request.url_root.rstrip("/") + "/secure/" + token
    return jsonify(status="ok", url=url)

@app.route("/link/secure/<fname>", methods=["DELETE"])
def revoke_secure(fname):
    """Delete any secure tokens pointing to this file."""
    removed = False
    for token, meta in list(secure_links.items()):
        if meta["file"] == fname:
            del secure_links[token]
            removed = True
    if removed:
        save_secure()
        return jsonify(status="ok", message="Secure link(s) revoked")
    return jsonify(status="fail", error="No secure link found"), 404

@app.route("/secure/<token>")
def serve_secure(token):
    meta = secure_links.get(token)
    if not meta:
        return "❌ Invalid link.", 404
    if not _token_valid(meta["ts"]):
        return "⏳ Link expired.", 410
    # still within window → serve
    fname = meta["file"]
    return send_from_directory(RECDIR, fname)

@app.route("/admin/prune_secure")
def prune_secure():
    """Manually hit this to purge expired secure tokens."""
    before = len(secure_links)
    for t, m in list(secure_links.items()):
        if not _token_valid(m["ts"]):
            del secure_links[t]
    if len(secure_links) != before:
        save_secure()
    return f"Pruned {before - len(secure_links)} token(s). Now {len(secure_links)} remain."

# ---------- 🌐 Public links (permanent) --------------------------------------
@app.route("/link/public/<fname>", methods=["GET"])
def link_public(fname):
    if not os.path.exists(os.path.join(RECDIR, fname)):
        return jsonify(status="fail", error="File not found"), 404
    for token, f in public_links.items():
        if f == fname:
            url = request.url_root.rstrip("/") + "/public/" + token
            return jsonify(status="ok", url=url)

    token = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
    public_links[token] = fname
    save_public()
    return jsonify(status="ok", url=request.url_root.rstrip("/") + "/public/" + token)

@app.route("/link/public/<fname>", methods=["DELETE"])
def delete_public(fname):
    removed = False
    for token, f in list(public_links.items()):
        if f == fname:
            del public_links[token]
            removed = True
    if removed:
        save_public()
        return jsonify(status="ok", message="Link removed")
    return jsonify(status="fail", error="No public link found"), 404

@app.route("/public/<token>")
def serve_public(token):
    fname = public_links.get(token)
    if not fname:
        return "❌ Invalid or expired link.", 404
    return send_from_directory(RECDIR, fname)

# ---------- E‑mail share ------------------------------------------------------
@app.route("/send_email", methods=["POST"])
def send_email():
    data = request.get_json()
    try:
        mail.send(Message(
            "GrabScreen recording",
            recipients=[data["to"]],
            body=f"Hi,\n\nHere is your recording:\n{data['url']}\n\nEnjoy!"
        ))
        return jsonify(status="ok")
    except Exception as e:
        return jsonify(status="fail", error=str(e)), 500

# ---------- Misc helpers ------------------------------------------------------
@app.route("/debug/files")
def list_files():
    return "<br>".join(sorted(os.listdir(RECDIR)))

@app.route("/delete/<filename>", methods=["POST"])
def delete_file(filename):
    path = os.path.join(RECDIR, filename)
    if not os.path.exists(path):
        return jsonify(status="fail", error="File not found"), 404
    try:
        os.remove(path)
        return jsonify(status="ok", message=f"{filename} deleted")
    except Exception as e:
        return jsonify(status="fail", error=str(e)), 500

# ─────────── Local run ──────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True)
