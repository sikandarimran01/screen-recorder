from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_mail import Mail, Message
from werkzeug.utils import secure_filename
import os
import uuid
import shutil

app = Flask(__name__)

# === Configuration ===
UPLOAD_FOLDER = os.path.join("static", "recordings")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # Max 500MB
app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = "your_email@gmail.com"
app.config["MAIL_PASSWORD"] = "your_password"
app.config["MAIL_DEFAULT_SENDER"] = app.config["MAIL_USERNAME"]

mail = Mail(app)

# === Routes ===
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/upload", methods=["POST"])
def upload():
    if "video" not in request.files:
        return jsonify({"status": "error", "error": "No video file"})
    
    file = request.files["video"]
    if file.filename == "":
        return jsonify({"status": "error", "error": "Empty filename"})

    filename = secure_filename(f"{uuid.uuid4().hex}.webm")
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)
    return jsonify({"status": "ok", "filename": filename})

@app.route("/recordings/<filename>")
def serve_recording(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

@app.route("/send_email", methods=["POST"])
def send_email():
    data = request.get_json()
    to = data.get("to")
    url = data.get("url")
    if not to or not url:
        return jsonify({"status": "error", "error": "Missing email or URL"})
    
    try:
        msg = Message("Your Screen Recording", recipients=[to])
        msg.body = f"Here is your screen recording: {url}"
        mail.send(msg)
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)})

@app.route("/clip/<filename>", methods=["POST"])
def clip(filename):
    data = request.get_json()
    start = int(data.get("start", 0))
    end = int(data.get("end", 0))

    original_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    if not os.path.exists(original_path):
        return jsonify({"status": "error", "error": "Original file not found"})

    # Simulate clipping by copying the original (implement real FFmpeg later)
    new_filename = f"clip_{uuid.uuid4().hex}.webm"
    new_path = os.path.join(app.config["UPLOAD_FOLDER"], new_filename)
    shutil.copyfile(original_path, new_path)

    return jsonify({"status": "ok", "filename": new_filename})

@app.route("/link/secure/<filename>")
def secure_link(filename):
    # Simulate secure link (15-min link)
    url = request.host_url + f"recordings/{filename}"
    return jsonify({"status": "ok", "url": url})

@app.route("/link/public/<filename>", methods=["GET", "DELETE"])
def public_link(filename):
    url = request.host_url + f"recordings/{filename}"
    if request.method == "GET":
        return jsonify({"status": "ok", "url": url})
    elif request.method == "DELETE":
        return jsonify({"status": "ok"})  # Simulated disabling
    return jsonify({"status": "error", "error": "Invalid request"})

# === Entry point ===
if __name__ == "__main__":
    app.run(debug=True)
