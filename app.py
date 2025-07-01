"""
GrabScreen – backend with “Magic‑Link Session” support
-----------------------------------------------------
Every browser gets a random 32‑char session token
  • Sent automatically (cookie  +  X‑Session header)
  • Server stores {created, files:[…]} in sessions.json
  • /my/files  → last recordings for that session
  • /forget_session  → wipe the server‑side list
"""

from flask import (
    Flask, render_template, request, jsonify, send_from_directory, make_response
)
from flask_mail import Mail, Message
import datetime, os, subprocess, json, random, string
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

# ─────────────────────────── Flask setup ────────────────────────────
app = Flask(__name__)

app.config.update(
    MAIL_SERVER="smtp.gmail.com", MAIL_PORT=587, MAIL_USE_TLS=True,
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_DEFAULT_SENDER=("GrabScreen", os.getenv("MAIL_USERNAME")),
)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret")

serializer          = URLSafeTimedSerializer(app.config["SECRET_KEY"])
TOKEN_EXPIRY_SECONDS = 15 * 60             # 15‑min secure links
SESSION_MAX_AGE      = 90 * 24 * 3600      # Cookie lifetime (90 days)

mail = Mail(app)

# ─────────────────────────── Paths / files ──────────────────────────
RECDIR = "/mnt/recordings"
os.makedirs(RECDIR, exist_ok=True)

LINKS_FILE  = "public_links.json"
SESS_FILE   = "sessions.json"

def _load(path):  return json.load(open(path)) if os.path.exists(path) else {}
def _save(path,d): open(path,"w").write(json.dumps(d,indent=2))

public_links = _load(LINKS_FILE)      # public‑token  → filename
sessions     = _load(SESS_FILE)       # session‑token → {created,files}

def _new_token(n=32):
    return ''.join(random.choices(string.ascii_letters+string.digits, k=n))

# fetch existing session token or create a new one (but don’t set cookie here)
def current_session(create_if_missing=True):
    tok = request.headers.get("X-Session") \
        or request.cookies.get("session")
    if tok and tok in sessions:                       # existing
        return tok, False
    if create_if_missing:                             # new
        tok = _new_token()
        sessions[tok] = {"created": datetime.datetime.utcnow().isoformat(),
                         "files": []}
        _save(SESS_FILE, sessions)
        return tok, True
    return None, False

# ───────────────────────────── Routes ───────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", year=datetime.datetime.now().year)

# -------- upload ----------------------------------------------------
@app.route("/upload", methods=["POST"])
def upload():
    tok, is_new = current_session()                   # who is uploading
    video = request.files.get("video")
    if not video:
        return jsonify({"status":"fail","error":"No file"}), 400

    fname = datetime.datetime.now().strftime("recording_%Y%m%d_%H%M%S.webm")
    video.save(os.path.join(RECDIR, fname))

    sessions[tok]["files"].append(fname);  _save(SESS_FILE, sessions)

    secure_url = request.url_root.rstrip("/") + "/secure/" + serializer.dumps(fname)
    resp = make_response(jsonify({"status":"ok","filename":fname,"url":secure_url}))
    if is_new:                                         # set cookie once
        resp.set_cookie("session", tok, max_age=SESSION_MAX_AGE, samesite="Lax")
    return resp

# -------- clip ------------------------------------------------------
@app.route("/clip/<orig>", methods=["POST"])
def clip(orig):
    data   = request.get_json(force=True)
    start  = float(data["start"]);  end = float(data["end"])
    if start >= end: return jsonify({"status":"fail","error":"start>=end"}),400
    src = os.path.join(RECDIR, orig)
    if not os.path.exists(src): return jsonify({"status":"fail","error":"not found"}),404

    out  = datetime.datetime.now().strftime("clip_%Y%m%d_%H%M%S.webm")
    dst  = os.path.join(RECDIR, out)
    cmd  = ["ffmpeg","-hide_banner","-loglevel","error","-ss",str(start),
            "-t",str(end-start),"-i",src,"-c:v","libvpx-vp9","-b:v","1M",
            "-c:a","libopus","-b:a","128k","-y",dst]
    subprocess.run(cmd, check=True)

    tok,_ = current_session()
    sessions[tok]["files"].append(out); _save(SESS_FILE, sessions)
    return jsonify({"status":"ok","clip":out})

# -------- serve recordings & downloads ------------------------------
@app.route("/recordings/<fname>")
def recordings(fname):  return send_from_directory(RECDIR, fname)

@app.route("/download/<fname>")
def download(fname):     return send_from_directory(RECDIR, fname, as_attachment=True)

# -------- 15‑minute secure link -------------------------------------
@app.route("/link/secure/<fname>")
def link_secure(fname):
    if not os.path.exists(os.path.join(RECDIR,fname)):
        return jsonify({"status":"fail","error":"file not found"}),404
    token = serializer.dumps(fname)
    url   = request.url_root.rstrip("/") + "/secure/" + token
    return jsonify({"status":"ok","url":url})

@app.route("/secure/<token>")
def secure_download(token):
    try:      fname = serializer.loads(token, max_age=TOKEN_EXPIRY_SECONDS)
    except SignatureExpired: return "⏳ Link expired.",410
    except BadSignature:     return "❌ Invalid link.",400
    return send_from_directory(RECDIR, fname)

# -------- public link -----------------------------------------------
@app.route("/link/public/<fname>", methods=["GET","DELETE"])
def link_public(fname):
    if not os.path.exists(os.path.join(RECDIR,fname)):
        return jsonify({"status":"fail","error":"file not found"}),404

    if request.method=="GET":
        for t,f in public_links.items():
            if f==fname:
                return jsonify({"status":"ok","url":request.url_root.rstrip('/')+'/public/'+t})
        t=_new_token(12); public_links[t]=fname; _save(LINKS_FILE, public_links)
        return jsonify({"status":"ok","url":request.url_root.rstrip('/')+'/public/'+t})

    # DELETE
    for t,f in list(public_links.items()):
        if f==fname: del public_links[t]; _save(LINKS_FILE,public_links); return jsonify({"status":"ok"})
    return jsonify({"status":"fail","error":"No public link"}),404

@app.route("/public/<token>")
def serve_public(token):
    f = public_links.get(token)
    if not f: return "❌ Invalid or expired link.",404
    return send_from_directory(RECDIR, f)

# -------- e‑mail ----------------------------------------------------
@app.route("/send_email", methods=["POST"])
def send_email():
    d = request.get_json(force=True)
    try:
        mail.send(Message("GrabScreen recording",recipients=[d["to"]],
                          body=f"Hi,\n\nHere is your recording:\n{d['url']}\n"))
        return jsonify({"status":"ok"})
    except Exception as e:
        return jsonify({"status":"fail","error":str(e)}),500

# -------- session history & forget ----------------------------------
@app.route("/my/files")
def my_files():
    tok,_ = current_session(False)
    if not tok: return jsonify({"status":"ok","files":[]})
    return jsonify({"status":"ok","files":sessions.get(tok,{}).get("files",[]) })

@app.route("/forget_session", methods=["POST"])
def forget_session():
    tok,_ = current_session(False)
    if tok and tok in sessions:
        del sessions[tok]; _save(SESS_FILE, sessions)
    resp = jsonify({"status":"ok"})
    resp.set_cookie("session", "", expires=0)
    return resp

# -------- debug -----------------------------------------------------
@app.route("/debug/files")
def list_all(): return "<br>".join(sorted(os.listdir(RECDIR)))

# --------------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True)
