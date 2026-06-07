# Mathe Quiz-Turnier · Klasse 6

Ein statisches, offline-fähiges Quiz-Turnier zum Schuljahresende. Läuft auf **einem** Steuer-Gerät
(Handy oder Beamer-PC); die SuS lesen optional auf ihren Handys mit und antworten im Team auf Papier.
Kein Server, keine Anmeldung, keine Schülerdaten.

## Inhalte
111 geprüfte Fragen aus den Klassenarbeiten der Klasse 6, in drei Blöcken – Punkte nach Aktualität:

| Block | Phase | Punkte/Frage |
|-------|-------|:---:|
| 🟦 Brüche / Gebrochene Zahlen | Anfang | 30 |
| 🟩 Proportionalität / Dreisatz | Mitte | 20 |
| 🟧 Winkel & Dreiecke | Ende | 10 |

Fragetypen: Multiple Choice · offene Aufgaben · „Erkläre einem Mitschüler". Die Fragen sind
automatisch in **Runden à 6 Fragen** (≈ 15–20 Min) gemischt – jede Runde deckt alle drei Blöcke
und mehrere Fragetypen ab. Ihr nutzt pro Stunde so viele Runden, wie ihr wollt (großer Fundus + Reserve).

## Bedienung (Steuer-Ansicht)
- **◀ Zurück / Weiter ▶** oder Pfeiltasten ← → blättern durch die Fragen.
- **Lösung zeigen** (oder Leertaste) blendet die Lösung ein; bei MC wird die richtige Option grün.
- **+ Punkte** beim Team vergibt die Punktzahl der aktuellen Frage; **+5 / −5** für Feinkorrekturen; **↶ Rückgängig** nimmt die letzte Vergabe zurück.
- **Springe:** per Dropdown direkt zu einer Runde / Frage.
- **💾 Sichern** erzeugt einen Code (oder Link) zum Mitnehmen auf ein anderes Gerät.
- **📂 Laden** stellt einen gesicherten Stand wieder her.
- Der Stand wird zusätzlich **automatisch im Browser** gespeichert (localStorage).

### Andere Ansichten
- **📱 Schüler-Ansicht** (`?ansicht=schueler`): nur Frage + Antwortoptionen, **keine** Lösung, **keine** Punkte. Die SuS wählen Runde/Frage, die ihr ansagt.
- **📋 Lösungsliste** (`?ansicht=loesungen`): alle Fragen mit Lösungen, druckbar (🖨️) als Backup für die Lehrkraft.

## Auf GitHub Pages veröffentlichen
1. Den Ordner `quiz-turnier/` in ein GitHub-Repository legen (oder als Repo-Wurzel).
2. Repo → **Settings → Pages** → Source: Branch `main`, Ordner `/ (root)` bzw. `/quiz-turnier`.
3. Nach ein paar Minuten ist die Seite unter `https://<name>.github.io/<repo>/` erreichbar.
4. Einmal **mit Internet** öffnen / „Zum Startbildschirm hinzufügen" → danach läuft alles **offline** (PWA).

## Fragen anpassen
Alle Fragen stehen in **`data.js`** (`window.QUIZ.fragen`). Format pro Frage:
```js
{ id, block, phase, punkte, typ:"mc|offen|erklaeren",
  frage, optionen:[…], loesungIndex, loesung, quelle, niveau }
```
Mathe im Text: Brüche als `\frac{Zähler}{Nenner}`, der Rest als normale Zeichen (`·`, `:`, `°`, `α β γ`, `<`, `>`, `=`).
Nach inhaltlichen Änderungen die Cache-Version in **`sw.js`** erhöhen (`quiz-turnier-v1` → `-v2`), damit Geräte die neuen Fragen laden.

## Dateien
| Datei | Zweck |
|-------|-------|
| `index.html` | Einstieg |
| `app.js` | Steuerung, Schüler-Ansicht, Lösungsliste, Speichern/Laden |
| `data.js` | die 111 Fragen + Blöcke |
| `styles.css` | Gestaltung (inkl. Bruch-Darstellung) |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA / Offline |
