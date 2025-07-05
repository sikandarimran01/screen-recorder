# Add Response and stream_with_context to imports
import os, datetime, subprocess, json, random, string, uuid, multiprocessing
from dotenv import load_dotenv 
from flask import (
    Flask, render_template, request, jsonify,
    send_from_directory, make_response, Response, stream_with_context
)
from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

load_dotenv() 

app = Flask(__name__)

# --- Configuration ---
app.config.update(
    MAIL_SERVER="smtp.gmail.com",
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_DEFAULT_SENDER=("GrabScreen", os.getenv("MAIL_USERNAME")),
)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret")

# --- App Initialization ---
serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])
TOKEN_EXPIRY_SECONDS = 15 * 60
mail = Mail(app)

# Use Render's ephemeral (temporary) writable directory
RECDIR  = "/mnt/recordings"
os.makedirs(RECDIR, exist_ok=True)

# +++ CRITICAL FIX: Save JSON files to the writable directory +++
# The root filesystem is read-only in production. These must be stored in RECDIR.
# Note: This means links and sessions will be cleared on every deploy.
LINKS_FILE = os.path.join(RECDIR, "public_links.json")
SESSIONS_FILE = os.path.join(RECDIR, "user_sessions.json")


# --- Helper Functions ---
def load_json(file_path):
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            try: return json.load(f)
            except json.JSONDecodeError: return {}
    return {}

def save_json(data, file_path):
    with open(file_path, "w") as f:
        json.dump(data, f, indent=2)

public_links = load_json(LINKS_FILE)
user_sessions = load_json(SESSIONS_FILE)

def run_ffmpeg_conversion(in_path, out_path):
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", in_path, "-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p", "-y", out_path]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        app.logger.error(f"FFMPEG conversion failed for {in_path}: {e.stderr}")
        if os.path.exists(out_path): os.remove(out_path)

