#!/usr/bin/env python3
"""Artha release check. Nothing may be published unless this passes.

  python3 tools/check.py          check only (exit 1 on any failure)
  python3 tools/check.py --fix    also refresh the inline-script hashes in the Content-Security-Policy

Checks: files present and not truncated, versions consistent, JavaScript parses, CSP hashes match the inline
scripts, and the app really starts in a headless browser against a fake backend (numbers on screen, no errors,
no CSP violations, phone↔sheet fingerprint agrees), the fingerprint lock behaves, and tools/sweep.py opens every screen
(no JavaScript errors, no text spilling out of its box). It also breaks app.js on purpose and expects the boot guard's
recovery screen, so a broken release can never show a blank page.
"""
import base64, hashlib, http.server, json, os, re, socketserver, subprocess, sys, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAIL = []
def ok(c, m):
    print(("PASS " if c else "FAIL ") + m)
    if not c: FAIL.append(m)
def rd(p): return open(os.path.join(ROOT, p), encoding="utf-8").read()

# 1. files present and not truncated (the 9 Nov blank screen was an empty index.html and sw.js)
MIN = {"index.html": 6000, "app.js": 150000, "app.css": 40000, "scene.js": 15000, "sw.js": 2000,
       "three.min.js": 500000, "manifest.webmanifest": 100, "version.json": 20}
for f, n in MIN.items():
    sz = os.path.getsize(os.path.join(ROOT, f)) if os.path.exists(os.path.join(ROOT, f)) else 0
    ok(sz >= n, f"{f} present and not truncated ({sz} bytes, min {n})")
idx, app, sw = rd("index.html"), rd("app.js"), rd("sw.js")
for m in ['id="app"', 'id="legend"', 'id="gate"', 'id="lock"', 'src="app.js', "__arthaFail"]:
    ok(m in idx, f"index.html contains {m}")
ok("__arthaOK" in app, "app.js marks a successful start (__arthaOK)")

# 2. versions agree everywhere
v = json.loads(rd("version.json"))["v"]
av = re.search(r'const APP_VERSION="([^"]+)"', app)
ok(av and av.group(1) == v, f"APP_VERSION matches version.json ({v})")
tags = set(re.findall(r'\?v=([\d.]+)"', idx))
ok(tags == {v}, f"index.html ?v= tags all {v} (found {sorted(tags)})")
ok(re.search(r'const C="artha-v\d+"', sw) is not None, "sw.js has a cache name")

# 3. JavaScript parses
for f in ["app.js", "scene.js", "sw.js"]:
    r = subprocess.run(["node", "-e", f"new (require('vm').Script)(require('fs').readFileSync({json.dumps(os.path.join(ROOT, f))},'utf8'))"], capture_output=True, text=True)
    ok(r.returncode == 0, f"{f} parses" + ("" if r.returncode == 0 else ": " + r.stderr.strip().splitlines()[-1]))

# 4. CSP hashes for the inline scripts
inl = re.findall(r"<script>(.*?)</script>", idx, re.S)
hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(s.encode()).digest()).decode() + "'" for s in inl]
m = re.search(r'script-src \'self\' (.*?) https://accounts', idx)
if "--fix" in sys.argv and m:
    idx = idx.replace(m.group(0), "script-src 'self' " + " ".join(hashes) + " https://accounts")
    open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8").write(idx); m = re.search(r'script-src \'self\' (.*?) https://accounts', idx)
ok(m is not None and set(m.group(1).split()) == set(hashes), f"CSP allows exactly the {len(inl)} inline scripts")

# 4b. three.min.js is pinned by its integrity hash (refreshed by --fix)
sri = "sha384-" + base64.b64encode(hashlib.sha384(open(os.path.join(ROOT, "three.min.js"), "rb").read()).digest()).decode()
mi = re.search(r'<script src="three.min.js" integrity="([^"]+)"', idx)
if "--fix" in sys.argv and mi and mi.group(1) != sri:
    idx = idx.replace(mi.group(1), sri); open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8").write(idx)
    mi = re.search(r'<script src="three.min.js" integrity="([^"]+)"', idx)
ok(mi is not None and mi.group(1) == sri, "three.min.js integrity hash matches the file")

