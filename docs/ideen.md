# Ideen für später

> Sammlung möglicher Erweiterungen. **Nichts davon ist beauftragt.** Coding-Agenten bauen hieraus nur, wenn ein Auftrag in `docs/auftraege/` es ausdrücklich verlangt.

## Leitgedanke: von Sehen zu Hören und Sprechen

Makuladegeneration schreitet fort. Was heute noch mit großer Schrift geht, wird später nur noch per Stimme gehen. Jede Erweiterung soll deshalb

- **per Sprache bedienbar** sein, der Bildschirm ist Ergänzung,
- **für sich allein nützlich** sein (keine große Plattform vorab),
- den **Pi im Heimnetz** als Zentrum nutzen,
- im **Augenblick-Stil** erscheinen: groß, ruhig, wenige Tasten, nur Einzeltipps.

Reihenfolge: erst muss die Zeitung angenommen werden. Danach jeweils fragen „Wobei ärgert sich die Nutzerin im Alltag am meisten?" statt „Was soll das Tablet können?".

## 1. Digitaler Prospekt mit Einkaufsliste

**Heute:** Die Nutzerin schneidet aus Papierprospekten der Discounter aus, was sie möchte, und gibt dem Betreuer einen Stapel Schnipsel.

**Idee:** Die Wochenangebote der Märkte vor Ort als große Karten („Mini-Pflaumentomaten · 1,29 €"). Ein Tipp legt das Angebot auf die Einkaufsliste, der Betreuer sieht die Liste unterwegs auf dem Handy und hakt ab.

- Quellen: Online-Prospekte der Märkte bzw. Prospekt-Portale. Nutzungsbedingungen vorab prüfen.
- Prospekte sind meist Bilder/PDF. Umwandlung in Angebotskarten per KI mit Bildverständnis (über OpenRouter) auf dem Pi; Ergebnis pro Woche einmal erzeugen und speichern.
- Zusätzlich freie Einträge per Sprache („Setz Milch auf die Einkaufsliste").
- Rückmeldung an die Nutzerin ohne Lesen: abgehakte Einträge verschwinden bzw. werden angesagt.
- Übergangslösung ohne Code: geteilte Google-Keep-Liste, befüllt über den Sprachassistenten.
- Setzt Fernzugriff auf den Pi voraus (Tailscale), damit der Betreuer die Liste unterwegs sieht.

## 2. Messaging (WhatsApp)

- Familie und Freunde nutzen WhatsApp; ein eigener Messenger würde isolieren.
- WhatsApp hat für private Konten **keine offizielle Schnittstelle**. Inoffizielle Bibliotheken riskieren die Sperrung des Kontos → **nicht bauen**.
- Weg: Sprachassistent von Android (Nachrichten vorlesen lassen, per Sprache senden, Anrufe). Kein Code; Einrichtung, Übung und ein Großdruck-Spickzettel mit den wichtigsten Sätzen.
- Audio über die Hörgeräte (siehe SPEC §8.5).

## 3. Smart Home mit Home Assistant

- Home Assistant auf demselben Pi, lokale Sprachsteuerung.
- Kandidaten: Licht und Heizung per Stimme, Türklingel mit Ansage, Hinweis bei offenem Fenster.
- Bedienseite als Augenblick-Kacheln im gleichen Stil wie die Zeitung.
- **Kein Notruf im Eigenbau.** Dafür einen zertifizierten Hausnotruf-Dienst nutzen.

## 4. Startseite mit Kacheln

Erst wenn mehrere Bausteine laufen: Augenblick öffnet mit höchstens vier großen Kacheln (z. B. Zeitung, Einkauf, Licht, Familie). Gleiche Regeln wie in SPEC §8.1 (≤ 6 Tippziele, nur Einzeltipps, Symbol + Wort).

## 5. Regionalzeitung mit Verlags-Branding

Siehe SPEC §5.1 (Phase 2) und §12a. Anfrage an den Verlag erst, wenn der Prototyp mit öffentlichen Quellen überzeugt.

## 6. Kleinere Ideen aus der Umsetzung

Während der Arbeit an M0–M3 notiert, bewusst nicht gebaut:

- **Zweite Tagesausgabe am Nachmittag** statt einer festen Ausgabe pro Tag (ADR 003) – nur, wenn der Test mit der Nutzerin das nahelegt.
- **Leiser Klick als Tipp-Feedback** (SPEC §8.1, optional) – erst nach Rückmeldung zum visuellen Feedback.
- **tagesschau in Einfacher Sprache** als eigene Rubrik oder als Stilvorbild für die Kurzfassungen (SPEC §5.1, [R30]) – Zugangsweg klären.
- **Branding-Ordner** `/branding/<name>/` (SPEC §12a): Der Name „Augenblick“ kommt schon aus der Locale; Logo und Akzentfarbe folgen, wenn ein Partner es braucht.
