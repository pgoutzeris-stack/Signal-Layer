// Freie Bearbeitung ausserhalb der CI. Nach ausdruecklicher Freigabe laesst
// sich jedes Element einer Buehne waehlen, verschieben, skalieren, umfaerben,
// ersetzen und ausblenden, mit Hilfslinien und Ausrichten wie in PowerPoint.
//
// Die Aenderungen stehen als Liste am Modell: Pfad des Elements unterhalb der
// Buehne -> Werte. Nach jedem Neuzeichnen werden sie wieder angewendet, und
// das Speichern traegt sie im Dokument mit. Werkzeugknoten ([data-as-chrome])
// zaehlen im Pfad nicht mit; sonst verschoebe ein Bildknopf jede Adresse.

const SVG_NS = "http://www.w3.org/2000/svg";

/** CI-Farben zuerst, dann neutrale Toene, dann Signalfarben ausserhalb der CI. */
export const FREI_FARBEN = [
  ["#00163e", "ROOTS Navy"],
  ["#206efb", "ROOTS Blau"],
  ["#6ea3ff", "Hellblau"],
  ["#e8eef8", "Tönung"],
  ["#0f172a", "Tinte"],
  ["#475569", "Grau"],
  ["#94a3b8", "Hellgrau"],
  ["#ffffff", "Weiß"],
  ["#dc2626", "Rot"],
  ["#f59e0b", "Bernstein"],
  ["#16a34a", "Grün"],
  ["#7c3aed", "Violett"],
];

/** Wie nah eine Kante an einer anderen liegen muss, damit sie einrastet (Bildschirmpunkte). */
export const FREI_RASTER_PX = 6;

function kinderOhneChrome(knoten) {
  return [...knoten.children].filter((kind) => !kind.hasAttribute("data-as-chrome"));
}

/** Adresse eines Elements unterhalb der Wurzel, etwa "0.3.1". */
export function pfadVon(el, wurzel) {
  const teile = [];
  let knoten = el;
  while (knoten && knoten !== wurzel) {
    const eltern = knoten.parentElement;
    if (!eltern) return "";
    const index = kinderOhneChrome(eltern).indexOf(knoten);
    if (index < 0) return "";
    teile.unshift(index);
    knoten = eltern;
  }
  return knoten === wurzel && teile.length ? teile.join(".") : "";
}

export function elementAmPfad(wurzel, pfad) {
  if (!wurzel || typeof pfad !== "string" || !/^\d+(\.\d+)*$/.test(pfad)) return null;
  let knoten = wurzel;
  for (const teil of pfad.split(".")) {
    knoten = kinderOhneChrome(knoten)[Number(teil)];
    if (!knoten) return null;
  }
  return knoten;
}

/** Tag plus erste Vorlagenklasse. Passt sie nicht mehr, gilt die Aenderung nicht. */
export function elementMarke(el) {
  const klassen = String(el?.getAttribute?.("class") || "").split(/\s+/);
  const klasse = klassen.find((k) => k && !/^(as|is)-/.test(k)) || "";
  return `${String(el?.tagName || "").toLowerCase()}${klasse ? `.${klasse}` : ""}`;
}

const zahl = (wert, min, max) => {
  const n = Number(wert);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
};
const FARBE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i;
const BILD = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[a-z0-9+/=]+$/i;

/**
 * Prueft eine gespeicherte Liste: nur bekannte Felder, Zahlen in Grenzen,
 * Farben als Hex oder rgb, Bilder als Data-URI. Was nicht passt, faellt weg.
 */
export function bereinigeAenderungen(roh) {
  const out = {};
  if (!roh || typeof roh !== "object") return out;
  for (const [pfad, werte] of Object.entries(roh)) {
    if (!/^\d+(\.\d+){0,40}$/.test(pfad) || !werte || typeof werte !== "object") continue;
    const a = {};
    for (const [feld, min, max] of [["dx", -6000, 6000], ["dy", -6000, 6000], ["w", 1, 6000], ["h", 1, 6000]]) {
      const n = zahl(werte[feld], min, max);
      if (n) a[feld] = Math.round(n * 10) / 10;
    }
    for (const feld of ["sx", "sy"]) {
      const n = zahl(werte[feld], 0.05, 20);
      if (n && n !== 1) a[feld] = Math.round(n * 10000) / 10000;
    }
    for (const feld of ["farbe", "flaeche", "linie"]) {
      if (FARBE.test(String(werte[feld] || ""))) a[feld] = String(werte[feld]);
    }
    const z = zahl(werte.z, 1, 999);
    if (z) a.z = Math.round(z);
    if (werte.aus === true) a.aus = true;
    if (typeof werte.text === "string" && werte.text.length <= 20000) a.text = werte.text;
    if (werte.bild === true || (typeof werte.bild === "string" && BILD.test(werte.bild))) a.bild = werte.bild;
    if (typeof werte.t === "string" && werte.t.length <= 80) a.t = werte.t;
    if (Object.keys(a).some((feld) => feld !== "t")) out[pfad] = a;
  }
  return out;
}

/** Fuer das Speichern: Bilder stehen schon im Dokument, die Liste merkt sich nur, wo. */
export function serialisiereAenderungen(liste) {
  const out = {};
  for (const [pfad, a] of Object.entries(liste || {})) {
    out[pfad] = typeof a.bild === "string" ? { ...a, bild: true } : { ...a };
  }
  return out;
}

export function zaehleAenderungen(listen) {
  return (listen || []).reduce((summe, liste) => summe + Object.keys(liste || {}).length, 0);
}

function runde(n, stellen = 1) {
  const f = 10 ** stellen;
  return Math.round((Number(n) || 0) * f) / f;
}

function istSvg(el) {
  return el?.namespaceURI === SVG_NS;
}

/** Faerbt Formen eines SVG um. Masken, Clips und Definitionen bleiben, sonst verschwindet das Logo. */
function faerbeSvg(svg, { fill, stroke }) {
  const knoten = [svg, ...svg.querySelectorAll("*")]
    .filter((k) => !k.closest("mask, clipPath, defs, pattern, linearGradient, radialGradient, filter"));
  for (const k of knoten) {
    const f = k.getAttribute("fill");
    const s = k.getAttribute("stroke");
    if (fill && (k === svg || (f && f !== "none"))) k.style.fill = fill;
    if (stroke && s && s !== "none") k.style.stroke = stroke;
  }
}

