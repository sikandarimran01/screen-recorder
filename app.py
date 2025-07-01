from flask import (
    Flask, render_template, send_from_directory,
    request, jsonify
)
from flask_mail import Mail, Message
import datetime, os, subprocess

app = Flask(__name__)

# ── Mail (use Render env vars!) ────────────────────────────
app.config.update(
    MAIL_SERVER="smtp.gmail.com",
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),   # set in Render dashboard
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),   # Gmail App‑Password
    MAIL_DEFAULT_SENDER=("GrabScreen", os.getenv("MAIL_USERNAME")),
)
mail = Mail(app)

# ── Paths & FFmpeg settings ───────────────────────────────
EXT    = "webm"
FFMPEG = "ffmpeg"
RECDIR = "static/recordings"
os.makedirs(RECDIR, exist_ok=True)     # auto‑create at start‑up

# ── Routes ────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html",
                           year=datetime.datetime.now().year)

# ---------- Upload endpoint (browser → server) ------------
@app.route("/upload", methods=["POST"])
def upload():
    f = request.files["video"]
    fname = datetime.datetime.now().strftime(f"recording_%Y%m%d_%H%M%S.webm")
    save_path = os.path.join(RECDIR, fname)

    try:
        print("📁 Uploading file to:", os.path.abspath(save_path))  # 🔍 this shows full path
        f.save(save_path)
    except Exception as e:
        print("❌ Save failed:", e)
        return jsonify({"status": "fail", "error": str(e)}), 500

    return jsonify({"status": "ok", "filename": fname, "url": f"/{save_path}"})


# ---------- Trim / clip with FFmpeg (re‑encode) -----------
@app.route("/clip/<orig>", methods=["POST"])
def clip(orig):
    data = request.get_json()
    start, end = float(data["start"]), float(data["end"])
    if start >= end:
        return jsonify({"status": "fail", "error": "start >= end"}), 400

    in_path = os.path.join(RECDIR, orig)
    if not os.path.exists(in_path):
        return jsonify({"status": "fail", "error": "file not found"}), 404

    clip_name = datetime.datetime.now().strftime("clip_%Y%m%d_%H%M%S.") + EXT
    out_path  = os.path.join(RECDIR, clip_name)
    duration  = end - start

    cmd = [
        FFMPEG, "-hide_banner", "-loglevel", "error",
        "-ss", str(start),
        "-t",  str(duration),
        "-i",  in_path,
        "-c:v", "libvpx",     # VP8 video
        "-c:a", "libvorbis",  # Vorbis audio
        "-y",  out_path
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return jsonify({"status": "ok", "clip": clip_name})
    except subprocess.CalledProcessError as e:
        return jsonify({"status": "fail",
                        "error": e.stderr.strip()}), 500

# ---------- Helper test page (manual upload) --------------
@app.route("/test_upload", methods=["GET", "POST"])
def test_upload():
    if request.method == "POST":
        f = request.files["file"]
        path = os.path.join(RECDIR, f.filename)
        f.save(path)
        return f"Uploaded to {path}"
    # simple HTML form for manual testing
    return """
    <h2>Manual Upload Test</h2>
    <form method="POST" enctype="multipart/form-data">
        <input type="file" name="file" required />
        <input type="submit" value="Upload" />
    </form>
    """

# ---------- Send share‑link e‑mail ------------------------
@app.route("/send_email", methods=["POST"])
def send_email():
    data = request.get_json()
    to  = data["to"]
    url = data["url"]
    try:
        mail.send(Message("GrabScreen recording",
                          recipients=[to],
                          body=f"Hi,\n\nHere is the recording link:\n{url}\n\nEnjoy!"))
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "fail", "error": str(e)}), 500

# ---------- Direct download ------------------------------
@app.route("/download/<fname>")
def download(fname):
    return send_from_directory(RECDIR, fname, as_attachment=True)

# ── Run locally only ──────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True)
