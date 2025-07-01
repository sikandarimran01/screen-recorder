from flask import Flask, render_template, send_from_directory, request, jsonify
from flask_mail import Mail, Message
import cv2, numpy as np, pyautogui, datetime, threading, time, os, subprocess, os

app = Flask(__name__)

# ── Flask-Mail Config ─────────────────────────────
app.config['MAIL_SERVER'] = 'smtp.gmail.com'           # Use your SMTP server
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'sikandarimran01@gmail.com'   # Your sender email
app.config['MAIL_PASSWORD'] = 'wize wwiv ybdb urmk'      # App password or email password
app.config['MAIL_DEFAULT_SENDER'] = ('Screen Recorder', 'sikandarimran01@gmail.com')

mail = Mail(app)

# ── Config ────────────────────────────────────────────────
FPS    = 20.0
SCALE  = 1.0
CODEC  = "VP80"
EXT    = "webm"
FFMPEG = "ffmpeg"
# ──────────────────────────────────────────────────────────



# 👉  E‑mail settings come from environment variables for security
from flask_mail import Mail, Message

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'sikandarimran01@gmail.com'
app.config['MAIL_PASSWORD'] = 'untx lnay rvfr bjtl'  # ← Paste the App Password here
app.config['MAIL_DEFAULT_SENDER'] = ('Screen Recorder', 'sikandarimran01@gmail.com')

mail = Mail(app)

recording = False
video_filename = None

# ── Screen Recording Thread ───────────────────────────────
def record_screen():
    global recording, video_filename
    sw, sh = pyautogui.size()
    frame_size = (int(sw * SCALE), int(sh * SCALE))

    fourcc = cv2.VideoWriter_fourcc(*CODEC)
    video_filename = datetime.datetime.now().strftime(f"recording_%Y%m%d_%H%M%S.{EXT}")
    out_path = os.path.join("static", "recordings", video_filename)
    out = cv2.VideoWriter(out_path, fourcc, FPS, frame_size)

    frame_time = 1.0 / FPS
    next_frame = time.perf_counter()

    while recording:
        if time.perf_counter() >= next_frame:
            img = pyautogui.screenshot()
            if SCALE != 1.0:
                img = img.resize(frame_size)
            frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
            out.write(frame)
            next_frame += frame_time
    out.release()

# ── Routes ────────────────────────────────────────────────
@app.route("/")
def index():
    year = datetime.datetime.now().year
    return render_template("index.html", year=year)

@app.route("/start", methods=["POST"])
def start_recording():
    global recording
    if not recording:
        recording = True
        threading.Thread(target=record_screen, daemon=True).start()
        return jsonify({"status": "recording started"})
    return jsonify({"status": "already recording"})

@app.route("/stop", methods=["POST"])
def stop_recording():
    global recording
    recording = False
    return jsonify({"status": "recording stopped", "filename": video_filename})

@app.route("/download/<filename>")
def download(filename):
    return send_from_directory("static/recordings", filename, as_attachment=True)

@app.route("/clip/<orig>", methods=["POST"])
def clip_video(orig):
    try:
        data = request.get_json()
        start = float(data["start"])
        end   = float(data["end"])
        if start >= end:
            return jsonify({"status": "fail", "error": "start >= end"}), 400

        duration = end - start
        in_path  = os.path.join("static", "recordings", orig)
        if not os.path.exists(in_path):
            return jsonify({"status": "fail", "error": "file not found"}), 404

        clip_name = f"clip_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.{EXT}"
        out_path  = os.path.join("static", "recordings", clip_name)

        cmd = [
            FFMPEG,
            "-hide_banner", "-loglevel", "error",
            "-ss", str(start),
            "-t", str(duration),
            "-i", in_path,
            "-c", "copy",
            "-y", out_path
        ]
        subprocess.run(cmd, check=True)
        return jsonify({"status": "ok", "clip": clip_name})
    except Exception as e:
        return jsonify({"status": "fail", "error": str(e)}), 500

# ── NEW: server‑side e‑mail endpoint ──────────────────────
@app.route("/send_email", methods=["POST"])
def send_email():
    data = request.get_json()
    recipient = data.get("to")
    link = data.get("url")

    try:
        msg = Message("Screen Recording", recipients=[recipient])
        msg.body = f"Hi,\n\nHere is the screen recording:\n{link}\n\nRegards,"
        mail.send(msg)
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "fail", "error": str(e)}), 500


# ── Start App ─────────────────────────────────────────────
if __name__ == "__main__":
    os.makedirs("static/recordings", exist_ok=True)
    app.run(debug=True)
