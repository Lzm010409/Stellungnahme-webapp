# Kürzungsabwehr-Werkbank

Webapp für das Kfz-Sachverständigenbüro Gollenstede: Stellungnahmen gegen
Kürzungsschreiben und Prüfberichte von Kfz-Versicherern, mit KI-gestützter
Pflege der Argumentbibliothek und Import von Falldaten aus autoiXpert.

Überführt die beiden Skills `stellungnahme-erstellen` und
`argumentbibliothek-erweitern` (unter [`skills/`](skills/)) in eine Anwendung.

**Läuft unter https://werkbank.gollenstede.app**

## Stand

| Phase | Inhalt | Status |
| --- | --- | --- |
| P0 | Gerüst, Datenbankschema, Anmeldung mit Rollen, Deployment | **fertig** |
| P1 | Argumentbibliothek: Migration, Suche, Detailansicht, Freigabe | **fertig** |
| P2 | autoiXpert-Anbindung: Fall über Aktenzeichen oder ID | **fertig** |
| P3 | Prüfbericht einlesen, Positionen auslesen, Auswahlmaske | **fertig** |
| P4 | Ausformulieren, vier Wächter, Word- und Klartext-Ausgabe | **fertig** |
| P5 | Wirkungsstatistik, Prüfdienstleister-Bausteine | offen |

## Dokumente

- [Konzept](docs/konzept.html) — Entscheidungen E1–E6, Risiken R1–R4,
  Features F1–F9, Phasenplan P0–P5
- [Betrieb](docs/betrieb.md) — Coolify, Microsoft Entra, Einrichtung

## Schnellstart

```bash
pnpm install
cp .env.example .env.local          # DATABASE_URL eintragen
pnpm db:push                        # Schema anlegen
pnpm bibliothek:import              # 68 Einträge übernehmen
pnpm benutzer:anlegen --email du@example.org --name "Du" \
                      --rolle admin --passwort geheim
pnpm dev
```

## Befehle

| Befehl | Wirkung |
| --- | --- |
| `pnpm dev` | Entwicklungsserver |
| `pnpm check` | Typprüfung und Tests |
| `pnpm bibliothek:import --bericht` | Abgleichbericht, ohne zu schreiben |
| `pnpm bibliothek:import` | Referenzdateien in die Datenbank |
| `pnpm bibliothek:export` | Datenbank zurück nach Markdown |
| `pnpm benutzer:anlegen` | Zugang anlegen oder ändern |

## Aufbau

```
skills/                      Die Skills — versionierte fachliche Grundlage
src/bibliothek/
  parser.ts                  Markdown → strukturierte Einträge
  markdown-export.ts         Einträge → Markdown (der Rückweg)
  migration.ts               Abgleichbericht
  abfragen.ts                Suche und Detailabruf
  aktionen.ts                Freigabe, Beleg-Prüfung, Speichern
src/autoixpert/
  client.ts                  Zugriff auf die externe Schnittstelle
  felder.ts                  Falldaten → Platzhalter und Empfängervorschlag
src/pruefbericht/
  einlesen.ts                PDF → Seiten, je Seite Text oder Bild
  extraktion.ts              Kürzungspositionen auslesen
  sonderfaelle.ts            Prüfliste B.1-B.8
src/stellungnahme/
  treffer.ts                 Positionen → Bibliothekseinträge
  komposition.ts             Ausformulieren im Hausstil
src/export/
  waechter.ts                Die vier Prüfungen vor dem Export
  hausstil.ts                Aufbau des Schreibens
  docx.ts                    Word-Ausgabe über die Geschäftspapier-Vorlage
src/auth/                    Sitzungen, Passwort, Microsoft Entra
src/db/schema.ts             Datenmodell
scripts/starten.mjs          Migration, Startbefüllung, Serverstart
```

## Zwei Grundregeln, die im Code verankert sind

**Die Bibliothek bleibt in beide Richtungen lesbar.** Markdown → Datenbank →
Markdown ist verlustfrei und durch Tests abgesichert. Solange der Rückexport
läuft, funktionieren die bestehenden Skills im Chat unverändert weiter — die
Webapp ist keine Einbahnstraße.

**Vier Wächter vor jeder Ausgabe.** Offene Platzhalter und interne
Feldnotizen **sperren** den Export; Zahlen ohne Beleg im Fall und
Formulierungen an der RDG-Grenze **warnen**. Alle vier sind deterministisch
— eine Sperre, die selbst raten muss, ist keine Sperre.

**Freigeben ist Menschensache.** Der Status `freigegeben` wird ausschließlich
über die Oberfläche gesetzt und verlangt die Rolle `freigeber`. Kein
KI-Aufruf erreicht diesen Weg. Unbestätigte Fundstellen sperren die Freigabe;
interne Hinweise sind im Datenmodell vom Exportpfad getrennt und können
deshalb auch durch einen Modellfehler nicht in ein versandtes Schreiben
geraten.
