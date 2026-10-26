# Augenblick für Firefox

Eine Firefox-Erweiterung (SPEC §16). Auf Seiten, die wie ein Artikel aussehen, erscheint unten rechts die große Taste **„Lesen“**. Ein Tipp öffnet die Augenblick-Leseansicht über der Seite. **„◂ Zur Seite“** oder die Zurück-Geste führen zurück, an dieselbe Stelle.

Stand F1 (Auftrag 008): feste Standardwerte (30 px, Schwarz mit warmem Weiß). Einstellungen und Einführung folgen in F2.

- Keine Daten verlassen das Gerät: keine eigenen Netzabrufe, kein Server, kein Tracking.
- Ersatzweg, falls die Taste fehlt: Firefox-Menü (⋮) → Erweiterungen → Augenblick.

## 1. Bauen

Am PC im Repo, mit Node.js 22:

```bash
npm install
npm run build -w extension     # → extension/dist
npm run lint:ext -w extension  # Prüfung durch Mozillas Werkzeug web-ext
```

Das Ergebnis steht in `extension/dist/`. Es ist die fertige Erweiterung, noch ohne Signatur.

## 2. Am PC ausprobieren (Firefox Desktop)

1. Firefox öffnen und `about:debugging#/runtime/this-firefox` eingeben.
2. **„Temporäres Add-on laden …“** wählen und `extension/dist/manifest.json` auswählen.
3. In `about:addons` → Augenblick → **Berechtigungen** den Zugriff auf alle Websites erlauben, falls er aus ist.
4. Eine Nachrichtenseite öffnen, z. B. einen Artikel auf tagesschau.de. Unten rechts erscheint „Lesen“.

Die Erweiterung bleibt bis zum Beenden von Firefox geladen. Schneller geht es mit `npm run start -w extension`: Das startet einen frischen Firefox mit der Erweiterung und lädt sie bei jeder Änderung an `dist/` neu.

## 3. Entwickeln am Tablet per USB

So läuft die Erweiterung am Tablet, ohne Signatur. Sie verschwindet beim Beenden wieder.

1. **Tablet – Entwickleroptionen:**
   - Einstellungen → Telefoninfo → Softwareinformationen → **7× auf „Buildnummer“** tippen.
   - Danach Einstellungen → Entwickleroptionen → **USB-Debugging** einschalten.
2. **Tablet – Firefox:** Firefox für Android aus dem Play Store installieren. Dann Firefox → Einstellungen → **„Remote-Debugging über USB“** einschalten.
3. **PC – adb:**
   - Die Android Platform-Tools installieren:
     - Linux: `sudo apt install adb`
     - Windows/macOS: „SDK Platform-Tools“ von developer.android.com.
   - Das Tablet per USB anschließen und `adb devices` aufrufen.
   - Am Tablet „USB-Debugging zulassen“ bestätigen. Danach steht in der Liste eine Gerätenummer mit „device“.
4. **Starten:**

   ```bash
   npx web-ext run --source-dir extension/dist --target=firefox-android \
     --android-device=<Gerätenummer> --firefox-apk=org.mozilla.firefox
   ```

   Firefox startet am Tablet mit der Erweiterung. Änderungen an `dist/` werden neu geladen.

## 4. Dauerhaft installieren (unlisted signiert)

Firefox für Android installiert nur Erweiterungen mit Signatur von Mozilla. „Unlisted“ heißt: Mozilla signiert sie, aber sie erscheint nicht im öffentlichen Katalog.

1. **Konto und Schlüssel (einmalig):**
   - Auf <https://addons.mozilla.org> anmelden (Firefox-Konto).
   - Unter **Developer Hub → Tools → Manage API Keys** einen Schlüssel erzeugen. Man bekommt einen „JWT issuer“ und ein „JWT secret“.
   - Beide gehören **nur auf den eigenen Rechner** oder als GitHub-Secrets (`AMO_API_KEY`, `AMO_API_SECRET`) ins Repo-Konto. Nie in eine Datei im Repo.
