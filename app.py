from flask import Flask, render_template, send_from_directory, request, jsonify
from flask_mail import Mail, Message
import datetime, os, subprocess

app = Flask(__name__)

# ── Mail (use Render env vars) ───────────────────────────
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
EXT = "mp4"          # Use "webm" if needed, but change codecs accordingly
FFMPEG = "ffmpeg"
RECDIR = "/mnt/recordings"  # Make sure Render disk is mounted here
os.makedirs(RECDIR, exist_ok=True)

# ── Routes ───────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html", year=datetime.datetime.now().year)

# ── Upload Route ─────────────────────────────────────────
@app.route("/upload", methods=["POST"])
def upload():
    video_file = request.files.get("video")
    if not video_file:
        return jsonify({"status": "fail", "error": "No file uploaded"}), 400

    fname = datetime.datetime.now().strftime("recording_%Y%m%d_%H%M%S.webm")
   save_path = os.path.join(RECDIR, fname)
   video_file.save(save_path)
    print("📁 Saving video to:", save_path)



    try:
        print("📁 Saving to:", save_path)
        video_file.save(save_path)
    except Exception as e:
        print("❌ Error saving file:", e)
        return jsonify({"status": "fail", "error": str(e)}), 500

    return jsonify({
        "status":   "ok",
        "filename": fname,
        "url":      f"/recordings/{fname}"
    })

# ── Clip Route ───────────────────────────────────────────
@app.route("/clip/<orig>", methods=["POST"])
def clip(orig):
    data = request.get_json()
    start = float(data["start"])
    end = float(data["end"])
    if start >= end:
        return jsonify({"status": "fail", "error": "start >= end"}), 400

    in_path = os.path.join(RECDIR, orig)
    if not os.path.exists(in_path):
        return jsonify({"status": "fail", "error": "file not found"}), 404

    clip_name = datetime.datetime.now().strftime("clip_%Y%m%d_%H%M%S.") + EXT
    out_path = os.path.join(RECDIR, clip_name)
    duration = end - start

    # MP4 re-encoding (libx264 + aac)
    cmd = [
        FFMPEG, "-hide_banner", "-loglevel", "error",
        "-ss", str(start), "-t", str(duration), "-i", in_path,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", "-y", out_path
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return jsonify({"status": "ok", "clip": clip_name})
    except subprocess.CalledProcessError as e:
        return jsonify({"status": "fail", "error": e.stderr.strip()}), 500


# ── Serve Files ──────────────────────────────────────────
@app.route("/recordings/<fname>")
def recordings(fname):
    return send_from_directory(RECDIR, fname)

@app.route("/download/<fname>")
def download(fname):
    return send_from_directory(RECDIR, fname, as_attachment=True)


# ── Send Email ───────────────────────────────────────────
@app.route("/send_email", methods=["POST"])
def send_email():
    data = request.get_json()
    try:
        mail.send(
            Message(
                "GrabScreen recording",
                recipients=[data["to"]],
                body=f"Hi,\n\nHere is your recording:\n{data['url']}\n\nEnjoy!"
            )
        )
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "fail", "error": str(e)}), 500

@app.route("/debug/files")
def list_files():
    return "<br>".join(os.listdir(RECDIR))

# ── Local Debug ──────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True)