# 4c. no personal details in the public code (they come from the backend after sign-in)
for word in ["ICICI\",", "Ujjivan", "Canara", "claude.ai/project/", "Stable Money · "]:
    ok(word not in app, f"app.js does not contain {word!r}")

# 5. it really starts: headless browser + fake backend
def canon(r): return "\u001f".join("" if x in ("", None) else (str(x) if not isinstance(x, float) or not x.is_integer() else str(int(x))) for x in r[:13])
def h16(s): return hashlib.sha256(s.encode()).hexdigest()[:16]
LED = [["L0001", "2024-01-05", "Aditya", "Groww · Aditya", "Cash", "Add money", "", "", "", "", 100000, "Bank", "[bank ICICI]", 2],
       ["L0002", "2024-01-06", "Aditya", "Groww · Aditya", "Stocks", "Buy", "Grasim", "GRASIM", 10, 3157, 31570, "Balance", "", 3],
       ["L0003", "2024-02-01", "Aditya", "Groww · Aditya", "Mutual Funds", "Buy", "Axis Nifty Next 50", "", "", "", 5000, "Bank", "", 4],
       ["L0004", "2024-03-01", "Spardha", "Wint · Spardha", "Bonds", "Buy", "Keertana Finserv", "", "", "", 100000, "Bank", "", 5]]
def fp(led):
    U, al = {}, []
    for r in sorted(led, key=lambda r: r[0]):
        k, c = r[3] + "|" + r[2], canon(r); al.append(c)
        u = U.setdefault(k, {"n": 0, "s": 0, "c": []}); u["n"] += 1; u["s"] += r[10] or 0; u["c"].append(c)
    return {"n": len(al), "s": sum(u["s"] for u in U.values()), "h": h16("\u001e".join(al)),
            "u": {k: {"n": u["n"], "s": u["s"], "h": h16("\u001e".join(u["c"]))} for k, u in U.items()}}
DATA = {"v": 3, "at": "2026-11-09T08:00:00.000Z", "url": "https://docs.google.com/x", "led": LED, "rec": [], "files": "",
        "fp": fp(LED), "chk": [], "audit": [], "me": "Aditya",
        "cfg": {"project": "https://claude.ai/project/TEST", "acct0": ["Groww · Aditya", "Wint · Spardha"],
                "banks": {"Aditya": [["TestBank", "Primary", "#F58220"]], "Spardha": [["OtherBank", "", "#3D7CF0"]]}}}

