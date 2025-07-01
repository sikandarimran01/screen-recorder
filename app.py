from flask import (
    Flask, render_template, request, jsonify,
    send_from_directory, make_response
)
from flask_mail import Mail, Message
import datetime, os, subprocess, json, random, string, uuid
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

app = Flask(__name__)

# ── Mail config (set via ENV in Render) ─────────────────
app.config.update(
    MAIL_SERVER="smtp.gmail.com",
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_DEFAULT_SENDER=("GrabScreen", os.getenv("MAIL_USERNAME")),
)

# ── Security settings ───────────────────────────────────
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret")
serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])
TOKEN_EXPIRY_SECONDS = 15 * 60  # 15 minutes

mail = Mail(app)

# ── Storage paths ───────────────────────────────────────
EXT     = "webm"
FFMPEG  = "ffmpeg"
RECDIR  = "/mnt/recordings"
os.makedirs(RECDIR, exist_ok=True)

# ── Persistent public link storage ──────────────────────
LINKS_FILE = "public_links.json"
SESSIONS_FILE = "user_sessions.json"

if os.path.exists(LINKS_FILE):
    with open(LINKS_FILE, "r") as f:
        public_links = json.load(f)
else:
    public_links = {}

def save_links():
    with open(LINKS_FILE, "w") as f:
        json.dump(public_links, f)

if os.path.exists(SESSIONS_FILE):
    with open(SESSIONS_FILE, "r") as f:
        user_sessions = json.load(f)
else:
    user_sessions = {}

def save_sessions():
    with open(SESSIONS_FILE, "w") as f:
        json.dump(user_sessions, f)

# ─────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", year=datetime.datetime.now().year)

@app.route("/upload", methods=["POST"])
def upload():
    video_file = request.files.get("video")
    if not video_file:
        return jsonify({"status": "fail", "error": "No file"}), 400

    fname = datetime.datetime.now().strftime("recording_%Y%m%d_%H%M%S.webm")
    save_path = os.path.join(RECDIR, fname)

    try:
        video_file.save(save_path)
    except Exception as e:
        return jsonify({"status": "fail", "error": str(e)}), 500

    token = request.cookies.get("magic_token")
    if not token or token not in user_sessions:
        token = uuid.uuid4().hex[:16]
        user_sessions[token] = []

    user_sessions[token].append(fname)
    save_sessions()

    response = jsonify({"status": "ok", "filename": fname, "url": f"/recordings/{fname}"})
    response.set_cookie("magic_token", token, max_age=365*24*60*60)
    return response

@app.route("/session/files")
def session_files():
    token = request.cookies.get("magic_token")
    if not token or token not in user_sessions:
        return jsonify({"status": "empty", "files": []})
    return jsonify({"status": "ok", "files": user_sessions[token]})

@app.route("/session/forget", methods=["POST"])
def forget_session():
    token = request.cookies.get("magic_token")
    if token and token in user_sessions:
        del user_sessions[token]
        save_sessions()
    response = jsonify({"status": "ok"})
    response.set_cookie("magic_token", "", expires=0)
    return response

@app.route("/clip/<orig>", methods=["POST"])
def clip(orig):
    try:
        data = request.get_json(force=True)
        start = float(data["start"])
        end = float(data["end"])
    except Exception as e:
        return jsonify({"status": "fail", "error": f"Invalid JSON: {str(e)}"}), 400

    if start >= end:
        return jsonify({"status": "fail", "error": "Start time must be less than end time"}), 400

    in_path = os.path.join(RECDIR, orig)
    if not os.path.exists(in_path):
        return jsonify({"status": "fail", "error": "Original file not found"}), 404

    clip_name = datetime.datetime.now().strftime("clip_%Y%m%d_%H%M%S.webm")
    out_path = os.path.join(RECDIR, clip_name)
    duration = end - start

    cmd = [
        FFMPEG, "-hide_banner", "-loglevel", "error",
        "-ss", str(start), "-t", str(duration), "-i", in_path,
        "-c:v", "libvpx-vp9", "-b:v", "1M",
        "-c:a", "libopus", "-b:a", "128k",
        "-y", out_path
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return jsonify({"status": "ok", "clip": clip_name})
    except subprocess.CalledProcessError as e:
        return jsonify({"status": "fail", "error": e.stderr}), 500

@app.route("/recordings/<fname>")
def recordings(fname):
    return send_from_directory(RECDIR, fname)

@app.route("/download/<fname>")
def download(fname):
    return send_from_directory(RECDIR, fname, as_attachment=True)

@app.route("/link/secure/<fname>")
def generate_secure_link(fname):
    if not os.path.exists(os.path.join(RECDIR, fname)):
        return jsonify({"status": "fail", "error": "file not found"}), 404

    token = serializer.dumps(fname)
    url = request.url_root.rstrip("/") + "/secure/" + token
    return jsonify({"status": "ok", "url": url})

@app.route("/secure/<token>")
def secure_download(token):
    try:
        fname = serializer.loads(token, max_age=TOKEN_EXPIRY_SECONDS)
    except SignatureExpired:
        return "⏳ Link expired.", 410
    except BadSignature:
        return "❌ Invalid link.", 400
    return send_from_directory(RECDIR, fname)

@app.route("/link/public/<fname>", methods=["GET"])
def get_or_create_public_link(fname):
    if not os.path.exists(os.path.join(RECDIR, fname)):
        return jsonify({"status": "fail", "error": "File not found"}), 404

    for token, f in public_links.items():
        if f == fname:
            url = request.url_root.rstrip("/") + "/public/" + token
            return jsonify({"status": "ok", "url": url})

    token = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
    public_links[token] = fname
    save_links()
    return jsonify({"status": "ok", "url": request.url_root.rstrip("/") + "/public/" + token})

@app.route("/link/public/<fname>", methods=["DELETE"])
def delete_public_link(fname):
    removed = False
    for token, f in list(public_links.items()):
        if f == fname:
            del public_links[token]
            removed = True
    if removed:
        save_links()
        return jsonify({"status": "ok", "message": "Link removed"})
    return jsonify({"status": "fail", "error": "No public link found"}), 404

@app.route("/public/<token>")
def serve_public_file(token):
    fname = public_links.get(token)
    if not fname:
        return "❌ Invalid or expired link.", 404
    return send_from_directory(RECDIR, fname)

@app.route("/send_email", methods=["POST"])
def send_email():
    data = request.get_json()
    try:
        mail.send(Message(
            "GrabScreen recording",
            recipients=[data["to"]],
            body=f"Hi,\n\nHere is your recording:\n{data['url']}\n\nEnjoy!"
        ))
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "fail", "error": str(e)}), 500

@app.route("/debug/files")
def list_files():
    return "<br>".join(sorted(os.listdir(RECDIR)))

@app.route("/delete/<filename>", methods=["POST"])
def delete_file(filename):
    file_path = os.path.join(RECDIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"status": "fail", "error": "File not found"}), 404
    try:
        os.remove(file_path)
        return jsonify({"status": "ok", "message": f"{filename} deleted"})
    except Exception as e:
        return jsonify({"status": "fail", "error": str(e)}), 500

# ── Local testing ────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True)