# +++ NEW: Robust file streaming function to prevent timeouts +++
def stream_file(filename, as_attachment=False):
    # Security checks
    if ".." in filename or filename.startswith("/"): return "Invalid filename", 400
    file_path = os.path.join(RECDIR, filename)
    if not os.path.abspath(file_path).startswith(os.path.abspath(RECDIR)): return "Access denied", 403
    if not os.path.exists(file_path): return "File not found", 404

    def generate():
        with open(file_path, "rb") as f:
            while True:
                chunk = f.read(4096)  # Read in 4KB chunks
                if not chunk: break
                yield chunk

    mimetype = 'video/mp4' if filename.endswith('.mp4') else 'video/webm'
    headers = {'Content-Type': mimetype}
    if as_attachment:
        headers['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    return Response(stream_with_context(generate()), headers=headers)

# ─────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", year=datetime.datetime.now().year)

@app.route("/upload", methods=["POST"])
def upload():
    video_file = request.files.get("video")
    if not video_file: return jsonify({"status": "fail", "error": "No file"}), 400
    fname = datetime.datetime.now().strftime("recording_%Y%m%d_%H%M%S.webm")
    save_path = os.path.join(RECDIR, fname)
    try:
        video_file.save(save_path)
    except Exception as e:
        app.logger.error(f"Upload failed: {e}", exc_info=True)
        return jsonify({"status": "fail", "error": "Server error during upload."}), 500
    token = request.cookies.get("magic_token")
    if not token or token not in user_sessions:
        token = uuid.uuid4().hex[:16]
        user_sessions[token] = []
    user_sessions[token].append(fname)
    save_json(user_sessions, SESSIONS_FILE)
    response = jsonify({"status": "ok", "filename": fname})
    response.set_cookie("magic_token", token, max_age=365*24*60*60)
    return response

# ... (the middle part of the code is unchanged) ...

@app.route("/session/files")
def session_files():
    token = request.cookies.get("magic_token")
    if not token or token not in user_sessions: return jsonify({"status": "empty", "files": []})
    existing_files = [f for f in user_sessions.get(token, []) if os.path.exists(os.path.join(RECDIR, f))]
    if len(existing_files) != len(user_sessions.get(token, [])):
        user_sessions[token] = existing_files
        save_json(user_sessions, SESSIONS_FILE)
    return jsonify({"status": "ok", "files": existing_files})

@app.route("/session/forget", methods=["POST"])
def forget_session():
    token = request.cookies.get("magic_token")
    if token and token in user_sessions:
        del user_sessions[token]
        save_json(user_sessions, SESSIONS_FILE)
    response = jsonify({"status": "ok"})
    response.set_cookie("magic_token", "", expires=0)
    return response

@app.route("/clip/<orig>", methods=["POST"])
def clip(orig):
    data = request.get_json(force=True)
    start, end = float(data["start"]), float(data["end"])
    if start >= end: return jsonify({"status": "fail", "error": "Start time must be less than end time"}), 400
    in_path = os.path.join(RECDIR, orig)
    if not os.path.exists(in_path): return jsonify({"status": "fail", "error": "Original file not found"}), 404
    clip_name = datetime.datetime.now().strftime("clip_%Y%m%d_%H%M%S.webm")
    out_path = os.path.join(RECDIR, clip_name)
    duration = end - start
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", str(start), "-t", str(duration), "-i", in_path, "-c:v", "libvpx-vp9", "-b:v", "1M", "-c:a", "libopus", "-b:a", "128k", "-y", out_path]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        token = request.cookies.get("magic_token")
        if token and token in user_sessions:
            user_sessions[token].append(clip_name)
            save_json(user_sessions, SESSIONS_FILE)
        return jsonify({"status": "ok", "clip": clip_name})
    except subprocess.CalledProcessError as e:
        return jsonify({"status": "fail", "error": e.stderr}), 500

@app.route('/convert/mp4/<orig_name>', methods=['POST'])
def convert_to_mp4(orig_name):
    if ".." in orig_name or orig_name.startswith("/"): return jsonify({"status": "fail", "error": "Invalid filename"}), 400
    in_path = os.path.join(RECDIR, orig_name)
    if not os.path.exists(in_path): return jsonify({"status": "fail", "error": "Original file not found"}), 404
    new_name = os.path.splitext(orig_name)[0] + ".mp4"
    out_path = os.path.join(RECDIR, new_name)
    if os.path.exists(out_path): return jsonify({"status": "ready", "new_filename": new_name})
    process = multiprocessing.Process(target=run_ffmpeg_conversion, args=(in_path, out_path))
    process.start()
    return jsonify({"status": "processing", "new_filename": new_name}), 202

@app.route('/status/<filename>')
def check_status(filename):
    if ".." in filename or filename.startswith("/"): return jsonify({"status": "fail", "error": "Invalid filename"}), 400
    file_path = os.path.join(RECDIR, filename)
    return jsonify({"status": "ready"}) if os.path.exists(file_path) else jsonify({"status": "processing"})


# +++ UPDATED: All file serving now uses the robust stream_file function +++
@app.route("/recordings/<fname>")
def recordings(fname):
    return stream_file(fname)

@app.route("/download/<fname>")
def download(fname):
    return stream_file(fname, as_attachment=True)

@app.route("/secure/<token>")
def secure_download(token):
    try:
        fname = serializer.loads(token, max_age=TOKEN_EXPIRY_SECONDS)
    except SignatureExpired: return "⏳ Link expired.", 410
    except BadSignature: return "❌ Invalid link.", 400
    return stream_file(fname)

@app.route("/public/<token>")
def serve_public_file(token):
    public_links = load_json(LINKS_FILE)
    fname = public_links.get(token)
    if not fname or not os.path.exists(os.path.join(RECDIR, fname)): return "❌ Invalid or expired link.", 404
    return stream_file(fname)

# ... (the rest of your routes are also unchanged) ...

@app.route("/link/secure/<fname>")
def generate_secure_link(fname):
    if not os.path.exists(os.path.join(RECDIR, fname)): return jsonify({"status": "fail", "error": "file not found"}), 404
    token = serializer.dumps(fname)
    url = request.url_root.rstrip("/") + "/secure/" + token
    return jsonify({"status": "ok", "url": url})

@app.route("/link/public/<fname>", methods=["GET"])
def get_or_create_public_link(fname):
    global public_links
    public_links = load_json(LINKS_FILE)
    if not os.path.exists(os.path.join(RECDIR, fname)): return jsonify({"status": "fail", "error": "File not found"}), 404
    for token, f in public_links.items():
        if f == fname: return jsonify({"status": "ok", "url": request.url_root.rstrip("/") + "/public/" + token, "isNew": False})
    token = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
    public_links[token] = fname
    save_json(public_links, LINKS_FILE)
    return jsonify({"status": "ok", "url": request.url_root.rstrip("/") + "/public/" + token, "isNew": True})

@app.route("/link/public/<fname>", methods=["DELETE"])
def delete_public_link(fname):
    global public_links
    public_links = load_json(LINKS_FILE)
    removed = False
    for token, f in list(public_links.items()):
        if f == fname: del public_links[token]; removed = True
    if removed:
        save_json(public_links, LINKS_FILE)
        return jsonify({"status": "ok", "message": "Link removed"})
    return jsonify({"status": "fail", "error": "No public link found"}), 404

@app.route("/send_email", methods=["POST"])
def send_email():
    data = request.get_json()
    if not app.config.get("MAIL_USERNAME"): return jsonify({"status": "fail", "error": "Mail service is not configured."}), 503
    try:
        msg = Message("GrabScreen recording", recipients=[data["to"]], body=f"Hi,\n\nHere is your recording:\n{data['url']}\n\nEnjoy!")
        mail.send(msg)
        return jsonify({"status": "ok"})
    except Exception as e:
        app.logger.error(f"Mail sending failed: {e}")
        return jsonify({"status": "fail", "error": "Could not send the email."}), 500

@app.route("/debug/files")
def list_files():
    if os.getenv("FLASK_ENV") == "development": return "<br>".join(sorted(os.listdir(RECDIR)))
    return "Not available in production", 404

@app.route("/delete/<filename>", methods=["POST"])
def delete_file(filename):
    if ".." in filename or filename.startswith("/"): return jsonify({"status": "fail", "error": "Invalid filename"}), 400
    file_path = os.path.join(RECDIR, filename)
    if not os.path.abspath(file_path).startswith(os.path.abspath(RECDIR)): return jsonify({"status": "fail", "error": "Access denied"}), 403
    if not os.path.exists(file_path): return jsonify({"status": "fail", "error": "File not found"}), 404
    try:
        os.remove(file_path)
        mp4_path = os.path.join(RECDIR, os.path.splitext(filename)[0] + ".mp4")
        if os.path.exists(mp4_path): os.remove(mp4_path)
        token = request.cookies.get("magic_token")
        if token and token in user_sessions and filename in user_sessions[token]:
            user_sessions[token].remove(filename)
            save_json(user_sessions, SESSIONS_FILE)
        global public_links
        public_links = load_json(LINKS_FILE)
        for t, f in list(public_links.items()):
            if f == filename: del public_links[t]
        save_json(public_links, LINKS_FILE)
        return jsonify({"status": "ok", "message": f"{filename} deleted"})
    except Exception as e:
        app.logger.error(f"File deletion failed: {e}")
        return jsonify({"status": "fail", "error": "Could not delete the file."}), 500

@app.route("/contact_us", methods=["POST"])
def contact_us():
    data = request.get_json()
    if not app.config.get("MAIL_USERNAME"): return jsonify({"status": "fail", "error": "Mail service is not configured."}), 503
    from_email, subject, message_body = data.get("from_email"), data.get("subject"), data.get("message")
    if not all([from_email, subject, message_body]): return jsonify({"status": "fail", "error": "Please fill out all fields."}), 400
    try:
        msg = Message(subject=f"[GrabScreen Contact] {subject}", recipients=[app.config["MAIL_USERNAME"]], body=f"From: {from_email}\n\n{message_body}", reply_to=from_email)
        mail.send(msg)
        return jsonify({"status": "ok", "message": "Your message has been sent!"})
    except Exception as e:
        app.logger.error(f"Contact form mail sending failed: {e}")
        return jsonify({"status": "fail", "error": "Sorry, an error occurred."}), 500

if __name__ == "__main__":
    app.run(debug=(os.getenv("FLASK_ENV") == "development"), port=5001)