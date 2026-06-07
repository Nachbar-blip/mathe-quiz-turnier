/* Mathe Quiz-Turnier · Steuerung, Schüler-Ansicht, Lösungsliste.
   Statisch, kein Server. Spielstand in localStorage + Sicherungs-Code. */
(function () {
  "use strict";

  var DATA = window.QUIZ;
  var PARAMS = new URLSearchParams(location.search);
  var VIEW = PARAMS.get("ansicht") || "steuer";
  var LS_KEY = "quizTurnier_v1";

  // ---------- Helpers ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function blockOf(id) { return DATA.bloecke.find(function (b) { return b.id === id; }) || { name: id, farbe: "#888", phase: "" }; }
  var TYPLABEL = { mc: "Multiple Choice", offen: "Offene Frage", erklaeren: "Erkläre einem Mitschüler" };

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  // \frac{}{} -> CSS-Bruch, plus ein paar LaTeX-Makros -> Unicode.
  function math(str) {
    var s = escapeHtml(str);
    var fr = /\\frac\{([^{}]*)\}\{([^{}]*)\}/;
    var guard = 0;
    while (fr.test(s) && guard++ < 60) {
      s = s.replace(fr, '<span class="frac"><span class="fn">$1</span><span class="fd">$2</span></span>');
    }
    s = s.replace(/\\left/g, "").replace(/\\right/g, "")
         .replace(/\\cdot/g, "·").replace(/\\times/g, "×").replace(/\\div/g, ":")
         .replace(/\\leq/g, "≤").replace(/\\geq/g, "≥").replace(/\\neq/g, "≠")
         .replace(/\\parallel/g, "∥").replace(/\\angle/g, "∠").replace(/\\circ/g, "°")
         .replace(/\\square/g, "□").replace(/\\quad/g, "  ").replace(/\\qquad/g, "   ")
         .replace(/\\[,;:!]/g, " ");
    // Sicherheitsnetz: übrig gebliebene unbekannte \makro nicht roh anzeigen
    s = s.replace(/\\([a-zA-Z]+)/g, "$1");
    return s;
  }
  var LETTERS = ["A", "B", "C", "D", "E", "F"];

  // ---------- Runden (deterministisch, für beide Ansichten gleich) ----------
  function orderByType(qs) {
    var groups = { mc: [], offen: [], erklaeren: [] };
    qs.forEach(function (q) { (groups[q.typ] || (groups[q.typ] = [])).push(q); });
    var order = ["mc", "offen", "erklaeren"], out = [], added = true;
    while (added) {
      added = false;
      order.forEach(function (t) { if (groups[t] && groups[t].length) { out.push(groups[t].shift()); added = true; } });
    }
    return out;
  }
  function buildRounds(fragen, size) {
    size = size || 6;
    var queues = DATA.bloecke.map(function (b) {
      return orderByType(fragen.filter(function (f) { return f.block === b.id; }));
    });
    var inter = [], added = true;
    while (added) {
      added = false;
      for (var i = 0; i < queues.length; i++) {
        if (queues[i].length) { inter.push(queues[i].shift()); added = true; }
      }
    }
    var rounds = [];
    for (var j = 0; j < inter.length; j += size) rounds.push(inter.slice(j, j + size));
    return rounds;
  }
  var ROUNDS = buildRounds(DATA.fragen.slice());

  function flat() {
    var arr = [];
    ROUNDS.forEach(function (r, ri) { r.forEach(function (q, fi) { arr.push({ ri: ri, fi: fi, q: q }); }); });
    return arr;
  }

  // ---------- Zustand ----------
  function defaultState() {
    return { setupDone: false, teams: [], pos: { r: 0, f: 0 }, gesehen: {}, history: [] };
  }
  var state = loadState() || defaultState();
  var revealed = false; // nur UI, nicht gespeichert

  function loadState() {
    try { var s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function exportCode() {
    return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  }
  function importCode(code) {
    var s = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!s || !Array.isArray(s.teams)) throw new Error("ungültig");
    state = s; saveState();
  }

  function curQ() { var r = ROUNDS[state.pos.r]; return r ? (r[state.pos.f] || null) : null; }

  function go(delta) {
    var list = flat();
    var idx = list.findIndex(function (x) { return x.ri === state.pos.r && x.fi === state.pos.f; });
    if (idx < 0) idx = 0;
    idx = Math.max(0, Math.min(list.length - 1, idx + delta));
    state.pos = { r: list[idx].ri, f: list[idx].fi };
    revealed = false; saveState(); render();
  }
  function jumpTo(r, f) { state.pos = { r: r, f: f }; revealed = false; saveState(); render(); }

  function award(teamIdx, pts) {
    state.teams[teamIdx].punkte += pts;
    var q = curQ(); if (q) state.gesehen[q.id] = true;
    state.history.push({ teamIdx: teamIdx, pts: pts, qid: q ? q.id : null });
    saveState(); render();
  }
  function undo() {
    var h = state.history.pop();
    if (h && state.teams[h.teamIdx]) { state.teams[h.teamIdx].punkte -= h.pts; saveState(); render(); }
  }

  // ---------- Modal ----------
  function modal(title, bodyHtml, onMount) {
    var ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = '<div class="modal"><h3>' + escapeHtml(title) + "</h3>" + bodyHtml + "</div>";
    ov.addEventListener("click", function (e) { if (e.target === ov) document.body.removeChild(ov); });
    document.body.appendChild(ov);
    if (onMount) onMount(ov, function () { if (ov.parentNode) document.body.removeChild(ov); });
    return ov;
  }
  function openSave() {
    var code = exportCode();
    modal("Spielstand sichern",
      '<p class="mini">Kopiere diesen Code (oder den Link) und füge ihn auf einem anderen Gerät unter „Laden“ ein. Der Stand wird außerdem automatisch im Browser gespeichert.</p>' +
      '<textarea readonly id="m_code">' + escapeHtml(code) + "</textarea>" +
      '<div class="row"><button class="ghost" id="m_link">🔗 Link kopieren</button><button class="primary" id="m_copy">Code kopieren</button><button class="ghost" id="m_close">Schließen</button></div>',
      function (ov, close) {
        $("#m_close", ov).onclick = close;
        $("#m_copy", ov).onclick = function () { copy(code, this); };
        $("#m_link", ov).onclick = function () {
          var url = location.origin + location.pathname + "?stand=" + encodeURIComponent(code);
          copy(url, this);
        };
        $("#m_code", ov).focus(); $("#m_code", ov).select();
      });
  }
  function openLoad() {
    modal("Spielstand laden",
      '<p class="mini">Füge hier einen gesicherten Code ein und klicke „Laden“.</p>' +
      '<textarea id="m_in" placeholder="Code hier einfügen …"></textarea>' +
      '<div class="row"><button class="ghost" id="m_close">Abbrechen</button><button class="primary" id="m_do">Laden</button></div>',
      function (ov, close) {
        $("#m_close", ov).onclick = close;
        $("#m_do", ov).onclick = function () {
          try { importCode($("#m_in", ov).value); close(); render(); }
          catch (e) { alert("Code konnte nicht gelesen werden."); }
        };
      });
  }
  function openQR() {
    var url = location.origin + location.pathname + "?ansicht=schueler";
    modal("QR-Code · Schüler-Ansicht",
      '<div style="text-align:center">' +
        '<img src="qr-schueler.png" alt="QR-Code Schüler-Ansicht" style="width:min(72vw,360px);height:auto;border-radius:12px;background:#fff;padding:10px;box-shadow:0 2px 10px rgba(0,0,0,.08)">' +
        '<p class="mini" style="margin:.7rem 0 0;word-break:break-all">' + escapeHtml(url) + "</p>" +
        '<p class="mini">Auf dem Beamer zeigen → die SuS scannen mit der Handy-Kamera → die Schüler-Ansicht öffnet sich.</p>' +
      "</div>" +
      '<div class="row"><button class="primary" id="m_close">Schließen</button></div>',
      function (ov, close) { $("#m_close", ov).onclick = close; });
  }
  function copy(text, btn) {
    var done = function () { var t = btn.textContent; btn.textContent = "✓ kopiert"; setTimeout(function () { btn.textContent = t; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta);
  }

  // ---------- Render: Setup ----------
  function viewSetup() {
    return '<div class="wrap setup"><div class="card">' +
      "<h1>🎓 " + escapeHtml(DATA.meta.titel) + "</h1>" +
      "<p>" + escapeHtml(DATA.meta.untertitel) + "</p>" +
      '<div class="teamcount" id="tc">' +
        '<button data-n="2">2 Teams</button><button data-n="4">4 Teams</button>' +
      "</div>" +
      '<div class="nameinputs" id="names"></div>' +
      '<button class="primary big" id="start">Turnier starten ▶</button>' +
      '<p style="margin:1.1rem 0 0"><a href="anleitung.html" target="_blank" style="color:var(--indigo);font-weight:600;text-decoration:none">📖 Spielanleitung öffnen</a></p>' +
      "</div></div>";
  }
  function bindSetup() {
    var n = 2;
    function draw() {
      var c = $("#names"); c.innerHTML = "";
      var defaults = ["Team Rot", "Team Blau", "Team Grün", "Team Gelb"];
      for (var i = 0; i < n; i++) {
        var inp = document.createElement("input");
        inp.placeholder = "Name Team " + (i + 1); inp.value = defaults[i]; inp.id = "tn" + i;
        c.appendChild(inp);
      }
      Array.prototype.forEach.call(document.querySelectorAll("#tc button"), function (b) {
        b.classList.toggle("sel", +b.dataset.n === n);
      });
    }
    document.querySelectorAll("#tc button").forEach(function (b) {
      b.onclick = function () { n = +b.dataset.n; draw(); };
    });
    $("#start").onclick = function () {
      state = defaultState();
      for (var i = 0; i < n; i++) {
        var v = ($("#tn" + i).value || "Team " + (i + 1)).trim();
        state.teams.push({ name: v, punkte: 0 });
      }
      state.setupDone = true; saveState(); render();
    };
    draw();
  }

  // ---------- Render: Steuer-Ansicht ----------
  function header() {
    var q = curQ();
    var pos = q ? ("Runde " + (state.pos.r + 1) + " · Frage " + (state.pos.f + 1)) : "—";
    return '<header class="top">' +
      '<div class="brand"><b>' + escapeHtml(DATA.meta.titel) + "</b><span>" + escapeHtml(DATA.meta.untertitel) + "</span></div>" +
      '<div class="posbadge"><b>' + pos.split(" · ")[0] + '</b><span>' + (q ? "Frage " + (state.pos.f + 1) : "") + "</span></div>" +
      '<div class="actions">' +
        '<button id="h_stud">📱 Schüler-Ansicht</button>' +
        '<button id="h_qr">📲 QR</button>' +
        '<button id="h_loes">📋 Lösungsliste</button>' +
        '<button id="h_save">💾 Sichern</button>' +
        '<button id="h_load">📂 Laden</button>' +
        '<button id="h_reset">↺ Neu</button>' +
      "</div></header>";
  }
  function questionCard(q, opts) {
    opts = opts || {};
    var b = blockOf(q.block);
    var h = '<div class="card"><div class="qhead">' +
      '<span class="pill" style="background:' + b.farbe + '">' + escapeHtml(b.name) + " · " + escapeHtml(b.phase) + "</span>" +
      '<span class="pill type">' + escapeHtml(TYPLABEL[q.typ] || q.typ) + "</span>" +
      '<span class="pts">' + q.punkte + " Punkte</span></div>" +
      '<div class="qtext">' + math(q.frage) + "</div>";
    if (q.typ === "mc" && q.optionen && q.optionen.length) {
      h += '<ul class="options">';
      q.optionen.forEach(function (o, i) {
        var ok = opts.showSolution && i === q.loesungIndex;
        h += "<li class=\"" + (ok ? "correct" : "") + "\"><span class=\"letter\">" + LETTERS[i] + "</span><span>" + math(o) + "</span></li>";
      });
      h += "</ul>";
    }
    if (opts.showSolution) {
      h += '<div class="solution"><h4>Lösung</h4>' + math(q.loesung) + "</div>";
    }
    return h + "</div>";
  }
  function roundOptionsHtml() {
    var out = "";
    ROUNDS.forEach(function (r, ri) {
      out += '<option value="' + ri + '"' + (ri === state.pos.r ? " selected" : "") + ">Runde " + (ri + 1) + " (" + r.length + ")</option>";
    });
    return out;
  }
  function frageOptionsHtml() {
    var r = ROUNDS[state.pos.r] || [];
    return r.map(function (q, fi) {
      return '<option value="' + fi + '"' + (fi === state.pos.f ? " selected" : "") + ">Frage " + (fi + 1) + "</option>";
    }).join("");
  }
  function scoreboard() {
    var q = curQ();
    var pts = q ? q.punkte : 0;
    var palette = ["#dc2626", "#2563eb", "#16a34a", "#d97706"];
    var h = '<div class="scoreboard"><h3>Punktestand</h3>';
    state.teams.forEach(function (t, i) {
      h += '<div class="team" style="--tc:' + palette[i % 4] + '">' +
        '<div class="tname">' + escapeHtml(t.name) + "</div>" +
        '<div class="tscore">' + t.punkte + "</div>" +
        '<div class="tbtns">' +
          '<button class="award" data-aw="' + i + '">+ ' + pts + " Punkte</button>" +
          '<button class="step" data-pm="' + i + '" data-d="5">+5</button>' +
          '<button class="step" data-pm="' + i + '" data-d="-5">−5</button>' +
        "</div></div>";
    });
    h += '<div class="toolbar"><button class="ghost" id="s_undo">↶ Rückgängig</button>' +
         '<span class="mini">Gespielt: ' + Object.keys(state.gesehen).length + " / " + DATA.fragen.length + "</span></div>";
    return h + "</div>";
  }
  function viewSteuer() {
    var q = curQ();
    var left = q ? questionCard(q, { showSolution: revealed }) +
      '<div class="navbar">' +
        '<button class="big" id="n_prev">◀ Zurück</button>' +
        '<button class="primary big" id="n_sol">' + (revealed ? "Lösung verbergen" : "Lösung zeigen") + "</button>" +
        '<button class="big" id="n_next">Weiter ▶</button>' +
        '<span class="jump">Springe: ' +
          '<select id="j_r">' + roundOptionsHtml() + "</select>" +
          '<select id="j_f">' + frageOptionsHtml() + "</select></span>" +
      "</div>"
      : '<div class="card"><div class="qtext">Keine Fragen geladen.</div></div>';
    return header() + '<div class="wrap"><div class="grid"><div>' + left + "</div>" + scoreboard() + "</div></div>";
  }
  function bindSteuer() {
    $("#h_stud").onclick = function () { window.open("?ansicht=schueler", "_blank"); };
    $("#h_qr").onclick = openQR;
    $("#h_loes").onclick = function () { window.open("?ansicht=loesungen", "_blank"); };
    $("#h_save").onclick = openSave;
    $("#h_load").onclick = openLoad;
    $("#h_reset").onclick = function () { if (confirm("Neues Turnier starten? Der aktuelle Stand geht verloren (sichere ihn vorher!).")) { state = defaultState(); saveState(); render(); } };
    var prev = $("#n_prev"), next = $("#n_next"), sol = $("#n_sol");
    if (prev) prev.onclick = function () { go(-1); };
    if (next) next.onclick = function () { go(1); };
    if (sol) sol.onclick = function () { revealed = !revealed; render(); };
    var jr = $("#j_r"), jf = $("#j_f");
    if (jr) jr.onchange = function () { jumpTo(+jr.value, 0); };
    if (jf) jf.onchange = function () { jumpTo(state.pos.r, +jf.value); };
    document.querySelectorAll("[data-aw]").forEach(function (b) {
      b.onclick = function () { var q = curQ(); award(+b.dataset.aw, q ? q.punkte : 0); };
    });
    document.querySelectorAll("[data-pm]").forEach(function (b) {
      b.onclick = function () { state.teams[+b.dataset.pm].punkte += +b.dataset.d; saveState(); render(); };
    });
    var u = $("#s_undo"); if (u) u.onclick = undo;
  }

  // ---------- Render: Schüler-Ansicht ----------
  function viewSchueler() {
    var sr = +(PARAMS.get("r") || 0), sf = +(PARAMS.get("f") || 0);
    if (location.hash) { var m = location.hash.match(/R(\d+)F(\d+)/i); if (m) { sr = +m[1] - 1; sf = +m[2] - 1; } }
    sr = Math.max(0, Math.min(ROUNDS.length - 1, sr));
    var r = ROUNDS[sr] || [];
    sf = Math.max(0, Math.min(r.length - 1, sf));
    var q = r[sf];
    var rsel = ROUNDS.map(function (rr, i) { return '<option value="' + i + '"' + (i === sr ? " selected" : "") + ">Runde " + (i + 1) + "</option>"; }).join("");
    var fsel = r.map(function (qq, i) { return '<option value="' + i + '"' + (i === sf ? " selected" : "") + ">Frage " + (i + 1) + "</option>"; }).join("");
    var h = '<div class="wrap student">' +
      '<div class="selbar"><b>Wähle:</b> <select id="ss_r">' + rsel + "</select><select id=\"ss_f\">" + fsel + "</select></div>" +
      '<div class="studenthead"><div class="pos">Runde ' + (sr + 1) + " · Frage " + (sf + 1) + "</div></div>";
    if (q) {
      var b = blockOf(q.block);
      h += '<div class="card"><div class="qhead">' +
        '<span class="pill" style="background:' + b.farbe + '">' + escapeHtml(b.name) + "</span>" +
        '<span class="pts">' + q.punkte + " Punkte</span></div>" +
        '<div class="qtext">' + math(q.frage) + "</div>";
      if (q.typ === "mc" && q.optionen.length) {
        h += '<ul class="options">';
        q.optionen.forEach(function (o, i) { h += '<li><span class="letter">' + LETTERS[i] + "</span><span>" + math(o) + "</span></li>"; });
        h += "</ul>";
      }
      h += "</div>";
    } else h += '<div class="card"><div class="qtext">—</div></div>';
    h += '<p class="hint">✏️ Antwortet im Team auf Papier. Eure Lehrkraft sagt euch die Runde und Frage an.</p></div>';
    return h;
  }
  function bindSchueler() {
    function nav() {
      var r = +$("#ss_r").value, f = +$("#ss_f").value;
      location.search = "?ansicht=schueler&r=" + r + "&f=" + f;
    }
    var r = $("#ss_r"), f = $("#ss_f");
    if (r) r.onchange = function () { location.search = "?ansicht=schueler&r=" + (+r.value) + "&f=0"; };
    if (f) f.onchange = nav;
  }

  // ---------- Render: Lösungsliste ----------
  function viewLoesungen() {
    var h = '<div class="wrap loes"><div class="ltop no-print">' +
      "<h1>📋 Lösungsliste</h1><div class=\"spacer\"></div>" +
      '<button class="primary" onclick="window.print()">🖨️ Drucken</button>' +
      '<button class="ghost" onclick="location.search=\'\'">← Zurück zur Steuerung</button></div>';
    ROUNDS.forEach(function (r, ri) {
      h += '<div class="ronde">Runde ' + (ri + 1) + "</div>";
      r.forEach(function (q, fi) {
        var b = blockOf(q.block);
        h += '<div class="litem"><div class="meta">' + q.id + " · " + escapeHtml(b.name) + " · " + escapeHtml(b.phase) +
          " · " + q.punkte + " P · " + escapeHtml(TYPLABEL[q.typ] || q.typ) + " · Frage " + (fi + 1) + "</div>" +
          '<div class="lq">' + math(q.frage) + "</div>";
        if (q.typ === "mc" && q.optionen.length) {
          h += '<ol class="lopts" type="A">';
          q.optionen.forEach(function (o, i) { h += '<li class="' + (i === q.loesungIndex ? "ok" : "") + '">' + math(o) + (i === q.loesungIndex ? "  ✓" : "") + "</li>"; });
          h += "</ol>";
        }
        h += '<div class="la"><b>Lösung:</b> ' + math(q.loesung) + "</div></div>";
      });
    });
    return h + "</div>";
  }

  // ---------- Dispatch ----------
  function render() {
    var app = document.getElementById("app");
    if (VIEW === "schueler") { app.innerHTML = viewSchueler(); bindSchueler(); return; }
    if (VIEW === "loesungen") { app.innerHTML = viewLoesungen(); return; }
    // Stand aus Link übernehmen?
    var fromLink = PARAMS.get("stand");
    if (fromLink && !state.setupDone) { try { importCode(fromLink); } catch (e) {} }
    if (!state.setupDone) { app.innerHTML = viewSetup(); bindSetup(); return; }
    app.innerHTML = viewSteuer(); bindSteuer();
  }

  // Tastatur für die Steuerung (Beamer/Laptop)
  document.addEventListener("keydown", function (e) {
    if (VIEW !== "steuer" || !state.setupDone) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === " " || e.key === "Enter") { revealed = !revealed; render(); e.preventDefault(); }
  });

  render();

  // Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