/** Ein Bild ersetzen: img bekommt die Quelle, ein SVG-Logo ein eingebettetes Bild. */
function setzeBild(el, src) {
  const tag = String(el.tagName || "").toLowerCase();
  if (tag === "img") {
    el.setAttribute("src", src);
    el.removeAttribute("srcset");
    return;
  }
  if (istSvg(el) && tag === "svg") {
    const vb = el.viewBox?.baseVal;
    const w = vb && vb.width ? vb.width : 100;
    const h = vb && vb.height ? vb.height : 100;
    if (!el.getAttribute("viewBox")) el.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const bild = el.ownerDocument.createElementNS(SVG_NS, "image");
    bild.setAttribute("href", src);
    bild.setAttribute("x", String(vb ? vb.x : 0));
    bild.setAttribute("y", String(vb ? vb.y : 0));
    bild.setAttribute("width", String(w));
    bild.setAttribute("height", String(h));
    bild.setAttribute("preserveAspectRatio", "xMidYMid meet");
    el.replaceChildren(bild);
    return;
  }
  el.style.backgroundImage = `url("${src}")`;
  el.style.backgroundSize = "contain";
  el.style.backgroundRepeat = "no-repeat";
  el.style.backgroundPosition = "center";
}

/** Liest ein ersetztes Bild aus einem gespeicherten Dokument zurueck. */
export function bildAus(el) {
  if (!el) return "";
  const tag = String(el.tagName || "").toLowerCase();
  if (tag === "img") return el.getAttribute("src") || "";
  if (tag === "svg") return el.querySelector("image")?.getAttribute("href") || "";
  return /url\("?([^")]+)"?\)/.exec(el.style?.backgroundImage || "")?.[1] || "";
}

/** Setzt nur, was die Aenderung nennt. Zuruecksetzen heisst neu zeichnen. */
export function wendeAenderungAn(el, a, opts = {}) {
  if (!el || !a) return;
  const s = el.style;
  if (a.dx || a.dy) s.translate = `${runde(a.dx)}px ${runde(a.dy)}px`;
  if ((a.sx && a.sx !== 1) || (a.sy && a.sy !== 1)) s.scale = `${runde(a.sx || 1, 4)} ${runde(a.sy || 1, 4)}`;
  if (a.w) {
    s.width = `${runde(a.w)}px`;
    s.maxWidth = "none";
    s.flex = "0 0 auto";
    s.boxSizing = "border-box";
  }
  if (a.h) {
    s.height = `${runde(a.h)}px`;
    s.maxHeight = "none";
  }
  if (a.farbe) s.color = a.farbe;
  if (a.flaeche) {
    if (istSvg(el)) faerbeSvg(el, { fill: a.flaeche });
    else s.backgroundColor = a.flaeche;
  }
  if (a.linie) {
    if (istSvg(el)) faerbeSvg(el, { stroke: a.linie });
    else s.borderColor = a.linie;
  }
  if (a.z) {
    if (!s.position && typeof getComputedStyle === "function" && getComputedStyle(el).position === "static") s.position = "relative";
    s.zIndex = String(a.z);
  }
  if (a.aus) s.visibility = "hidden";
  if (typeof a.text === "string") el.innerHTML = typeof opts.saeubern === "function" ? opts.saeubern(a.text) : a.text;
  if (typeof a.bild === "string" && a.bild) setzeBild(el, a.bild);
}

export function wendeAenderungenAn(wurzel, liste, opts = {}) {
  if (!wurzel || !liste) return 0;
  let n = 0;
  for (const [pfad, a] of Object.entries(liste)) {
    const el = elementAmPfad(wurzel, pfad);
    if (!el || (a.t && elementMarke(el) !== a.t)) continue;
    wendeAenderungAn(el, a, opts);
    n += 1;
  }
  return n;
}

/* ── Geometrie: rein rechnerisch, damit sie ohne Browser pruefbar ist ── */

function linienVon(r) {
  return { x: [r.x, r.x + r.w / 2, r.x + r.w], y: [r.y, r.y + r.h / 2, r.y + r.h] };
}

/**
 * Rastet ein bewegtes Rechteck an Kanten und Mitten anderer Rechtecke ein.
 * Liefert die Korrektur je Achse und die Hilfslinien, die danach stimmen.
 * `achsen` begrenzt beim Skalieren auf die Kanten, die sich bewegen.
 */
export function rasteEin(rect, kandidaten, schwelle, achsen = { x: [0, 1, 2], y: [0, 1, 2] }) {
  const eigene = linienVon(rect);
  let besteX = null;
  let besteY = null;
  for (const k of kandidaten) {
    const l = linienVon(k);
    for (const i of achsen.x) {
      for (const b of l.x) {
        const d = b - eigene.x[i];
        if (Math.abs(d) <= schwelle && (!besteX || Math.abs(d) < Math.abs(besteX))) besteX = d;
      }
    }
    for (const i of achsen.y) {
      for (const b of l.y) {
        const d = b - eigene.y[i];
        if (Math.abs(d) <= schwelle && (!besteY || Math.abs(d) < Math.abs(besteY))) besteY = d;
      }
    }
  }
  const dx = besteX || 0;
  const dy = besteY || 0;
  const neu = { ...rect, x: rect.x + dx, y: rect.y + dy };
  const v = linienVon(neu);
  const linien = [];
  const gesehen = new Set();
  for (const k of kandidaten) {
    const l = linienVon(k);
    for (const i of achsen.x) {
      for (const b of l.x) {
        if (Math.abs(v.x[i] - b) >= 0.5) continue;
        const key = `x${Math.round(b)}`;
        const von = Math.min(neu.y, k.y);
        const bis = Math.max(neu.y + neu.h, k.y + k.h);
        const alt = linien.find((linie) => linie.key === key);
        if (alt) { alt.von = Math.min(alt.von, von); alt.bis = Math.max(alt.bis, bis); continue; }
        if (gesehen.size < 12) { gesehen.add(key); linien.push({ key, achse: "x", pos: b, von, bis }); }
      }
    }
    for (const i of achsen.y) {
      for (const b of l.y) {
        if (Math.abs(v.y[i] - b) >= 0.5) continue;
        const key = `y${Math.round(b)}`;
        const von = Math.min(neu.x, k.x);
        const bis = Math.max(neu.x + neu.w, k.x + k.w);
        const alt = linien.find((linie) => linie.key === key);
        if (alt) { alt.von = Math.min(alt.von, von); alt.bis = Math.max(alt.bis, bis); continue; }
        if (gesehen.size < 12) { gesehen.add(key); linien.push({ key, achse: "y", pos: b, von, bis }); }
      }
    }
  }
  return { dx, dy, linien };
}

