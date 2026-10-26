# 022 – Richtungswechsel: Augenblick als Firefox-Erweiterung

**Status:** angenommen · **Datum:** 26.10.2026 · **Bezug:** SPEC §1, §2, §16

## Kontext

Nach den ersten Tagen mit der Augenblick-Zeitung (Übersicht aus tagesschau und BR24 über den Pi) hat der Betreuer mit der Nutzerin gesprochen. Was sie eigentlich möchte: Sie ist im Browser auf einer Seite, löst etwas aus, und es geht ein Lesefenster auf, in dem der Inhalt lesefreundlich dargestellt wird – „eine Art Chrome-Plugin“.

Geprüfte Wege (26.10.2026):

- **Chrome für Android** kann keine Erweiterungen. Sein eingebauter Lesemodus (überarbeitet 2026: Schrift bis 250 %, Lexend, dunkler Hintergrund) ist ein brauchbarer Notbehelf, aber nicht anpassbar an die Regeln dieses Projekts.
- **„Teilen → Augenblick“** über eine installierte Web-App (Web Share Target) und den Pi: möglich, aber mehrere Tipps und abhängig vom Pi.
- **Firefox für Android** unterstützt Erweiterungen. Erweiterungen haben dort keine eigene Taste in der Leiste (nur im Menü), können aber auf der Seite eine eigene Taste einblenden.
- **Eigene, schlichte Browser-App** (Android-App mit der System-WebView): größte Kontrolle, aber größerer Aufwand und eigene Wartung.

## Entscheidung

- **Begonnen wird mit einer Firefox-Erweiterung** (SPEC §16). Der Betreuer hält es für möglich, später zusätzlich die eigene Browser-App zu bauen (`docs/ideen.md`).
- Auslöser ist eine **eingeblendete Taste „Lesen“** auf lesbaren Seiten; das Firefox-Menü bleibt als Ersatzweg.
- Den Text gewinnt die Erweiterung **in der Seite** mit Readability. Kein Server, keine eigenen Netzabrufe. Dadurch funktionieren auch Seiten hinter dem Abo-Login der Nutzerin, ohne dass Zugangsdaten irgendwo hinterlegt werden.
- Leseansicht, Einstellungen, Einführung, Bereinigung und Satztrennung werden mit der bestehenden Web-App **geteilt**, nicht kopiert.
- **Der Pi-Teil bleibt in Betrieb**, wie er ist. Neue Funktionen dort nur nach Absprache; Fehler werden weiter behoben.
- Veröffentlichung auf addons.mozilla.org (automatische Updates); bis dahin unlisted signiert und von Hand installiert.

## Folgen

- Die Nutzerin wechselt für das Lesen von Chrome zu Firefox. Die Einführung muss das berücksichtigen (Firefox-Symbol auf dem Startbildschirm, Lesezeichen für ihre Seiten); das richtet der Betreuer ein.
- Die Darstellung hängt davon ab, wie gut Readability die jeweilige Seite erkennt. Am Gerät mit ihren tatsächlich genutzten Seiten prüfen.
- Die Abo-Frage zur Regionalzeitung (SPEC §15, Punkt 1) entschärft sich: Die Erweiterung zeigt nur, was die Nutzerin auf der Seite ohnehin sehen darf, und gibt nichts weiter.
- Für die Veröffentlichung braucht der Betreuer ein Konto bei addons.mozilla.org und hinterlegt die Schlüssel als GitHub-Secrets.
