# app.py
from flask import (
    Flask, render_template, request, jsonify,
    send_from_directory
)
from flask_mail import Mail, Message
import datetime, os, subprocess

app = Flask(__name__)

# ── Mail (credentials are ENV VARS on Render) ────────────
app.config.update(
    MAIL_SERVER="smtp.gmail.com",
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_DEFAULT_SENDER=("GrabScreen", os.getenv("MAIL_USERNAME")),
)
mail = Mail(app)

# ── Paths & FFmpeg settings ──────────────────────────────
EXT     = "webm"           # browser uploads WebM
FFMPEG  = "ffmpeg"
RECDIR  = "/mnt/recordings"   # ← mount your disk here
os.makedirs(RECDIR, exist_ok=True)

# ─────────────────────────────────────────────────────────
#  Routes
# ─────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template(
        "index.html",
        year=datetime.datetime.now().year
    )

# ---------- Upload (browser → server) --------------------
@app.route("/upload", methods=["POST"])
def upload():
    video_file = request.files.get("video")
    if not video_file:
        return jsonify({"status": "fail", "error": "No file"}), 400

    fname      = datetime.datetime.now().strftime("recording_%Y%m%d_%H%M%S.webm")
    save_path  = os.path.join(RECDIR, fname)

    try:
        print("📁 Saving to:", save_path)
        video_file.save(save_path)
    except Exception as e:
        print("❌ Save failed:", e)
           return jsonify({"status": "fail", "error": str(e)}), 500)

    # 📢 Return URL that the <video> tag can load
    return jsonify({
        "status":   "ok",
        "filename": fname,
        "url":      f"/recordings/{fname}"
    })

# ---------- Trim / clip ----------------------------------
@app.route("/clip/<orig>", methods=["POST"])
def clip(orig):
    data         = request.get_json()
    start, end   = float(data["start"]), float(data["end"])

    if start >= end:
        return jsonify({"status": "fail", "error": "start >= end"}), 400

    in_path = os.path.join(RECDIR, orig)
    if not os.path.exists(in_path):
        return jsonify({"status": "fail", "error": "file not found"}), 404

    clip_name = datetime.datetime.now().strftime("clip_%Y%m%d_%H%M%S.webm")
    out_path  = os.path.join(RECDIR, clip_name)
    duration  = end - start

    cmd = [
        FFMPEG, "-hide_banner", "-loglevel", "error",
        "-ss", str(start), "-t", str(duration), "-i", in_path,
        "-c:v", "libvpx-vp9", "-b:v", "1M",
        "-c:a", "libopus",    "-b:a", "128k",
        "-y", out_path
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return jsonify({"status": "ok", "clip": clip_name})
    except subprocess.CalledProcessError as e:
        return jsonify({"status": "fail", "error": e.stderr.strip()}), 500

# ---------- Serve recordings & downloads -----------------
@app.route("/recordings/<fname>")
def recordings(fname):
    return send_from_directory(RECDIR, fname)

@app.route("/download/<fname>")
def download(fname):
    return send_from_directory(RECDIR, fname, as_attachment=True)

# ---------- Share link via e‑mail ------------------------
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
        return jsonify({"status": "fail", "error": str(e)}), 500)

# ---------- Simple file‑listing helper -------------------
@app.route("/debug/files")
def list_files():
    return "<br>".join(sorted(os.listdir(RECDIR)))

# ── Local debug run ──────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True)
