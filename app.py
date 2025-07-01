"""
app.py — GrabScreen backend
Adds “Magic‑Token Session” support so every browser gets its own
anonymous token that’s sent with each request.
"""

from flask import (
    Flask, render_template, request, jsonify, send_from_directory
)
from flask_mail import Mail, Message
import datetime, os, subprocess, json, random, string
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

# ───────────────────────────────────────────────
app = Flask(__name__)

# ---------------- Mail -------------------------
app.config.update(
    MAIL_SERVER="smtp.gmail.com",
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_DEFAULT_SENDER=("GrabScreen", os.getenv("MAIL_USERNAME")),
)

# ---------------- Security ---------------------
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret")
serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])
TOKEN_EXPIRY_SECONDS = 15 * 60          # secure‑link lifetime (15 min)

# 🆕  session‑token lifetime (in days) – just for pruning
SESSION_MAX_AGE = 90

mail = Mail(app)

# ---------------- Storage ----------------------
EXT     = "webm"
FFMPEG  = "ffmpeg"
RECDIR  = "/mnt/recordings"
os.makedirs(RECDIR, exist_ok=True)

# ---------------- Persistent data --------------
LINKS_FILE   = "public_links.json"
SESS_FILE    = "sessions.json"      # 🆕  maps session → {created, files:[…]}

def _load_json(path):
    return json.load(open(path)) if os.path.exists(path) else {}

public_links = _load_json(LINKS_FILE)      # random‑ID → fname
sessions     = _load_json(SESS_FILE)       # session‑token → meta

def _save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

# helper – generate a 32‑character random session token
def _new_session():
    return ''.join(random.choices(string.ascii_letters + string.digits, k=32))

# helper – fetch or create session token sent by the browser
def get_session():
    token = request.headers.get("X‑Session") or request.cookies.get("session")
    if token and token in sessions:
        return token
    # create a fresh one
    token = _new_session()
    sessions[token] = {
        "created": datetime.datetime.utcnow().isoformat(),
        "files": []
    }
    _save_json(SESS_FILE, sessions)
    return token
# ───────────────────────────────────────────────
# Routes
# ───────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", year=datetime.datetime.now().year)

# ---------------- Upload -----------------------
@app.route("/upload", methods=["POST"])
def upload():
    token = get_session()                     # 🆕 who’s uploading
    video_file = request.files.get("video")
    if not video_file:
        return jsonify({"status": "fail", "error": "No file"}), 400

    fname = datetime.datetime.now().strftime("recording_%Y%m%d_%H%M%S.webm")
    save_path = os.path.join(RECDIR, fname)
    try:
        video_file.save(save_path)
    except Exception as e:
        return jsonify({"status": "fail", "error": str(e)}), 500

    # associate file with session & persist
    sessions[token]["files"].append(fname)
    _save_json(SESS_FILE, sessions)

    # generate FIRST secure view‑token right away
    view_token = serializer.dumps(fname)
    secure_url = request.url_root.rstrip("/") + "/secure/" + view_token

    resp = jsonify({
        "status": "ok",
        "filename": fname,
        "url": secure_url          # frontend keeps this as 15‑min link
    })
    # send session back as cookie (also expect it in X‑Session header)
    resp.set_cookie("session", token, max_age=SESSION_MAX_AGE*24*3600, samesite="Lax")
    return resp