/** Verschiebung je Rechteck, damit alle an einer Kante oder Mitte des Bezugs stehen. */
export function ausrichtung(rects, art, bezug) {
  return rects.map((r) => {
    switch (art) {
      case "links": return { dx: bezug.x - r.x, dy: 0 };
      case "mitte-h": return { dx: bezug.x + bezug.w / 2 - (r.x + r.w / 2), dy: 0 };
      case "rechts": return { dx: bezug.x + bezug.w - (r.x + r.w), dy: 0 };
      case "oben": return { dx: 0, dy: bezug.y - r.y };
      case "mitte-v": return { dx: 0, dy: bezug.y + bezug.h / 2 - (r.y + r.h / 2) };
      case "unten": return { dx: 0, dy: bezug.y + bezug.h - (r.y + r.h) };
      default: return { dx: 0, dy: 0 };
    }
  });
}

/** Gleiche Abstaende zwischen mindestens drei Rechtecken; die aeusseren bleiben stehen. */
export function verteilung(rects, achse) {
  const out = rects.map(() => ({ dx: 0, dy: 0 }));
  if (rects.length < 3) return out;
  const start = (r) => (achse === "x" ? r.x : r.y);
  const groesse = (r) => (achse === "x" ? r.w : r.h);
  const reihe = rects.map((_r, i) => i).sort((a, b) => start(rects[a]) - start(rects[b]));
  const erstes = rects[reihe[0]];
  const letztes = rects[reihe[reihe.length - 1]];
  const spanne = start(letztes) + groesse(letztes) - start(erstes);
  const belegt = rects.reduce((summe, r) => summe + groesse(r), 0);
  const luecke = (spanne - belegt) / (rects.length - 1);
  let cursor = start(erstes);
  for (const i of reihe) {
    const d = cursor - start(rects[i]);
    out[i] = achse === "x" ? { dx: d, dy: 0 } : { dx: 0, dy: d };
    cursor += groesse(rects[i]) + luecke;
  }
  return out;
}

/**
 * Neues Rechteck beim Ziehen an einem Griff (n, s, e, w und Ecken). Ecken
 * halten das Seitenverhaeltnis, wenn `seitenTreu` gilt; die Gegenkante bleibt.
 */
export function skaliere(start, griff, dx, dy, { seitenTreu = false, minimum = 8 } = {}) {
  let w = start.w;
  let h = start.h;
  if (griff.includes("e")) w = start.w + dx;
  if (griff.includes("w")) w = start.w - dx;
  if (griff.includes("s")) h = start.h + dy;
  if (griff.includes("n")) h = start.h - dy;
  w = Math.max(minimum, w);
  h = Math.max(minimum, h);
  if (seitenTreu && griff.length === 2 && start.w > 0 && start.h > 0) {
    const f = Math.max(w / start.w, h / start.h);
    w = Math.max(minimum, start.w * f);
    h = Math.max(minimum, start.h * f);
  }
  const x = griff.includes("w") ? start.x + start.w - w : start.x;
  const y = griff.includes("n") ? start.y + start.h - h : start.y;
  return { x, y, w, h };
}

function vereinigung(rects) {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const r2 = Math.max(...rects.map((r) => r.x + r.w));
  const b2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: r2 - x, h: b2 - y };
}

/* ── Kontextmenue ── */

/**
 * Menue am Mauszeiger mit Untermenues, Farbfeldern und Tastatursteuerung.
 * Eintraege: { label, icon | svg, kurz, aktion, deaktiviert, gefahr, unter,
 * farben: { werte, aktion, aktuell } }, "-" als Trenner, { titel } als Kopf.
 */
