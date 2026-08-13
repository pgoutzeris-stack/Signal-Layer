#!/usr/bin/env python3
"""Erzeugt asset-templates.js aus den echten, bereits gebauten ROOTS-Assets.

Quelle sind die generierten Einzelposts auf dem Desktop. Deren Markup und CSS
sind die Wahrheit; hier werden nur die Inhalte durch Platzhalter ersetzt, damit
Vorschau und fertiges Asset dieselbe Vorlage benutzen.
"""
import re, json, glob, os

SRC = "/Users/panogoutzeris/Desktop/ROOTS-Assets/KI-im-Marketing/LinkedIn/Single-Posts"
OUT = "/private/tmp/claude-501/-Users-panogoutzeris-Desktop/9b3fbce8-d20e-4d01-b5da-35393f61d03f/scratchpad/SL/asset-templates.js"

FILES = {
    "A": "ROOTS_LinkedIn_A_Zitat.html",
    "B": "ROOTS_LinkedIn_B_Titel.html",
    "C": "ROOTS_LinkedIn_C_Split-Bild.html",
    "D": "ROOTS_LinkedIn_D_Vollbild.html",
    "E": "ROOTS_LinkedIn_E_Stat.html",
    "F": "ROOTS_LinkedIn_F_Listicle.html",
    "G": "ROOTS_LinkedIn_G_Mythos-Fakt.html",
    "H": "ROOTS_LinkedIn_H_Multi-Stat.html",
    "I": "ROOTS_LinkedIn_I_Prozess.html",
    "J": "ROOTS_LinkedIn_J_Zitat-Bild.html",
    "K": "ROOTS_LinkedIn_K_Werbe-Strike.html",
    "L": "ROOTS_LinkedIn_L_Annotiert.html",
}

def read(name):
    return open(os.path.join(SRC, name), encoding="utf-8").read()

def layout_css(html):
    """Nur was die Kachel braucht: die Farbtoken und der .li-Block.

    Die Quelldateien tragen zusaetzlich das komplette A4-Dokument-CSS des
    Whitepapers mit. Das waeren 11 KB, die im Studio nichts tun und deren
    @page-Regel den Druck der Kachel stoeren wuerde.
    """
    blocks = re.findall(r"<style>(.*?)</style>", html, re.S)
    token = ""
    kachel = ""
    for b in blocks:
        if ".li{" in b:
            kachel = re.sub(r"@page\{[^}]*\}", "", b).strip()
        elif ":root{" in b and not token:
            m = re.search(r":root\{[^}]*\}", b, re.S)
            if m:
                token = m.group(0)
    if not kachel:
        raise SystemExit("Kachel-CSS nicht gefunden")
    return token + "\n" + kachel

def body_of(html):
    return re.search(r"<body[^>]*>(.*?)</body>", html, re.S).group(1).strip()

def feld(html, muster, feldname, tag_gruppe=1):
    """Ersetzt den Inhalt eines Elements durch einen Platzhalter mit data-field."""
    def ersetzen(m):
        vorher = m.group(0)
        inner = m.group(tag_gruppe)
        return vorher.replace(inner, "{{%s}}" % feldname, 1)
    neu, n = re.subn(muster, ersetzen, html, count=1, flags=re.S)
    if not n:
        raise SystemExit("Muster nicht gefunden fuer %s" % feldname)
    return neu

def mit_feld(html, muster, feldname):
    """Wie feld(), setzt zusaetzlich data-field auf das Element."""
    def ersetzen(m):
        ganz = m.group(0)
        inner = m.group(1)
        ganz = ganz.replace(inner, "{{%s}}" % feldname, 1)
        return ganz.replace(">", ' data-field="%s">' % feldname, 1)
    neu, n = re.subn(muster, ersetzen, html, count=1, flags=re.S)
    if not n:
        raise SystemExit("Muster nicht gefunden fuer %s" % feldname)
    return neu

def bilder_zu_slots(html):
    """Logo bleibt Logo, Fotos werden Bildplaetze."""
    html = re.sub(r'(<img class="logo[^"]*"[^>]*src=")data:image/[^"]*(")', r"\1{{logo}}\2", html)
    # Vollbild- und Panelfotos: Quelle als Platzhalter, Slot-Markierung dran
    html = re.sub(r'src="data:image/[^"]*"', 'src="{{image}}" data-imgsrc', html)
    html = re.sub(r"url\(&quot;?data:image/[^)]*\)", "url({{image}})", html)
    html = re.sub(r"url\('?data:image/[^)]*'?\)", "url({{image}})", html)
    return html

def kicker_und_fuss(html):
    html = mit_feld(html, r'<span class="kick[^"]*"[^>]*>(.*?)</span>', "kicker")
    html = mit_feld(html, r'<div class="foot[^"]*"[^>]*>\s*<span[^>]*>(.*?)</span>', "footer_left")
    return html

def msg_band(html):
    if 'class="msg"' in html:
        html = mit_feld(html, r'<div class="msg"[^>]*>.*?<p[^>]*>(.*?)</p>', "takeaway")
    return html

def repeat(html, start_muster, feldname):
    """Markiert einen wiederholten Block als Schleife."""
    m = re.search(start_muster, html, re.S)
    if not m:
        raise SystemExit("Schleife nicht gefunden: %s" % feldname)
    block = m.group(0)
    return html.replace(block, "<!--repeat:%s-->%s<!--/repeat-->" % (feldname, block), 1)

H1 = r'<h1[^>]*>(.*?)</h1>'
def P(size):
    return r'<p style="font-size:%s[^"]*"[^>]*>(.*?)</p>' % size