# ---------------- Clip -------------------------
@app.route("/clip/<orig>", methods=["POST"])
def clip(orig):
    data = request.get_json(force=True)
    start = float(data["start"]);  end = float(data["end"])
    if start >= end:
        return jsonify({"status": "fail", "error": "start >= end"}), 400
    in_path = os.path.join(RECDIR, orig)
    if not os.path.exists(in_path):
        return jsonify({"status": "fail", "error": "file not found"}), 404

    clip_name = datetime.datetime.now().strftime("clip_%Y%m%d_%H%M%S.webm")
    out_path  = os.path.join(RECDIR, clip_name)
    duration  = end - start
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error",
           "-ss", str(start), "-t", str(duration), "-i", in_path,
           "-c:v", "libvpx-vp9", "-b:v", "1M",
           "-c:a", "libopus", "-b:a", "128k", "-y", out_path]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        return jsonify({"status": "fail", "error": e.stderr}), 500

    # attach clip to same session
    token = get_session()
    sessions[token]["files"].append(clip_name)
    _save_json(SESS_FILE, sessions)
    return jsonify({"status": "ok", "clip": clip_name})

# ---------------- Serving raw files ------------
@app.route("/recordings/<fname>")
def recordings(fname):
    return send_from_directory(RECDIR, fname)

@app.route("/public/<token>")
def serve_public_file(token):
    fname = public_links.get(token)
    if not fname:
        return "❌ Invalid or expired link.", 404
    return send_from_directory(RECDIR, fname)


# ---------------- Secure 15‑min token -----------
@app.route("/link/secure/<fname>")
def secure_link(fname):
    if not os.path.exists(os.path.join(RECDIR, fname)):
        return jsonify({"status": "fail", "error": "file not found"}), 404
    view_token = serializer.dumps(fname)
    url = request.url_root.rstrip("/") + "/secure/" + view_token
    return jsonify({"status": "ok", "url": url})

@app.route("/secure/<token>")
def secure_view(token):
    try:
        fname = serializer.loads(token, max_age=TOKEN_EXPIRY_SECONDS)
    except SignatureExpired:
        return "⏳ Link expired.", 410
    except BadSignature:
        return "❌ Invalid link.", 400
    return send_from_directory(RECDIR, fname)

# ---------------- Public links -----------------
@app.route("/link/public/<fname>", methods=["GET", "DELETE"])
def public_link(fname):
    if not os.path.exists(os.path.join(RECDIR, fname)):
        return jsonify({"status": "fail", "error": "File not found"}), 404

    if request.method == "GET":
        # reuse if exists
        for t, f in public_links.items():
            if f == fname:
                url = request.url_root.rstrip("/") + "/public/" + t
                return jsonify({"status": "ok", "url": url})
        token = ''.join(random.choices(string.ascii_letters+string.digits, k=12))
        public_links[token] = fname
        _save_json(LINKS_FILE, public_links)
        return jsonify({"status": "ok",
                        "url": request.url_root.rstrip('/') + "/public/"+token})

    # DELETE
    removed = False
    for t, f in list(public_links.items()):
        if f == fname:
            del public_links[t];  removed = True
    _save_json(LINKS_FILE, public_links)
    if removed:
        return jsonify({"status": "ok"})
    return jsonify({"status": "fail", "error": "No public link"}), 404

# ---------------- Email ------------------------
@app.route("/send_email", methods=["POST"])
def send_email():
    data = request.get_json(force=True)
    try:
        mail.send(Message("GrabScreen recording",
                          recipients=[data["to"]],
                          body=f"Hi!\nHere is your recording:\n{data['url']}"))
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "fail", "error": str(e)}), 500

# ---------------- My recordings (optional) -----
@app.route("/my/files")
def my_files():
    token = get_session()
    return jsonify({"status": "ok", "files": sessions[token]["files"]})

# ---------------- Debug list all ---------------
@app.route("/debug/files")
def list_files():
    return "<br>".join(sorted(os.listdir(RECDIR)))

# ---------------- Delete -----------------------
@app.route("/delete/<fname>", methods=["POST"])
def delete(fname):
    path = os.path.join(RECDIR, fname)
    if not os.path.exists(path):
        return jsonify({"status": "fail", "error": "not found"}), 404
    os.remove(path)
    return jsonify({"status": "ok"})

# ── Local testing ──────────────────────────────
if __name__ == "__main__":
    app.run(debug=True)
