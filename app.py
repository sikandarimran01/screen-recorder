from flask import Flask, render_template, send_from_directory, request, jsonify
from flask_mail import Mail, Message
import datetime, os, subprocess

app = Flask(__name__)

# ── Mail (use Render env vars!) ────────────────────────────
app.config.update(
    MAIL_SERVER   = "smtp.gmail.com",
    MAIL_PORT     = 587,
    MAIL_USE_TLS  = True,
    MAIL_USERNAME = os.getenv("MAIL_USERNAME"),   # set in Render dashboard
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD"),   # App‑Password
    MAIL_DEFAULT_SENDER = ("GrabScreen", os.getenv("MAIL_USERNAME")),
)

mail = Mail(app)

# ── Paths & FFmpeg settings ───────────────────────────────
EXT    = "webm"
FFMPEG = "ffmpeg"
RECDIR = "static/recordings"
os.makedirs(RECDIR, exist_ok=True)

# ── Routes ────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html", year=datetime.datetime.now().year)

# Browser uploads the finished recording here
@app.route("/upload", methods=["POST"])
def upload():
    f = request.files["video"]
    fname = datetime.datetime.now().strftime(f"recording_%Y%m%d_%H%M%S.{EXT}")
    save_path = os.path.join(RECDIR, fname)
    f.save(save_path)
    return jsonify({"status": "ok", "filename": fname, "url": f"/{save_path}"})

# Trim / clip with FFmpeg copy‑stream (no re‑encode)
@app.route("/clip/<orig>", methods=["POST"])
def clip(orig):
    data = request.get_json()
    start, end = float(data["start"]), float(data["end"])
    if start >= end:
        return jsonify({"status": "fail", "error": "start>=end"}), 400
    in_path = os.path.join(RECDIR, orig)
    if not os.path.exists(in_path):
        return jsonify({"status": "fail", "error": "file not found"}), 404
    clip_name = datetime.datetime.now().strftime("clip_%Y%m%d_%H%M%S.") + EXT
    out_path  = os.path.join(RECDIR, clip_name)
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error",
           "-ss", str(start), "-t", str(end), "-i", in_path,
           "-c", "copy", "-y", out_path]
    subprocess.run(cmd, check=True)
    return jsonify({"status": "ok", "clip": clip_name})

# Send email with share link
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

# Direct download
@app.route("/download/<fname>")
def download(fname):
    return send_from_directory(RECDIR, fname, as_attachment=True)

# ── Run locally only ──────────────────────────────────────
if __name__ == "__main__":
    os.makedirs("static/recordings", exist_ok=True)
    app.run(debug=True)