def DIV(size):
    return r'<div style="font-size:%s[^"]*"[^>]*>(.*?)</div>' % size

def regeln(key, b):
    if key == "A":
        b = mit_feld(b, P("60px"), "quote")
    elif key == "B":
        b = mit_feld(b, H1, "title"); b = mit_feld(b, P("34px"), "subtitle")
    elif key == "C":
        b = mit_feld(b, H1, "title"); b = mit_feld(b, P("30px"), "subtitle")
    elif key == "D":
        b = mit_feld(b, H1, "title"); b = mit_feld(b, P("30px"), "subtitle")
    elif key == "E":
        b = mit_feld(b, DIV("230px"), "stat_value")
        b = mit_feld(b, P("44px"), "title"); b = mit_feld(b, P("28px"), "subtitle")
    elif key == "F":
        b = mit_feld(b, H1, "title")
        b = schleife(b, r'<div style="display:flex;gap:26px;align-items:flex-start;[^"]*">\s*<div[^>]*>.*?</div>\s*<span[^>]*>.*?</span>\s*</div>', "bullets",
                     [(r'<span style="font-size:32px[^"]*"[^>]*>(.*?)</span>', "item"),
                      (r'<div style="flex:0 0 auto;width:58px[^"]*"[^>]*>(.*?)</div>', "n")])
    elif key == "G":
        b = mit_feld(b, r'<div style="border:1px solid var\(--line\);[^"]*">.*?<p[^>]*>(.*?)</p>', "myth")
        b = mit_feld(b, r'<div style="border:1px solid #cfe0fd;[^"]*">.*?<p[^>]*>(.*?)</p>', "fact")
    elif key == "H":
        b = schleife(b, r'<div style="display:flex;align-items:baseline;gap:30px;[^"]*">.*?</span>\s*</div>', "stats",
                     [(r'<div style="flex:0 0 auto;width:300px[^"]*"[^>]*>(.*?)</div>', "value"),
                      (r'<span style="font-size:28px[^"]*"[^>]*>(.*?)</span>', "label")])
    elif key == "I":
        b = mit_feld(b, H1, "title")
        b = schleife(b, r'<div style="position:relative;display:flex;gap:28px;[^"]*">.*?</div>\s*</div>\s*</div>', "steps",
                     [(r'<div style="font-size:34px;font-weight:700;color:var\(--ink\);?"[^>]*>(.*?)</div>', "title"),
                      (r'<div style="font-size:26px[^"]*"[^>]*>(.*?)</div>', "text"),
                      (r'<div style="flex:0 0 auto;width:58px[^"]*"[^>]*>(.*?)</div>', "n")])
    elif key == "J":
        b = mit_feld(b, P("56px"), "quote")
    elif key == "K":
        b = mit_feld(b, H1, "title")
    elif key == "L":
        b = mit_feld(b, DIV("270px"), "stat_value")
        b = mit_feld(b, P("40px"), "title")
    return b

def schleife(html, block_muster, feldname, inner_regeln):
    m = re.search(block_muster, html, re.S)
    if not m:
        raise SystemExit("Schleifenblock nicht gefunden: %s" % feldname)
    block = m.group(0)
    neu_block = block
    for muster, feld_name in inner_regeln:
        try:
            neu_block = mit_feld(neu_block, muster, feld_name)
        except SystemExit:
            raise SystemExit("Inneres Feld %s fehlt in %s" % (feld_name, feldname))
    huelle = "<!--repeat:%s-->%s<!--/repeat-->" % (feldname, neu_block)
    # alle weiteren Wiederholungen desselben Musters entfernen: die Schleife baut sie neu
    rest = html.replace(block, "@@BLOCK@@", 1)
    rest = re.sub(block_muster, "", rest, flags=re.S)
    return rest.replace("@@BLOCK@@", huelle, 1)

templates = {}
css = None

for key, name in FILES.items():
    html = read(name)
    if css is None:
        css = layout_css(html)
    b = body_of(html)
    b = bilder_zu_slots(b)
    b = kicker_und_fuss(b)
    b = msg_band(b)
    b = regeln(key, b)
    b = re.sub(r"\s+", " ", b).strip()
    templates[key] = b

kopf = """// Vorlagen der LinkedIn-Assets. Markup und CSS stammen unveraendert aus den
// bereits gebauten ROOTS-Einzelposts (KI-im-Marketing/LinkedIn/Single-Posts);
// nur die Inhalte sind durch Platzhalter ersetzt. Erzeugt von
// scratchpad/gen-templates.py - Aenderungen dort vornehmen, nicht hier.
//
// Platzhalter: {{feld}} wird ersetzt, [data-field] macht das Element in der
// Werkbank bearbeitbar, <!--repeat:x--> wiederholt den Block je Eintrag.

"""
with open(OUT, "w", encoding="utf-8") as f:
    f.write(kopf)
    f.write("export const ASSET_TEMPLATE_CSS = " + json.dumps(css, ensure_ascii=False) + ";\n\n")
    f.write("export const ASSET_TEMPLATES = {\n")
    for k in sorted(templates):
        f.write("  %s: %s,\n" % (k, json.dumps(templates[k], ensure_ascii=False)))
    f.write("};\n")

print("CSS:", len(css), "Zeichen")
for k in sorted(templates):
    v = templates[k]
    print(k, len(v), "|", sorted(set(re.findall(r"\{\{([a-z_]+)\}\}", v))), "| Schleife:", re.findall(r"repeat:([a-z]+)", v))