export function createKontextmenue(host) {
  const doc = host.ownerDocument;
  let wurzel = null;
  let schliessenCb = null;

  function iconHtml(e) {
    if (e.svg) return `<span class="as-km-ico">${e.svg}</span>`;
    return `<span class="as-km-ico">${e.icon ? `<i class="${e.icon}"></i>` : ""}</span>`;
  }

  function baue(eintraege, ebene) {
    const menue = doc.createElement("div");
    menue.className = `as-km${ebene ? " as-km--unter" : ""}`;
    menue.setAttribute("role", "menu");
    menue.setAttribute("data-as-chrome", "");
    eintraege.forEach((e, i) => {
      if (e === "-") {
        const t = doc.createElement("div");
        t.className = "as-km-trenner";
        t.setAttribute("role", "separator");
        menue.appendChild(t);
        return;
      }
      if (e && e.titel) {
        const k = doc.createElement("div");
        k.className = "as-km-titel";
        k.textContent = e.titel;
        menue.appendChild(k);
        return;
      }
      if (e && e.farben) {
        const zeile = doc.createElement("div");
        zeile.className = "as-km-farben";
        zeile.setAttribute("role", "group");
        if (e.label) zeile.setAttribute("aria-label", e.label);
        zeile.innerHTML = e.farben.werte.map(([farbe, name]) =>
          `<button type="button" class="as-km-farbe${e.farben.aktuell === farbe ? " is-on" : ""}" data-farbe="${farbe}" style="--f:${farbe}" title="${name}" aria-label="${name}"></button>`).join("")
          + `<label class="as-km-eigene" title="Eigene Farbe"><i class="fa-solid fa-eye-dropper"></i><input type="color" value="${FARBE.test(e.farben.aktuell || "") && String(e.farben.aktuell).startsWith("#") && e.farben.aktuell.length === 7 ? e.farben.aktuell : "#206efb"}" aria-label="Eigene Farbe"></label>`;
        zeile.addEventListener("click", (event) => {
          const knopf = event.target.closest("[data-farbe]");
          if (!knopf) return;
          event.stopPropagation();
          schliesse();
          e.farben.aktion(knopf.getAttribute("data-farbe"));
        });
        zeile.querySelector('input[type="color"]').addEventListener("change", (event) => {
          const farbe = event.target.value;
          schliesse();
          e.farben.aktion(farbe);
        });
        menue.appendChild(zeile);
        return;
      }
      const knopf = doc.createElement("button");
      knopf.type = "button";
      knopf.className = `as-km-item${e.gefahr ? " is-gefahr" : ""}${e.aktiv ? " is-aktiv" : ""}`;
      knopf.setAttribute("role", "menuitem");
      knopf.setAttribute("data-km-i", String(i));
      if (e.deaktiviert) knopf.disabled = true;
      if (e.unter) knopf.setAttribute("aria-haspopup", "menu");
      knopf.innerHTML = `${iconHtml(e)}<span class="as-km-label">${e.label}</span>${e.kurz ? `<kbd class="as-km-kurz">${e.kurz}</kbd>` : ""}${e.unter ? `<i class="fa-solid fa-chevron-right as-km-pfeil"></i>` : ""}`;
      knopf.addEventListener("click", (event) => {
        event.stopPropagation();
        if (e.deaktiviert) return;
        if (e.unter) { oeffneUnter(knopf, e.unter, ebene + 1); return; }
        schliesse();
        e.aktion?.();
      });
      knopf.addEventListener("pointerenter", () => {
        menue.querySelectorAll(":scope > .as-km-item.is-offen").forEach((k) => { if (k !== knopf) k.classList.remove("is-offen"); });
        schliesseUnter(menue);
        if (e.unter && !e.deaktiviert) oeffneUnter(knopf, e.unter, ebene + 1);
        knopf.focus({ preventScroll: true });
      });
      menue.appendChild(knopf);
    });
    return menue;
  }

  function platziere(menue, x, y, links = null) {
    const box = host.getBoundingClientRect();
    menue.style.left = "0px";
    menue.style.top = "0px";
    const w = menue.offsetWidth;
    const h = menue.offsetHeight;
    let left = x - box.left;
    let top = y - box.top;
    let ursprungX = "left";
    let ursprungY = "top";
    if (links !== null) {
      // Untermenue: rechts neben dem Eintrag, sonst links davon.
      if (left + w > box.width - 8) { left = links - box.left - w; ursprungX = "right"; }
    } else if (left + w > box.width - 8) { left = Math.max(8, left - w); ursprungX = "right"; }
    if (top + h > box.height - 8) { top = Math.max(8, box.height - 8 - h); ursprungY = links !== null ? "top" : "bottom"; }
    menue.style.left = `${Math.round(Math.max(8, left))}px`;
    menue.style.top = `${Math.round(Math.max(8, top))}px`;
    menue.style.transformOrigin = `${ursprungY} ${ursprungX}`;
  }

  function schliesseUnter(menue) {
    const ebene = Number(menue.getAttribute("data-ebene") || 0);
    host.querySelectorAll(".as-km--unter").forEach((unter) => {
      if (Number(unter.getAttribute("data-ebene") || 0) > ebene) unter.remove();
    });
  }

  function oeffneUnter(knopf, eintraege, ebene) {
    const eltern = knopf.closest(".as-km");
    if (knopf.classList.contains("is-offen") && host.querySelector(`.as-km--unter[data-ebene="${ebene}"]`)) return;
    schliesseUnter(eltern);
    eltern.querySelectorAll(":scope > .as-km-item.is-offen").forEach((k) => k.classList.remove("is-offen"));
    knopf.classList.add("is-offen");
    const unter = baue(eintraege, ebene);
    unter.setAttribute("data-ebene", String(ebene));
    host.appendChild(unter);
    const r = knopf.getBoundingClientRect();
    platziere(unter, r.right + 4, r.top - 6, r.left - 4);
    requestAnimationFrame(() => unter.classList.add("is-in"));
  }

  function aktiveListe() {
    const offen = [...host.querySelectorAll(".as-km--unter")].sort((a, b) =>
      Number(b.getAttribute("data-ebene")) - Number(a.getAttribute("data-ebene")));
    const menue = offen.find((m) => m.contains(doc.activeElement)) || (wurzel?.contains(doc.activeElement) ? wurzel : offen[0] || wurzel);
    return menue;
  }

  function onKey(event) {
    if (!wurzel) return;
    const menue = aktiveListe();
    const knoepfe = [...(menue?.querySelectorAll(":scope > .as-km-item:not([disabled])") || [])];
    const jetzt = knoepfe.indexOf(doc.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (menue && menue !== wurzel) {
        const ebene = Number(menue.getAttribute("data-ebene"));
        menue.remove();
        const eltern = ebene > 1 ? host.querySelector(`.as-km--unter[data-ebene="${ebene - 1}"]`) : wurzel;
        eltern?.querySelector(".as-km-item.is-offen")?.focus();
        eltern?.querySelectorAll(".as-km-item.is-offen").forEach((k) => k.classList.remove("is-offen"));
        return;
      }
      schliesse();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const n = knoepfe.length;
      if (!n) return;
      const ziel = event.key === "ArrowDown" ? (jetzt + 1 + n) % n : (jetzt - 1 + n) % n;
      knoepfe[jetzt < 0 && event.key === "ArrowUp" ? n - 1 : ziel]?.focus();
      return;
    }
    if (event.key === "ArrowRight" && doc.activeElement?.getAttribute("aria-haspopup")) {
      event.preventDefault();
      doc.activeElement.click();
      host.querySelector(".as-km--unter:last-of-type .as-km-item:not([disabled])")?.focus();
      return;
    }
    if (event.key === "ArrowLeft" && menue && menue !== wurzel) {
      event.preventDefault();
      const ebene = Number(menue.getAttribute("data-ebene"));
      menue.remove();
      const eltern = ebene > 1 ? host.querySelector(`.as-km--unter[data-ebene="${ebene - 1}"]`) : wurzel;
      eltern?.querySelector(".as-km-item.is-offen")?.focus();
    }
  }

  function onAussen(event) {
    if (!wurzel) return;
    if (event.target.closest?.(".as-km")) return;
    schliesse();
  }

  function zeige({ x, y, eintraege, beimSchliessen }) {
    schliesse();
    schliessenCb = beimSchliessen || null;
    wurzel = baue(eintraege, 0);
    wurzel.setAttribute("data-ebene", "0");
    host.appendChild(wurzel);
    platziere(wurzel, x, y);
    requestAnimationFrame(() => wurzel?.classList.add("is-in"));
    wurzel.querySelector(".as-km-item:not([disabled])")?.focus({ preventScroll: true });
    doc.addEventListener("keydown", onKey, true);
    doc.addEventListener("pointerdown", onAussen, true);
    doc.defaultView?.addEventListener("resize", schliesse);
    doc.defaultView?.addEventListener("blur", schliesse);
    host.addEventListener("wheel", schliesse, { passive: true });
  }

  function schliesse() {
    if (!wurzel) return;
    host.querySelectorAll(".as-km").forEach((menue) => menue.remove());
    wurzel = null;
    doc.removeEventListener("keydown", onKey, true);
    doc.removeEventListener("pointerdown", onAussen, true);
    doc.defaultView?.removeEventListener("resize", schliesse);
    doc.defaultView?.removeEventListener("blur", schliesse);
    host.removeEventListener("wheel", schliesse);
    const cb = schliessenCb;
    schliessenCb = null;
    cb?.();
  }

  return { zeige, schliesse, offen: () => Boolean(wurzel) };
}

