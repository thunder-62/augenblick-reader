# 019 – Release bei jedem Merge nach main

**Status:** angenommen · **Datum:** 25.10.2026 · **Bezug:** SPEC §9, ADR 012; ersetzt die Absprache „kein Release ohne Tag des Betreuers“

## Kontext

Bisher entstand ein Release nur, wenn der Betreuer ein Tag `v…` setzte. Ohne Release musste der Pi selbst bauen (`install.sh --from-source`). Auf dem vorhandenen Pi 4 (32 bit, 2 GB, Docker daneben) dauert das 10–15 Minuten. Der Betreuer wünscht ein automatisches Deployment.

## Entscheidung

- `.github/workflows/release.yml` läuft bei jedem Push nach `main`, also bei jedem Merge. Ablauf:
  1. Lint und Tests;
  2. bauen;
  3. Paket mit Prüfsumme als GitHub-Release `v<major>.<minor>.<n>` veröffentlichen. Major und Minor kommen aus `package.json`, `n` ist die fortlaufende Nummer des Workflows.
- Reine Doku-Änderungen (`docs/**`, `*.md`) lösen kein Release aus.
- Ein Tag `v…` von Hand und ein manueller Start („Run workflow“) gehen weiterhin.
- Der Pi holt das neueste Release wie bisher nachts um 03:00 (`augenblick-update`). Er prüft die Prüfsumme und den Healthcheck und fällt bei einem Fehler auf die vorige Version zurück. Eine Version, die einmal fehlschlug, versucht er nicht erneut.
- **Freigabe ist das Mergen nach `main`.** Wer etwas nicht ausliefern will, merged es nicht.

## Folgen

- Auf dem Pi wird nicht mehr gebaut, nur noch `npm ci --omit=dev` ausgeführt; der Klon wird nur für `install.sh` gebraucht.
- Zwischen Merge und Pi vergehen bis zu einem Tag; sofort geht es mit `sudo augenblick-update`.
- Die Workflow-Berechtigung „Read and write“ für `GITHUB_TOKEN` muss im Repo erlaubt sein (`permissions: contents: write` im Workflow). Ist sie in den Repo-Einstellungen gesperrt, scheitert der Schritt „GitHub-Release“.
