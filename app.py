from flask import Flask, render_template, send_from_directory, request, jsonify
from flask_mail import Mail, Message
import os
import datetime

app = Flask(__name__)

# ── Flask-Mail Config ─────────────────────────────
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'sikandarimran01@gmail.com'
app.config['MAIL_PASSWORD'] = 'wize wwiv ybdb urmk'  # <-- Use env var in production
app.config['MAIL_DEFAULT_SENDER'] = ('Screen Recorder', 'sikandarimran01@gmail.com')

mail = Mail(app)

# ── Routes ────────────────────────────────────────────────
@app.route("/")
def index():
    year = datetime.datetime.now().year
    return render_template("index.html", year=year)

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

@app.route("/download/<filename>")
def download(filename):
    return send_from_directory("static/recordings", filename, as_attachment=True)

# ── Start App ─────────────────────────────────────────────
if __name__ == "__main__":
    os.makedirs("static/recordings", exist_ok=True)
    app.run(debug=True)
