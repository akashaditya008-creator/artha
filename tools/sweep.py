#!/usr/bin/env python3
"""Artha screen sweep: opens every tab, screen, sub-tab, menu page and add form against a fake backend,
and fails on any JavaScript error or any text spilling out of its box (like the 3.9.3 insurance lists).

  python3 tools/sweep.py            check only (exit 1 on any failure)
  SWEEP_SHOTS=dir python3 tools/sweep.py   also save a screenshot of every screen into dir
Run by tools/check.py, so nothing is published unless every screen renders cleanly.
"""
import http.server, json, os, socketserver, sys, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get("SWEEP_SHOTS")
FAIL = []

LED = [
    ["L0001", "2024-01-05", "Aditya", "Groww · Aditya", "Cash", "Add money", "", "", "", "", 100000, "Bank", "[bank TestBank]"],
    ["L0002", "2024-01-06", "Aditya", "Groww · Aditya", "Stocks", "Buy", "Grasim Industries", "GRASIM", 10, 3157, 31570, "Balance", ""],
    ["L0003", "2024-06-06", "Aditya", "Groww · Aditya", "Stocks", "Sell", "Grasim Industries", "GRASIM", 4, 3400, -13600, "Balance", ""],
    ["L0009", "2026-11-08", "Aditya", "Groww · Aditya", "Stocks", "Buy", "Ujjivan Small Finance Bank", "UJJIVANSFB", 400, 60.33, 24132, "Balance", ""],
    ["L0010", "2026-11-08", "Aditya", "Groww · Aditya", "Stocks", "Charges", "", "", "", "", 61, "Balance", "Brokerage, STT & charges (estimated)"],
    ["L0004", "2024-02-01", "Aditya", "Groww · Aditya", "Mutual Funds", "Buy", "Axis Nifty Next 50 Index Fund Direct Growth", "", "", "", 5000, "Bank", ""],
    ["L0005", "2024-03-01", "Spardha", "Wint · Spardha", "Bonds", "Buy", "Keertana Finserv Secured NCD Series 4", "", "", "", 100000, "Bank",
     "[reps 2024-09-01:9000,2025-03-01:9000,2025-09-01:9000,2026-03-01:9000,2026-09-01:9000,2027-03-01:9000]"],
    ["L0006", "2024-09-01", "Spardha", "Wint · Spardha", "Bonds", "Repayment", "Keertana Finserv Secured NCD Series 4", "", "", "", -9000, "Bank", ""],
    ["L0007", "2021-04-01", "Aditya", "Protean · Aditya", "Others", "Buy", "NPS Tier 1", "", "", "", 5900, "Bank", "nps"],
    ["L0008", "2025-02-01", "Aditya", "HDFC Life · Aditya", "Others", "Premium", "Term insurance", "", "", "", 12508, "Bank", "term"],
]
LONG = "Third-party liability (under the separate Tata AIG policy) when the bike is used for commercial hire or reward"
REC = [
    ["pol:bike", "pol", {"title": "Ola S1 Pro · own damage", "type": "bike", "insured": "Spardha", "holder": "Spardha"}],
    ["pterm:bike26", "pterm", {"pol": "pol:bike", "start": "2026-07-14", "end": "2027-07-13", "cover": "95000", "premium": "1450",
        "insurer": "Acko General Insurance", "policyNo": "TEST000000/00", "read": 1,
        "highlights": ["Zero paperwork claims", "Cashless at network garages"],
        "covered": ["Accidental damage", "Theft", "Fire", "Natural calamities (flood, earthquake, cyclone)", "Rat bite wiring damage"],
        "notCovered": [LONG, "Commercial use (hire/reward, goods carriage), racing, speed tests, motor trade", "Driving without a valid licence or under alcohol/drugs",
                       "Aggravated loss from using a damaged bike", "Claim within 30 days of start needs the previous policy document"],
        "exclusions": ["Wear and tear, breakdowns, mechanical failures", "Tyres and tubes unless damaged in an accident (then 50% depreciation)",
                       "Undeclared non-OEM parts", "Depreciation on replaced parts (no zero-dep add-on)"],
        "fields": {"Vehicle": "Ola S1 Pro Gen 2, electric, 11 kW, reg. July 2024", "Registration no.": "TEST0000",
                   "Policy type": "Stand-alone own damage (two-wheeler)", "Add-ons": "Compulsory Personal Accident cover for owner-driver"}}],
    ["pterm:bike25", "pterm", {"pol": "pol:bike", "start": "2025-07-14", "end": "2026-07-13", "cover": "105000", "premium": "1600", "insurer": "Acko General Insurance"}],
    ["pol:health", "pol", {"title": "Family health cover", "type": "health", "insured": "Aditya, Spardha", "holder": "Aditya"}],
    # a vehicle policy filed under Health by mistake: the bell must ask, and nothing may change by itself
    ["pol:car", "pol", {"title": "Father's Creta", "type": "health", "insured": "Creta · TS09 AB 1234", "holder": "Father"}],
    ["pterm:car26", "pterm", {"pol": "pol:car", "start": "2026-05-01", "end": "2027-04-30", "cover": "640000", "premium": "18200", "insurer": "Test General",
        "fields": {"Registration no.": "TEST0001", "IDV": "6,40,000", "NCB": "35%"}}],
    ["inbox:1", "inbox", {"kind": "bond", "title": "Bond screenshots", "status": "new", "at": "2026-11-09T10:00", "files": []}],
]
DATA = {"v": 3, "at": "2026-11-09T08:00:00.000Z", "url": "https://docs.google.com/x", "led": LED, "rec": REC, "files": "",
        "chk": [], "audit": [], "me": "Aditya",
        "cfg": {"project": "https://claude.ai/project/TEST", "acct0": ["Groww · Aditya", "Wint · Spardha"],
                "banks": {"Aditya": [["TestBank", "Primary", "#F58220"]], "Spardha": [["OtherBank", "", "#3D7CF0"]]}}}

