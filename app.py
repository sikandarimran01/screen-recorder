"""
app.py – GrabScreen backend (magic‑token sessions, public links, mail)
Adds:
  • /robots.txt   – lets search‑engine bots crawl the site
  • /sitemap.xml  – simple dynamic sitemap so Google can discover pages

No other routes were removed; the embed feature only lives on the front‑end and
there is no server route for it, so nothing to delete here.
"""

from flask import (
    Flask, render_template, request, jsonify,
    send_from_directory, make_response
)
from flask_mail import Mail, Message
import datetime, os, subprocess, json, random, string, uuid
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from urllib.parse import urljoin

app = Flask(__name__)

# ── Config ───────────────────────────────────────────────────────────────────
app.config.update(
    MAIL_SERVER="smtp.gmail.com",
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_DEFAULT_SENDER=("GrabScreen", os.getenv("MAIL_USERNAME")),
)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret")
serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])
TOKEN_EXPIRY_SECONDS = 15 * 60  # secure link lifetime (15 min)

mail = Mail(app)

# ── Paths & storage files ────────────────────────────────────────────────────
RECDIR = "/mnt/recordings"
os.makedirs(RECDIR, exist_ok=True)
LINKS_FILE = "public_links.json"
SESSIONS_FILE = "user_sessions.json"


def _load_json(path):
    return json.load(open(path)) if os.path.exists(path) else {}


def _save_json(obj, path):
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)


public_links = _load_json(LINKS_FILE)         # public‑token  → fname
user_sessions = _load_json(SESSIONS_FILE)     # magic_token   → [fnames]

# ──────────────────────────────────────────────────────────────────────────────
# Helper fns
# ──────────────────────────────────────────────────────────────────────────────

def _now_fname(prefix="recording"):
    return datetime.datetime.now().strftime(f"{prefix}_%Y%m%d_%H%M%S.webm")


# ──────────────────────────────────────────────────────────────────────────────
# Core routes
# ──────────────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", year=datetime.datetime.now().year)

# -------------  magic‑session helpers  ---------------------------------------

@app.route("/session/files")
def session_files():
    token = request.cookies.get("magic_token")
    if not token or token not in user_sessions:
        return jsonify({"status": "empty", "files": []})

    # prune missing files
    files = [f for f in user_sessions[token] if os.path.exists(os.path.join(RECDIR, f))]
    if len(files) != len(user_sessions[token]):
        user_sessions[token] = files; _save_json(user_sessions, SESSIONS_FILE)

    return jsonify({"status": "ok", "files": files})


@app.route("/session/forget", methods=["POST"])
def forget_session():
    token = request.cookies.get("magic_token")
    if token and token in user_sessions:
        del user_sessions[token]; _save_json(user_sessions, SESSIONS_FILE)
    resp = jsonify({"status": "ok"})
    resp.set_cookie("magic_token", "", expires=0)
    return resp

# -------------  upload  ------------------------------------------------------

@app.route("/upload", methods=["POST"])
def upload():
    video_file = request.files.get("video")
    if not video_file:
        return jsonify({"status": "fail", "error": "No file"}), 400

    fname = _now_fname()
    save_path = os.path.join(RECDIR, fname)
    try:
        video_file.save(save_path)
    except Exception as e:
        return jsonify({"status": "fail", "error": str(e)}), 500

    # session bookkeeping
    token = request.cookies.get("magic_token")
    if not token or token not in user_sessions:
        token = uuid.uuid4().hex[:16]
        user_sessions[token] = []
    user_sessions[token].append(fname); _save_json(user_sessions, SESSIONS_FILE)

    resp = jsonify({"status": "ok", "filename": fname})
    resp.set_cookie("magic_token", token, max_age=365*24*60*60, samesite="Lax")
    return resp

# -------------  clip  --------------------------------------------------------

@app.route("/clip/<orig>", methods=["POST"])
def clip(orig):
    try:
        data = request.get_json(force=True)
        start, end = float(data["start"]), float(data["end"])
    except Exception as e:
        return jsonify({"status": "fail", "error": f"Bad JSON – {e}"}), 400
    if start >= end:
        return jsonify({"status": "fail", "error": "start >= end"}), 400

    in_path = os.path.join(RECDIR, orig)
    if not os.path.exists(in_path):
        return jsonify({"status": "fail", "error": "Original not found"}), 404

    out_name = _now_fname("clip")
    out_path = os.path.join(RECDIR, out_name)
    duration = end - start
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-ss", str(start), "-t", str(duration), "-i", in_path,
        "-c:v", "libvpx-vp9", "-b:v", "1M", "-c:a", "libopus", "-b:a", "128k",
        "-y", out_path
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        # store in session
        t = request.cookies.get("magic_token")
        if t and t in user_sessions:
            user_sessions[t].append(out_name); _save_json(user_sessions, SESSIONS_FILE)
        return jsonify({"status": "ok", "clip": out_name})
    except subprocess.CalledProcessError as e:
        return jsonify({"status": "fail", "error": e.stderr}), 500