2. **Version erhöhen:** Jede signierte Fassung braucht eine neue Nummer. Dazu `version` in `extension/package.json` erhöhen, z. B. auf `0.1.1`, dann neu bauen.
3. **Signieren** (dauert ein paar Minuten):

   ```bash
   export WEB_EXT_API_KEY='<JWT issuer>'
   export WEB_EXT_API_SECRET='<JWT secret>'
   npx web-ext sign --source-dir extension/dist --channel=unlisted \
     --artifacts-dir extension/web-ext-artifacts
   ```

   Unter Windows (PowerShell): `$env:WEB_EXT_API_KEY='…'` und `$env:WEB_EXT_API_SECRET='…'`.

   Das Ergebnis ist eine Datei `extension/web-ext-artifacts/augenblick_….xpi`.
4. **Aufs Tablet bringen:** die `.xpi`-Datei per USB in den Ordner „Download“ kopieren, oder sich selbst per E-Mail schicken und am Tablet speichern.
5. **Am Tablet installieren:**
   - Firefox → Einstellungen → **Über Firefox** → **5× auf das Firefox-Logo** tippen. Dann erscheint „Debug-Menü aktiviert“.
   - Zurück in die Einstellungen. Dort steht jetzt **„Erweiterung aus Datei installieren“**.
   - Die `.xpi`-Datei auswählen und „Hinzufügen“ tippen.
6. **Berechtigung prüfen:** Firefox → Einstellungen → Erweiterungen → Augenblick → Berechtigungen. Der Zugriff auf alle Websites muss erlaubt sein, sonst erscheint keine Taste.
7. **Neue Fassung:** Schritte 2–5 wiederholen. Unlisted signierte Erweiterungen aktualisieren sich nicht von selbst; das kommt mit der Veröffentlichung auf addons.mozilla.org (F4).

## 5. Für die Nutzerin einrichten

- Ein Firefox-Symbol auf den Startbildschirm legen und ihre Seiten als Lesezeichen oder Verknüpfungen anlegen, z. B. nn.de, br24.de und tagesschau.de.
- Bei Abo-Seiten einmal in Firefox anmelden. Die Erweiterung liest nur, was die Seite ohnehin zeigt.

## 6. Was am Gerät zu prüfen ist

- Erscheint die Taste auf ihren Seiten, und nur dort? Ist sie gut zu treffen, und stört sie nicht?
- Ist der Text vollständig und sauber, ohne Werbung, Bildunterschriften und Linklisten? Sind die Bilder da?
- Führen die Zurück-Geste und „Zur Seite“ an dieselbe Stelle zurück?
- Bleibt der Bildschirm beim Lesen an?

Beobachtungen bitte unter „Offene Fragen“ in `docs/auftraege/008-firefox-erweiterung-f1.md` eintragen.

## Aufbau

| Datei | Aufgabe |
|---|---|
| `src/content.ts` | Inhaltsskript: prüft die Seite (auch nach Nachladen), zeigt die Taste, öffnet die Leseansicht |
| `src/button.ts` | Taste „Lesen“ im geschlossenen Shadow DOM |
| `src/extract.ts` | Readability auf einer Kopie, gemeinsame Bereinigung (`@augenblick/shared/text`), Bilder der Seite |
| `src/overlay.ts` | Vollbild-iframe, Nachrichten, Verlaufseintrag für die Zurück-Geste |
| `src/reader.ts`, `src/reader.html` | Leseansicht mit dem gemeinsamen Lese-Baustein (`@augenblick/web/reader`) |
| `src/background.ts` | Ersatzweg über das Firefox-Menü |
| `build.mjs` | Build und Manifest |
| `test/` | Testseiten (selbst geschrieben) und Unit-Tests |
| `e2e/` | Playwright-Tests mit Testserver (ADR 024) |

Entscheidungen: ADR 022 (Richtungswechsel), ADR 023 (gemeinsame Bausteine), ADR 024 (Technik F1).