# text that overflows its own box (scroll size larger than the box, and the box doesn't scroll)
SPILL = """(()=>{const out=[];const vis=e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return false;
 for(let n=e;n&&n!==document.body;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||n.hidden)return false;}return true;};
 for(const e of document.querySelectorAll('body *')){ if(['SCRIPT','STYLE','CANVAS','svg','path','SVG','INPUT','TEXTAREA','SELECT','OPTION'].includes(e.tagName))continue;
  if(e.closest('svg,canvas,.stage,#bg3d,.chips,.tabs3,.whos'))continue;
  const s=getComputedStyle(e); if(/(auto|scroll|hidden|clip)/.test(s.overflow+s.overflowX+s.overflowY))continue;
  if(!e.innerText||!e.innerText.trim())continue; if(!vis(e))continue;
  const dh=e.scrollHeight-e.clientHeight, dw=e.scrollWidth-e.clientWidth;
  if(e.clientHeight>0&&(dh>6||dw>6)){ out.push((e.id?'#'+e.id:e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\\s+/).join('.'):''))+` spills ${dw>6?dw+'px wide ':''}${dh>6?dh+'px tall':''}: "${e.innerText.trim().slice(0,50).replace(/\\n/g,' ')}"`); } }
 return [...new Set(out)].slice(0,8);})()"""

class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass

def main():
    srv = socketserver.TCPServer(("127.0.0.1", 0), Q); port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    from playwright.sync_api import sync_playwright
    exe = os.environ.get("CHROME") or next((p for p in ["/usr/bin/google-chrome", "/usr/bin/chromium"] if os.path.exists(p)), None)
    seen = []
    with sync_playwright() as p:
        b = p.chromium.launch(**({"executable_path": exe} if exe else {}), args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        ctx = b.new_context(viewport={"width": 412, "height": 900}, service_workers="block", has_touch=True)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.route("https://script.google.com/**", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "d": DATA})))
        pg.route("https://api.mfapi.in/**", lambda r: r.fulfill(status=200, content_type="application/json", body='{"data":[]}'))
        pg.add_init_script("localStorage.setItem('artha:api',JSON.stringify('https://script.google.com/macros/s/TEST/exec'));localStorage.setItem('artha:tok',JSON.stringify('" + "a" * 64 + "'));localStorage.setItem('artha:look',JSON.stringify('still'))")
        pg.goto(f"http://127.0.0.1:{port}/index.html"); pg.wait_for_timeout(4500)

        def look(name):
            pg.wait_for_timeout(700)
            sp = pg.evaluate(SPILL); bad = list(errs); errs.clear()
            for e in bad: FAIL.append(f"{name}: JavaScript error: {e[:160]}")
            for s in sp: FAIL.append(f"{name}: {s}")
            print(("FAIL " if bad or sp else "PASS ") + name + ("" if not (bad or sp) else " — " + "; ".join([x[:120] for x in bad] + sp)))
            seen.append(name)
            if SHOTS: os.makedirs(SHOTS, exist_ok=True); pg.screenshot(path=os.path.join(SHOTS, f"{len(seen):02d} {name.replace('/', '-').replace('›', '-')}.png"), full_page=True)
        def back(): pg.evaluate("history.back()"); pg.wait_for_timeout(500)
        def close_all():
            for _ in range(5):
                if not pg.evaluate("['scr','addSheet','eSheet','sheet','drawer'].some(i=>{const e=document.getElementById(i);return e&&!e.hidden&&!e.classList.contains('bye');})"): break
                back()
        def click(sel): pg.evaluate(f"(()=>{{const e=document.querySelector({json.dumps(sel)}); if(e) e.click(); return !!e;}})()")

        look("Home · investments")
        for m in pg.evaluate("[...document.querySelectorAll('#meas button')].map((b,i)=>i)")[1:]:
            pg.evaluate(f"document.querySelectorAll('#meas button')[{m}].click()"); look(f"Home · figure {m+1}")
        for w in ["Aditya", "Spardha", "all"]:
            click(f'#whos [data-w="{w}"]'); look(f"Home · {w}")
        click("#searchBtn"); look("Search"); back()
        click("#viewList"); look("Home · list")
        cats = pg.evaluate("[...document.querySelectorAll('#ledger .cat')].map(c=>c.dataset.c)")
        for c in cats:
            pg.evaluate(f"(()=>{{const c=document.querySelector('#ledger .cat[data-c=\\'{c}\\']'); if(c&&c.getAttribute('aria-expanded')!=='true') c.querySelector('button').click();}})()")
            pg.wait_for_timeout(300); look(f"Home · {c} opened")
            click(f'#ledger [data-open="{c}"]'); pg.wait_for_timeout(500)
            tabs = pg.evaluate("[...document.querySelectorAll('#sTabs [data-t]')].map(b=>b.dataset.t)") or [""]
            for t in tabs:
                if t: click(f'#sTabs [data-t="{t}"]')
                look(f"{c} › {t or 'main'}")
                if c == "Stocks" and t == "History":
                    txt = pg.evaluate("document.getElementById('scrBody').innerText")
                    for bad in ["Brokerage", "Money added", "Every entry you"]:
                        if bad in txt: FAIL.append(f"Stocks › History still shows '{bad}'"); print(f"FAIL Stocks › History shows '{bad}'")
                    y = pg.evaluate("(document.querySelector('#scrBody [data-yr][aria-expanded=\"true\"]')||{}).dataset?.yr")
                    click(f'#scrBody [data-yr="{y}"]'); pg.wait_for_timeout(300)
                    if pg.evaluate(f"document.querySelector('#scrBody [data-yr=\"{y}\"]').getAttribute('aria-expanded')") != "false":
                        FAIL.append("Stocks › History: tapping the open year does not collapse it"); print("FAIL year collapse")
                    else: print("PASS Stocks › History: year collapses, no charges or cash moves")
                    click(f'#scrBody [data-yr="{y}"]'); pg.wait_for_timeout(300)
                    pg.evaluate("[...document.querySelectorAll('#scrBody .tx')].find(b=>b.innerText.includes('Ujjivan')).click()"); pg.wait_for_timeout(400)
                    det = pg.evaluate("document.getElementById('eBox').innerText")
                    ok_ = "60.33" in det and "24,132" in det
                    print(("PASS" if ok_ else "FAIL") + " detail page shows the exact price (60.33)")
                    if not ok_: FAIL.append("detail page does not show the exact price 60.33")
                    back()
            back()
        click("#tabIns"); look("Home · insurance")
        for pid in pg.evaluate("[...new Set([...document.querySelectorAll('#viewIns [data-pol]')].map(b=>b.dataset.pol))]"):
            click(f'#viewIns [data-pol="{pid}"]'); look(f"Policy {pid}"); back()
        click("#tabInv"); click("#viewRing"); pg.wait_for_timeout(300)
        click("#menuBtn"); look("Menu")
        for d in ["dVals", "dTds", "dChg", "dNps", "dIns", "dInbox"]:
            click("#menuBtn"); pg.wait_for_timeout(300); click("#" + d); look(f"Menu › {d[1:]}")
            close_all()
        click("#bellBtn"); look("Notifications"); back()
        def start_add(mode="in"):
            close_all(); pg.wait_for_timeout(500)
            click("#addBtn"); pg.wait_for_timeout(400)
            if mode == "out": click('#aMode [data-m="out"]')
            for k in "500": click(f'#aPad [data-k="{k}"]')
            click("#aChoose"); pg.wait_for_timeout(300)
        def rule(c, m):
            print(("PASS " if c else "FAIL ") + m)
            if not c: FAIL.append(m)
        close_all(); click("#tabIns"); pg.wait_for_timeout(300); click("#addBtn"); look("Add a policy")
        rule(pg.evaluate("!document.querySelector('#fT [aria-pressed=\"true\"]') && !document.getElementById('fN')"), "new policy: no type is pre-selected and the form waits for the choice")
        click('#fT [data-v="car"]'); look("Add a policy · car")
        rule(pg.evaluate("!!document.getElementById('fN') && /vehicle/i.test(document.getElementById('eBox').innerText)"), "new policy: choosing Car shows the vehicle form")
        close_all(); click("#bellBtn"); pg.wait_for_timeout(500)
        txt = pg.evaluate("(document.getElementById('scrBody')||document.body).innerText")
        rule("Creta: is this a Car policy?" in pg.evaluate("document.body.innerText"), "a vehicle policy filed under Health is asked about in the bell")
        rule("Ola S1 Pro · own damage: is this" not in pg.evaluate("document.body.innerText") and "Family health cover: is this" not in pg.evaluate("document.body.innerText"), "correctly filed policies are not asked about")
        rule(pg.evaluate("(()=>{const c=JSON.parse(localStorage.getItem('artha:outbox')||'[]');return !c.some(o=>JSON.stringify(o).includes('pol:car'));})()"), "no policy type is changed without a tap")
        close_all(); click("#tabInv"); pg.wait_for_timeout(300)
        # every tap answers: the control tilts and a ring of light spreads from the touch
        pg.evaluate("(()=>{const e=document.querySelector('#legend button, #legend .tile, #legend [data-c]'); const r=e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+8,clientY:r.top+8}));})()")
        rule(pg.evaluate("!!document.querySelector('.tapd') && document.querySelector('.rip').classList.contains('go')"), "a tap tilts the control and starts the light ripple")
        pg.evaluate("dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))"); pg.wait_for_timeout(400)
        rule(pg.evaluate("!document.querySelector('.tapd')"), "the control settles back after the tap")
        # the success moment: amount, what it was added to, the new total; it never blocks, and the next touch sends it away
        start_add(); click('#aCats [data-t="cash"]'); pg.wait_for_timeout(400); click("#dSave"); pg.wait_for_timeout(1900)
        y = pg.evaluate("(document.querySelector('.yay.big')||{}).innerText||''")
        rule("Added to your balance" in y and "+₹500" in y and "Total put in" in y, f"saving an investment shows the success moment ({y[:90]!r})".replace("\n", " "))
        rule(pg.evaluate("getComputedStyle(document.querySelector('.yay')).pointerEvents") == "none", "the success moment lets touches through (never blocks the next action)")
        pg.evaluate("dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:5,clientY:5}))"); pg.wait_for_timeout(700)
        rule(pg.evaluate("!document.querySelector('.yay')"), "the next touch sends the success moment away")
        look("Home · after a save")
        start_add("out"); click('#aCats [data-t="cash"]'); pg.wait_for_timeout(400); click("#dSave"); pg.wait_for_timeout(900)
        rule(pg.evaluate("!!document.querySelector('.yay.quiet') && !document.querySelector('.coin') && !document.querySelector('.yay .yamt')"), "a withdrawal gets a quiet tick: no coins, no big amount")
        pg.wait_for_timeout(1800)
        click("#menuBtn"); pg.wait_for_timeout(400)
        rule(pg.evaluate("document.querySelectorAll('#dNow .dn').length") == 3 and "Invested this month" in pg.evaluate("document.getElementById('dNow').innerText"), "the menu opens with today's three figures")
        close_all()
        start_add(); look("Add · what is it")
        for mode in ["in", "out"]:
            start_add(mode); pg.wait_for_timeout(500)
            for typ in pg.evaluate("[...document.querySelectorAll('#aCats [data-t]')].map(b=>b.dataset.t)"):
                start_add(mode); click(f'#aCats [data-t="{typ}"]'); look(f"Add {mode} · {typ}")
        back()
        b.close()
    srv.shutdown()
    ok = len(seen) >= 15 and not FAIL
    if len(seen) < 15: FAIL.append(f"only {len(seen)} screens reached (expected at least 15)")
    print(f"\nSWEEP: {len(seen)} screens, " + ("all clean" if ok else f"{len(FAIL)} problem(s)"))
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