/* ── Auswahl, Ziehen, Skalieren ── */

const GRIFFE = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function aussenSvg(el) {
  let svg = el.closest?.("svg");
  while (svg?.parentElement?.closest("svg")) svg = svg.parentElement.closest("svg");
  return svg || null;
}

function rechteck(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** Enthaelt das Element Fliesstext, wird es in der Breite gezogen statt skaliert. */
export function istTextElement(el) {
  if (!el || istSvg(el)) return false;
  if (el.hasAttribute?.("data-field")) return true;
  if (el.hasAttribute?.("data-imgslot") || /^(img|svg|video|canvas|hr)$/i.test(el.tagName)) return false;
  const eigenerText = [...el.childNodes].some((k) => k.nodeType === 3 && k.textContent.trim());
  if (!eigenerText) return false;
  return ![...el.children].some((kind) => {
    const anzeige = typeof getComputedStyle === "function" ? getComputedStyle(kind).display : "inline";
    return /^(block|flex|grid|table|list-item)$/.test(anzeige);
  });
}

/**
 * Freie Bearbeitung einer Buehnenflaeche. `modell(stage)` liefert das Modell
 * mit der Aenderungsliste `frei`; `merke()` sichert den Stand fuer
 * Rueckgaengig, bevor sich etwas aendert.
 */
export function createFreiform({ modell, merke, geaendert, kontext, massText, saeubern, textFertig } = {}) {
  let area = null;
  let ab = null;
  let auswahl = [];
  let zug = null;
  let hoverEl = null;
  let textEl = null;

  const stageVon = (el) => el?.closest?.("[data-stage]") || null;
  const seiteVon = (el, stage) => el.closest(".em-page, .li") || stage;
  const massstab = (stage) => {
    const breite = stage.offsetWidth || 1;
    return (stage.getBoundingClientRect().width || breite) / breite;
  };
  const liste = (stage) => {
    const m = modell?.(stage);
    if (!m) return null;
    if (!m.frei || typeof m.frei !== "object") m.frei = {};
    return m.frei;
  };
  const eintrag = (el, erstellen = true) => {
    const stage = stageVon(el);
    const l = stage && liste(stage);
    const pfad = stage && pfadVon(el, stage);
    if (!l || !pfad) return null;
    if (!l[pfad] && erstellen) l[pfad] = { t: elementMarke(el) };
    return l[pfad] || null;
  };

  function istSeitengross(el, seite) {
    const a = el.getBoundingClientRect();
    const b = seite.getBoundingClientRect();
    return a.width >= b.width * 0.94 && a.height >= b.height * 0.88;
  }

  /** Was ein Klick trifft: ein Feld, ein Bildplatz, ein SVG im Ganzen, sonst das Element. */
  function waehlbar(ziel, stage) {
    let el = ziel?.nodeType === 1 ? ziel : ziel?.parentElement;
    if (!el || !stage?.contains(el) || el.closest("[data-as-chrome]")) return null;
    const feld = el.closest("[data-field]");
    if (feld && stage.contains(feld)) return feld;
    const slot = el.closest("[data-imgslot]");
    if (slot && stage.contains(slot)) return slot;
    el = aussenSvg(el) || el;
    const seite = seiteVon(el, stage);
    if (el === seite || el === stage || istSeitengross(el, seite)) return null;
    return el;
  }

  function lageFuer(stage) {
    const host = stage?.closest(".as-pagehost");
    if (!host) return null;
    let lage = host.querySelector(":scope > .as-frei-lage");
    if (!lage) {
      lage = host.ownerDocument.createElement("div");
      lage.className = "as-frei-lage";
      lage.setAttribute("data-as-chrome", "");
      lage.innerHTML = `<div class="as-frei-hover" hidden></div><div class="as-frei-einzeln"></div>
        <div class="as-frei-rahmen" hidden>
          <button type="button" class="as-frei-zug" data-frei-zug title="Verschieben" aria-label="Verschieben"><i class="fa-solid fa-up-down-left-right"></i></button>
          ${GRIFFE.map((g) => `<span class="as-frei-griff" data-griff="${g}"></span>`).join("")}
        </div>
        <div class="as-frei-linien"></div><span class="as-frei-mass" hidden></span>`;
      host.appendChild(lage);
    }
    return lage;
  }

  function relativ(r, host) {
    const b = host.getBoundingClientRect();
    return { x: r.x - b.left, y: r.y - b.top, w: r.w, h: r.h };
  }

  function setzeKasten(knoten, r) {
    knoten.style.left = `${Math.round(r.x)}px`;
    knoten.style.top = `${Math.round(r.y)}px`;
    knoten.style.width = `${Math.max(1, Math.round(r.w))}px`;
    knoten.style.height = `${Math.max(1, Math.round(r.h))}px`;
  }

  function zeichne() {
    area?.querySelectorAll(".as-frei-lage").forEach((lage) => {
      const host = lage.parentElement;
      // Auf einer anderen Seite hat das Element keinen Kasten; dann kein Rahmen.
      const hier = auswahl.filter((el) => host.contains(el) && el.getClientRects().length);
      const rahmen = lage.querySelector(".as-frei-rahmen");
      const einzeln = lage.querySelector(".as-frei-einzeln");
      einzeln.innerHTML = "";
      if (!hier.length) { rahmen.hidden = true; return; }
      const rects = hier.map(rechteck);
      const gesamt = relativ(vereinigung(rects), host);
      rahmen.hidden = false;
      setzeKasten(rahmen, gesamt);
      rahmen.classList.toggle("is-mehrere", hier.length > 1);
      // Oben am Rand ist kein Platz fuer den Griff; dann sitzt er unten.
      rahmen.classList.toggle("is-unten", gesamt.y < 40);
      rahmen.classList.toggle("is-text", hier.length === 1 && istTextElement(hier[0]));
      if (hier.length > 1) {
        for (const r of rects) {
          const k = host.ownerDocument.createElement("div");
          k.className = "as-frei-einzel";
          setzeKasten(k, relativ(r, host));
          einzeln.appendChild(k);
        }
      }
    });
    zeichneHover();
  }

  function zeichneHover() {
    area?.querySelectorAll(".as-frei-lage .as-frei-hover").forEach((kasten) => {
      const host = kasten.closest(".as-pagehost");
      if (!hoverEl || zug || auswahl.includes(hoverEl) || !host.contains(hoverEl)) { kasten.hidden = true; return; }
      kasten.hidden = false;
      setzeKasten(kasten, relativ(rechteck(hoverEl), host));
    });
  }

  function zeigeLinien(stage, linien) {
    const lage = lageFuer(stage);
    if (!lage) return;
    const host = lage.parentElement;
    const b = host.getBoundingClientRect();
    lage.querySelector(".as-frei-linien").innerHTML = linien.map((l) => (l.achse === "x"
      ? `<span class="as-frei-linie is-v" style="left:${Math.round(l.pos - b.left)}px;top:${Math.round(l.von - b.top)}px;height:${Math.round(l.bis - l.von)}px"></span>`
      : `<span class="as-frei-linie is-h" style="top:${Math.round(l.pos - b.top)}px;left:${Math.round(l.von - b.left)}px;width:${Math.round(l.bis - l.von)}px"></span>`)).join("");
  }

  function zeigeMass(stage, r) {
    const lage = lageFuer(stage);
    const mass = lage?.querySelector(".as-frei-mass");
    if (!mass) return;
    if (!r) { mass.hidden = true; return; }
    const s = massstab(stage);
    const p = relativ(r, lage.parentElement);
    mass.hidden = false;
    mass.textContent = massText ? massText(r.w / s, r.h / s) : `${Math.round(r.w / s)} × ${Math.round(r.h / s)}`;
    mass.style.left = `${Math.round(p.x + p.w / 2)}px`;
    mass.style.top = `${Math.round(p.y + p.h + 10)}px`;
  }

  function waehle(els, { dazu = false } = {}) {
    const neu = (Array.isArray(els) ? els : [els]).filter(Boolean);
    if (dazu) {
      for (const el of neu) {
        if (auswahl.includes(el)) auswahl = auswahl.filter((x) => x !== el);
        else if (!auswahl.length || stageVon(auswahl[0]) === stageVon(el)) auswahl.push(el);
      }
    } else {
      auswahl = neu;
    }
    zeichne();
    geaendert?.("auswahl");
  }

  function leere() {
    if (!auswahl.length) return;
    auswahl = [];
    zeichne();
    geaendert?.("auswahl");
  }

  /** Kandidaten fuer Hilfslinien: Elemente derselben Seite plus die Seite selbst. */
  function kandidaten(stage, ohne) {
    const seite = seiteVon(ohne[0], stage);
    const out = [rechteck(seite)];
    const alle = seite.querySelectorAll("*");
    for (let i = 0; i < alle.length && out.length < 700; i += 1) {
      const el = alle[i];
      if (el.closest("[data-as-chrome]") || (istSvg(el) && el.tagName.toLowerCase() !== "svg")) continue;
      if (ohne.some((x) => x === el || x.contains(el) || el.contains(x))) continue;
      const r = rechteck(el);
      if (r.w < 3 || r.h < 3) continue;
      out.push(r);
    }
    return out;
  }

  function starteZug(event, art, griff = "") {
    const stage = stageVon(auswahl[0]);
    if (!stage) return;
    const s = massstab(stage);
    zug = {
      art, griff, stage, s,
      x0: event.clientX, y0: event.clientY,
      bewegt: false,
      rects: auswahl.map(rechteck),
      start: auswahl.map((el) => ({ ...(eintrag(el, false) || {}) })),
      kandidaten: kandidaten(stage, auswahl),
      text: auswahl.length === 1 && istTextElement(auswahl[0]),
      zeiger: event.pointerId,
    };
    try { event.target.setPointerCapture?.(event.pointerId); } catch { /* ohne Fang geht es auch */ }
  }

  function onDown(event) {
    if (event.button !== 0) return;
    const griff = event.target.closest?.("[data-griff]");
    const zugKnopf = event.target.closest?.("[data-frei-zug]");
    if ((griff || zugKnopf) && auswahl.length) {
      event.preventDefault();
      event.stopPropagation();
      starteZug(event, griff && auswahl.length === 1 ? "groesse" : "ziehen", griff?.getAttribute("data-griff") || "");
      return;
    }
    const stage = stageVon(event.target);
    if (!stage) { if (!event.target.closest?.(".as-frei-lage, .as-km")) leere(); return; }
    if (event.target.closest("[data-as-chrome]")) return;
    const el = waehlbar(event.target, stage);
    if (!el) { leere(); return; }
    if (event.shiftKey) {
      event.preventDefault();
      waehle(el, { dazu: true });
      return;
    }
    if (textEl && (el === textEl || textEl.contains(event.target))) return;
    // Text bleibt Text: ein Klick setzt den Cursor. Verschoben wird ueber den Griff.
    if (el.hasAttribute("data-field") || el.isContentEditable) {
      if (!auswahl.includes(el) || auswahl.length > 1) waehle(el);
      return;
    }
    event.preventDefault();
    if (!auswahl.includes(el)) waehle(el);
    starteZug(event, "ziehen");
  }

  function onMove(event) {
    if (!zug) {
      if (!area) return;
      const stage = stageVon(event.target);
      const el = stage ? waehlbar(event.target, stage) : null;
      if (el !== hoverEl) { hoverEl = el; zeichneHover(); }
      return;
    }
    const dx = event.clientX - zug.x0;
    const dy = event.clientY - zug.y0;
    if (!zug.bewegt) {
      if (Math.hypot(dx, dy) < 3) return;
      zug.bewegt = true;
      merke?.();
      hoverEl = null;
    }
    const einrasten = !event.altKey;
    if (zug.art === "ziehen") {
      const gesamt = vereinigung(zug.rects);
      let korr = { dx: 0, dy: 0, linien: [] };
      if (einrasten) korr = rasteEin({ ...gesamt, x: gesamt.x + dx, y: gesamt.y + dy }, zug.kandidaten, FREI_RASTER_PX);
      auswahl.forEach((el, i) => {
        const a = eintrag(el);
        if (!a) return;
        a.dx = runde((zug.start[i].dx || 0) + (dx + korr.dx) / zug.s);
        a.dy = runde((zug.start[i].dy || 0) + (dy + korr.dy) / zug.s);
        el.style.translate = `${a.dx}px ${a.dy}px`;
      });
      zeigeLinien(zug.stage, korr.linien);
      zeichne();
      return;
    }
    const el = auswahl[0];
    const a = eintrag(el);
    if (!a) return;
    const r0 = zug.rects[0];
    const seitenTreu = zug.text ? event.shiftKey : !event.shiftKey;
    let ziel = skaliere(r0, zug.griff, dx, dy, { seitenTreu, minimum: 8 });
    let linien = [];
    if (einrasten) {
      const achsen = {
        x: zug.griff.includes("e") ? [2] : zug.griff.includes("w") ? [0] : [],
        y: zug.griff.includes("s") ? [2] : zug.griff.includes("n") ? [0] : [],
      };
      const korr = rasteEin(ziel, zug.kandidaten, FREI_RASTER_PX, achsen);
      if (korr.dx || korr.dy) {
        ziel = skaliere(r0, zug.griff, dx + korr.dx, dy + korr.dy, { seitenTreu, minimum: 8 });
        linien = korr.linien;
      }
    }
    const t0 = { dx: zug.start[0].dx || 0, dy: zug.start[0].dy || 0 };
    if (zug.text) {
      // Breite und Hoehe am Element, dann die Lage nachziehen, bis die feste Kante stimmt.
      a.w = runde(ziel.w / zug.s);
      a.h = runde(ziel.h / zug.s);
      el.style.width = `${a.w}px`;
      el.style.height = `${a.h}px`;
      el.style.maxWidth = "none";
      el.style.maxHeight = "none";
      el.style.flex = "0 0 auto";
      el.style.boxSizing = "border-box";
      const jetzt = rechteck(el);
      a.dx = runde((Number(a.dx) || 0) + (ziel.x - jetzt.x) / zug.s);
      a.dy = runde((Number(a.dy) || 0) + (ziel.y - jetzt.y) / zug.s);
      el.style.translate = `${a.dx}px ${a.dy}px`;
    } else {
      // Skalieren um die Mitte, dann so verschieben, dass die Gegenkante steht.
      const sx0 = zug.start[0].sx || 1;
      const sy0 = zug.start[0].sy || 1;
      const lw = r0.w / sx0;
      const lh = r0.h / sy0;
      const lcx = r0.x + r0.w / 2 - t0.dx * zug.s;
      const lcy = r0.y + r0.h / 2 - t0.dy * zug.s;
      a.sx = runde(ziel.w / lw, 4);
      a.sy = runde(ziel.h / lh, 4);
      a.dx = runde((ziel.x + ziel.w / 2 - lcx) / zug.s);
      a.dy = runde((ziel.y + ziel.h / 2 - lcy) / zug.s);
      el.style.scale = `${a.sx} ${a.sy}`;
      el.style.translate = `${a.dx}px ${a.dy}px`;
    }
    zeigeLinien(zug.stage, linien);
    zeigeMass(zug.stage, ziel);
    zeichne();
  }

  function onUp() {
    if (!zug) return;
    const war = zug;
    zug = null;
    zeigeLinien(war.stage, []);
    zeigeMass(war.stage, null);
    if (war.bewegt) geaendert?.("aenderung");
    zeichne();
  }

  function onDoppel(event) {
    const stage = stageVon(event.target);
    const el = stage ? waehlbar(event.target, stage) : null;
    if (!el || el.hasAttribute("data-field") || el.hasAttribute("data-imgslot")) return;
    if (!istTextElement(el)) return;
    event.preventDefault();
    textBearbeiten(el);
  }

  /** CI-Text (Claim, Unterzeile, Seitenzahl) direkt im Dokument aendern. */
  function textBearbeiten(el) {
    if (!el || el.hasAttribute("data-field")) { el?.focus?.(); return; }
    beendeText();
    textEl = el;
    const vorher = el.innerHTML;
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "false");
    el.classList.add("as-frei-tippt");
    el.focus();
    const bereich = el.ownerDocument.createRange();
    bereich.selectNodeContents(el);
    const sel = el.ownerDocument.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(bereich);
    el.addEventListener("blur", () => {
      if (textEl !== el) return;
      beendeText();
      const neu = typeof saeubern === "function" ? saeubern(el.innerHTML) : el.innerHTML;
      if (neu === vorher) return;
      merke?.();
      const a = eintrag(el);
      if (a) a.text = neu;
      textFertig?.(el);
      geaendert?.("aenderung");
    }, { once: true });
  }

  function beendeText() {
    if (!textEl) return;
    textEl.removeAttribute("contenteditable");
    textEl.removeAttribute("spellcheck");
    textEl.classList.remove("as-frei-tippt");
    textEl = null;
  }

  function onKontext(event) {
    const stage = stageVon(event.target);
    if (!stage || event.target.closest("[data-as-chrome]")) return;
    const el = waehlbar(event.target, stage);
    if (el && !auswahl.includes(el)) waehle(el);
    event.preventDefault();
    kontext?.(event, el, stage);
  }

  function aktiviere(neu) {
    deaktiviere();
    area = neu;
    if (!area) return;
    ab = new AbortController();
    const opts = { signal: ab.signal };
    area.addEventListener("pointerdown", onDown, { ...opts, capture: true });
    area.addEventListener("dblclick", onDoppel, opts);
    area.addEventListener("contextmenu", onKontext, opts);
    area.addEventListener("pointerleave", () => { hoverEl = null; zeichneHover(); }, opts);
    area.ownerDocument.addEventListener("pointermove", onMove, opts);
    area.ownerDocument.addEventListener("pointerup", onUp, opts);
    area.ownerDocument.addEventListener("pointercancel", onUp, opts);
    area.querySelectorAll("[data-stage]").forEach((stage) => lageFuer(stage));
    area.classList.add("is-frei");
  }

  function deaktiviere() {
    ab?.abort();
    ab = null;
    beendeText();
    area?.classList.remove("is-frei");
    area?.querySelectorAll(".as-frei-lage").forEach((lage) => lage.remove());
    area = null;
    auswahl = [];
    zug = null;
    hoverEl = null;
  }

  /** Nach dem Neuzeichnen: dieselbe Auswahl wieder aufnehmen. */
  function merkeAuswahl() {
    return auswahl.map((el) => ({ uid: stageVon(el)?.getAttribute("data-uid") || "", pfad: pfadVon(el, stageVon(el)) }));
  }

  function stelleAuswahlHer(gemerkt) {
    if (!area || !gemerkt?.length) return;
    const els = gemerkt.map(({ uid, pfad }) => {
      const stage = area.querySelector(`[data-stage][data-uid="${CSS.escape(uid)}"]`) || area.querySelector("[data-stage]");
      return stage ? elementAmPfad(stage, pfad) : null;
    }).filter(Boolean);
    auswahl = els;
    zeichne();
  }

  function verschiebeUm(el, dxBild, dyBild) {
    const stage = stageVon(el);
    const a = eintrag(el);
    if (!stage || !a) return;
    const s = massstab(stage);
    a.dx = runde((a.dx || 0) + dxBild / s);
    a.dy = runde((a.dy || 0) + dyBild / s);
    el.style.translate = `${a.dx}px ${a.dy}px`;
  }

  function ausrichten(art) {
    if (!auswahl.length) return false;
    const rects = auswahl.map(rechteck);
    const stage = stageVon(auswahl[0]);
    const bezug = auswahl.length === 1 ? rechteck(seiteVon(auswahl[0], stage)) : vereinigung(rects);
    merke?.();
    ausrichtung(rects, art, bezug).forEach((d, i) => verschiebeUm(auswahl[i], d.dx, d.dy));
    zeichne();
    geaendert?.("aenderung");
    return true;
  }

  function verteilen(achse) {
    if (auswahl.length < 3) return false;
    merke?.();
    verteilung(auswahl.map(rechteck), achse).forEach((d, i) => verschiebeUm(auswahl[i], d.dx, d.dy));
    zeichne();
    geaendert?.("aenderung");
    return true;
  }

  function schiebe(dx, dy) {
    if (!auswahl.length) return false;
    merke?.();
    auswahl.forEach((el) => verschiebeUm(el, dx, dy));
    zeichne();
    geaendert?.("aenderung");
    return true;
  }

  function setze(feld, wert) {
    if (!auswahl.length) return false;
    merke?.();
    for (const el of auswahl) {
      const a = eintrag(el);
      if (!a) continue;
      a[feld] = wert;
      wendeAenderungAn(el, { [feld]: wert }, { saeubern });
    }
    zeichne();
    geaendert?.("aenderung");
    return true;
  }

  function nachVorne() {
    if (!auswahl.length) return false;
    const stage = stageVon(auswahl[0]);
    const l = liste(stage) || {};
    const hoechste = Math.max(9, ...Object.values(l).map((a) => Number(a.z) || 0));
    return setze("z", hoechste + 1);
  }

  function ausblenden() {
    if (!auswahl.length) return false;
    setze("aus", true);
    leere();
    return true;
  }

  /** Entfernt Felder aus der Liste. Wirksam wird es beim Neuzeichnen. */
  function entferne(felder) {
    if (!auswahl.length) return false;
    merke?.();
    for (const el of auswahl) {
      const a = eintrag(el, false);
      if (!a) continue;
      for (const feld of felder) delete a[feld];
      if (!Object.keys(a).some((feld) => feld !== "t")) {
        const stage = stageVon(el);
        delete liste(stage)[pfadVon(el, stage)];
      }
    }
    geaendert?.("neu");
    return true;
  }

  function elternWaehlen() {
    if (auswahl.length !== 1) return false;
    const el = auswahl[0];
    const stage = stageVon(el);
    const seite = seiteVon(el, stage);
    let eltern = el.parentElement;
    while (eltern && eltern !== seite && (eltern.hasAttribute("data-as-chrome") || eltern.getBoundingClientRect().width < 2)) eltern = eltern.parentElement;
    if (!eltern || eltern === seite || eltern === stage || istSeitengross(eltern, seite)) return false;
    waehle(eltern);
    return true;
  }

  function bildErsetzen(src) {
    if (auswahl.length !== 1 || !src) return false;
    return setze("bild", src);
  }

  function taste(event) {
    if (!area || !auswahl.length) return false;
    const tippt = event.target?.isContentEditable || /^(input|textarea|select)$/i.test(event.target?.tagName || "");
    if (tippt) {
      if (event.key === "Escape" && event.target.isContentEditable) {
        event.target.blur();
        zeichne();
        return true;
      }
      return false;
    }
    const schritt = event.shiftKey ? 10 : 1;
    const pfeile = { ArrowLeft: [-schritt, 0], ArrowRight: [schritt, 0], ArrowUp: [0, -schritt], ArrowDown: [0, schritt] };
    if (pfeile[event.key]) {
      const stage = stageVon(auswahl[0]);
      const s = stage ? massstab(stage) : 1;
      schiebe(pfeile[event.key][0] * s, pfeile[event.key][1] * s);
      return true;
    }
    if (event.key === "Delete" || event.key === "Backspace") return ausblenden();
    if (event.key === "Escape") { leere(); return true; }
    return false;
  }

  return {
    aktiviere, deaktiviere, waehle, leere, zeichne, taste,
    auswahl: () => [...auswahl],
    aktiv: () => Boolean(area),
    merkeAuswahl, stelleAuswahlHer,
    ausrichten, verteilen, setze, nachVorne, ausblenden, entferne, elternWaehlen, bildErsetzen, textBearbeiten,
    waehlbar,
  };
}