# -------------  static file serving  ----------------------------------------

@app.route("/recordings/<fname>")
def recordings(fname):
    return send_from_directory(RECDIR, fname)

@app.route("/download/<fname>")
def download(fname):
    return send_from_directory(RECDIR, fname, as_attachment=True)

# -------------  secure 15‑min links  ----------------------------------------

@app.route("/link/secure/<fname>")
def link_secure(fname):
    if not os.path.exists(os.path.join(RECDIR, fname)):
        return jsonify({"status": "fail", "error": "file not found"}), 404
    token = serializer.dumps(fname)
    return jsonify({"status": "ok", "url": urljoin(request.url_root, f"secure/{token}")})


@app.route("/secure/<token>")
def secure_download(token):
    try:
        fname = serializer.loads(token, max_age=TOKEN_EXPIRY_SECONDS)
    except SignatureExpired:
        return "⏳ Link expired", 410
    except BadSignature:
        return "❌ Invalid link", 400
    return send_from_directory(RECDIR, fname)

# -------------  public links  ------------------------------------------------

@app.route("/link/public/<fname>", methods=["GET", "DELETE"])
def link_public(fname):
    global public_links
    public_links = _load_json(LINKS_FILE)
    path = os.path.join(RECDIR, fname)
    if not os.path.exists(path):
        return jsonify({"status": "fail", "error": "File not found"}), 404

    if request.method == "GET":
        for t, f in public_links.items():
            if f == fname:
                return jsonify({"status": "ok", "url": urljoin(request.url_root, f"public/{t}")})
        token = ''.join(random.choices(string.ascii_letters+string.digits, k=12))
        public_links[token] = fname; _save_json(public_links, LINKS_FILE)
        return jsonify({"status": "ok", "url": urljoin(request.url_root, f"public/{token}")})

    # DELETE
    removed = False
    for t, f in list(public_links.items()):
        if f == fname:
            del public_links[t]; removed = True
    if removed:
        _save_json(public_links, LINKS_FILE)
        return jsonify({"status": "ok"})
    return jsonify({"status": "fail", "error": "No public link"}), 404


@app.route("/public/<token>")
def public_file(token):
    fname = public_links.get(token)
    if not fname or not os.path.exists(os.path.join(RECDIR, fname)):
        return "❌ Invalid/expired", 404
    return send_from_directory(RECDIR, fname)

# -------------  mail  --------------------------------------------------------

@app.route("/send_email", methods=["POST"])
def send_email():
    data = request.get_json(force=True)
    try:
        mail.send(Message("GrabScreen recording", recipients=[data["to"]], body=f"Hi, here is your recording:\n{data['url']}"))
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "fail", "error": str(e)}), 500

# -------------  debug / delete  ---------------------------------------------

@app.route("/debug/files")
def debug_files():
    return "<br>".join(sorted(os.listdir(RECDIR)))


@app.route("/delete/<fname>", methods=["POST"])
def delete_file(fname):
    fp = os.path.join(RECDIR, fname)
    if not os.path.exists(fp):
        return jsonify({"status": "fail", "error": "not found"}), 404
    os.remove(fp)
    # cleanup session & public maps
    for token, flist in user_sessions.items():
        if fname in flist:
            flist.remove(fname)
    _save_json(user_sessions, SESSIONS_FILE)
    for t, f in list(public_links.items()):
        if f == fname:
            del public_links[t]
    _save_json(public_links, LINKS_FILE)
    return jsonify({"status": "ok"})

# ──────────────────────────────────────────────────────────────────────────────
# robots.txt & sitemap.xml  ↴  (for faster indexing)
# ──────────────────────────────────────────────────────────────────────────────

@app.route("/robots.txt")
def robots():
    lines = [
        "User-agent: *",
        "Allow: /",
        f"Sitemap: {urljoin(request.url_root, 'sitemap.xml')}"
    ]
    return "\n".join(lines), 200, {"Content-Type": "text/plain"}


@app.route("/sitemap.xml")
def sitemap():
    base = request.url_root.rstrip("/")
    today = datetime.date.today().isoformat()

    def url(loc, prio="0.8"):
        return f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>{prio}</priority>\n  </url>"

    # homepage + every public link
    urls = [url(f"{base}/", "1.0")]
    for token, fname in public_links.items():
        urls.append(url(f"{base}/public/{token}", "0.6"))

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(urls)}
</urlset>"""
    return xml, 200, {"Content-Type": "application/xml"}


# ──────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5001)