class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
srv = socketserver.TCPServer(("127.0.0.1", 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    ok(False, "playwright is installed (pip install playwright)"); sys.exit(1)
exe = os.environ.get("CHROME") or next((p for p in ["/usr/bin/google-chrome", "/usr/bin/chromium"] if os.path.exists(p)), None)
with sync_playwright() as p:
    b = p.chromium.launch(**({"executable_path": exe} if exe else {}), args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    def page(break_app=False, data=None):
        ctx = b.new_context(viewport={"width": 412, "height": 900}, service_workers="block")
        pg = ctx.new_page(); errs, csp = [], []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: csp.append(m.text) if "Content Security Policy" in m.text or "Content-Security-Policy" in m.text else None)
        pg.route("https://script.google.com/**", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "d": data or DATA})))
        pg.route("https://api.mfapi.in/**", lambda r: r.fulfill(status=200, content_type="application/json", body='{"data":[]}'))
        if break_app: pg.route("**/app.js*", lambda r: r.fulfill(status=200, content_type="text/javascript", body="this is not javascript ("))
        pg.add_init_script("localStorage.setItem('artha:api',JSON.stringify('https://script.google.com/macros/s/TEST/exec'));localStorage.setItem('artha:tok',JSON.stringify('" + "a" * 64 + "'))")
        pg.goto(f"http://127.0.0.1:{port}/index.html")
        return ctx, pg, errs, csp
    ctx, pg, errs, csp = page()
    pg.wait_for_timeout(6000)
    ok(pg.evaluate("window.__arthaOK===1"), "app starts (boot guard satisfied)")
    ok(not errs, "no JavaScript errors" + ("" if not errs else ": " + errs[0][:160]))
    ok(not csp, "no Content-Security-Policy violations" + ("" if not csp else ": " + csp[0][:200]))
    ok(pg.evaluate("!document.getElementById('bootFail')"), "no recovery screen on a good build")
    leg = pg.evaluate("(document.getElementById('legend')||{}).innerText||''")
    ok("₹" in leg, "home tiles show amounts")
    iss = pg.evaluate("localStorage.getItem('artha:issues')||'[]'")
    ok('"fp"' not in iss, "phone fingerprint matches the backend's (no 'Phone and sheet don't agree')")
    pg.screenshot(path=os.path.join(os.environ.get("CHECK_OUT", "/tmp"), "artha-check.png"))
    ctx.close()
    bad = json.loads(json.dumps(DATA)); bad["fp"]["u"]["Groww · Aditya|Aditya"]["s"] += 1; bad["fp"]["h"] = "0" * 16
    ctx, pg, errs, csp = page(data=bad); pg.wait_for_timeout(5000)
    ok('"fp"' in pg.evaluate("localStorage.getItem('artha:issues')||'[]'"), "a tampered sheet total is caught and flagged in the bell")
    ctx.close()
    # fingerprint lock: figures are cleared from the page while locked and drawn again after unlocking
    ctx, pg, errs, csp = page(); pg.wait_for_timeout(5000)
    pg.evaluate("localStorage.setItem('artha:bioId',JSON.stringify('AAAA'))")
    # a new tab has a fresh session, like opening the app from the home screen
    pg2 = ctx.new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
    pg2.route("https://script.google.com/**", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "d": DATA})))
    pg2.route("https://api.mfapi.in/**", lambda r: r.fulfill(status=200, content_type="application/json", body='{"data":[]}'))
    pg2.add_init_script("""window.__bio=0;navigator.credentials.get=async()=>{window.__bio++;const d=new Uint8Array(37);d[32]=5;return {response:{authenticatorData:d.buffer}};};""")
    pg.close(); pg = pg2; pg.goto(f"http://127.0.0.1:{port}/index.html"); pg.wait_for_timeout(1500)
    ok(pg.evaluate("window.__bio") == 1, "a fresh open asks for the fingerprint")
    pg.wait_for_timeout(2500)
    ok("₹" in pg.evaluate("(document.getElementById('legend')||{}).innerText||''") and pg.evaluate("document.getElementById('lock').hidden"), "fingerprint lock opens and the figures come back")
    pg.reload(); pg.wait_for_timeout(2500)
    ok(pg.evaluate("window.__bio") == 0 and pg.evaluate("document.getElementById('lock').hidden"), "pull-to-refresh / reload within a minute does not ask again")
    pg.evaluate("const old=()=>sessionStorage.setItem('arthaSeen',String(Date.now()-120000)); addEventListener('pagehide',old); document.addEventListener('visibilitychange',old)"); pg.reload(); pg.wait_for_timeout(1500)
    ok(pg.evaluate("window.__bio") == 1, "a reload after more than a minute away asks again")
    ok(pg.evaluate("getComputedStyle(document.documentElement).overscrollBehaviorY") in ("contain", "none"), "browser pull-to-refresh (full reload) is switched off")
    ok(not errs, "no JavaScript errors with the lock on" + ("" if not errs else ": " + errs[0][:160]))
    ctx.close()
    ctx, pg, errs, csp = page(break_app=True)
    pg.wait_for_timeout(10500)
    ok(pg.evaluate("!!document.getElementById('bootFail')"), "a broken app.js shows the recovery screen, not a blank page")
    ctx.close(); b.close()
srv.shutdown()

# 6. every tab, screen, menu page and add form renders with no errors and no text spilling out of its box
r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "sweep.py")], capture_output=True, text=True, env=os.environ)
print(r.stdout.strip()[-3000:])
ok(r.returncode == 0, "screen sweep: every screen renders cleanly" + ("" if r.returncode == 0 else " (" + (r.stderr.strip().splitlines() or ["see above"])[-1][:200] + ")"))
print("\n" + ("ALL CHECKS PASSED" if not FAIL else f"{len(FAIL)} CHECK(S) FAILED — do not publish"))
sys.exit(1 if FAIL else 0)
