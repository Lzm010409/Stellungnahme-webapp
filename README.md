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
| P3 | Prüfbericht einlesen, Positionen auslesen, Argumentauswahl | **fertig** |
| P4 | Ausformulieren, vier Wächter, Word- und Klartext-Ausgabe | **fertig** |
| P4b | Der Schreibtisch: Brief-Editor mit Anmerkungen am Rand | **fertig** |
| P4c | Ziehen und Fallenlassen, Fortschritt, Erscheinungsbild | **fertig** |
| P4d | Oberfläche nach der Vorlage „Judia" | **fertig** |
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
src/dokument/
  typen.ts                   Der Dokumentbaum als reines JSON
  ziehen.ts                  Was beim Ziehen eines Bausteins mitwandert
  erzeugen.ts                Kopfdaten und Positionen → Schreiben
  nach-absaetzen.ts          Dokumentbaum → Absatzfolge der Ausgabe
  spur.ts                    Herkunft des Textes, aus dem Baum gelesen
  pruefung.ts                Dokumentbaum → Eingabe der vier Wächter
  editor-schema.ts           Die Editor-Erweiterungen (nur im Browser)
  editor-hilfen.ts           Griffe in den laufenden Editor
src/export/
  waechter.ts                Die vier Prüfungen vor dem Export
  hausstil.ts                Aufbau des Schreibens
  docx.ts                    Word-Ausgabe über die Geschäftspapier-Vorlage
src/app/api/strom.ts         Ereignisstrom als Antwort (NDJSON)
src/app/teile/               Kreisel, Fortschrittsbalken, Erscheinungsschalter
src/auth/                    Sitzungen, Passwort, Microsoft Entra
src/db/schema.ts             Datenmodell
scripts/starten.mjs          Migration, Startbefüllung, Serverstart
```

## Der Schreibtisch

Geschrieben wird **im Brief**, nicht in einem Formular. Das Schreiben steht
als Dokumentbaum in der Datenbank und wird in einem Editor bearbeitet, der
nur kann, was die Word-Ausgabe versteht. Am rechten Rand steht je Position
eine Anmerkung — die vorgeschlagenen Treffer, die gesamte Bibliothek und
eigener Text —, aufgeklappt die, in der die Schreibmarke gerade steht. Ein
gewählter Baustein wird in der Blase bearbeitet und dann eingefügt; danach
ist er gewöhnlicher Fliesstext.

Die Nummerierung der Abschnitte entsteht aus ihrer Reihenfolge, nicht aus
dem Text: eine nicht bestrittene Position bleibt ausgegraut stehen, zählt
aber nicht mit, und die übrigen Nummern rücken nach.

Bausteine lassen sich **anklicken oder ziehen**. Wer zieht, sieht solange
die Abschnitte des Briefes umrandet; fallen gelassen wird hinter dem Absatz
unter dem Zeiger, nie mitten in einen Satz. Der Knopf bleibt gleichwertig —
Ziehen ist die Abkürzung, nicht der Weg.

## Warten mit Auskunft

Die beiden langen Vorgänge — Prüfbericht auswerten und Dokument erzeugen —
laufen als **Ereignisstrom** und melden, woran sie gerade arbeiten: Seite
für Seite beim Einlesen, dann Auslesen, Prüfliste, Anlegen. Der Balken zeigt
den Stand, darunter stehen die erledigten Schritte. Kurze Wege bekommen
einen Kreisel, keinen Balken.

Das Erscheinungsbild lässt sich in der Kopfleiste umschalten: hell, dunkel
oder wie das System. Die Wahl bleibt im Browser und wird vor dem ersten
Zeichnen gesetzt, damit nichts aufblitzt.

## Aussehen

Farben, Masse und Formen folgen der Vorlage „Judia" (Bootstrap 5.3): Blau
als einzige Signalfarbe, kühle Blaugrautöne für Text, helle Flächen mit
dünnen Rändern statt Schatten. Links eine schmale dunkle Schiene, daneben
das einklappbare Menü, darüber die Kopfleiste.

Eine Ausnahme ist Absicht: der Brief wird in einer Serifenschrift gesetzt.
Er soll wie ein Schreiben aussehen, nicht wie eine Bildschirmmaske.

## Zwei Grundregeln, die im Code verankert sind

**Die Bibliothek bleibt in beide Richtungen lesbar.** Markdown → Datenbank →
Markdown ist verlustfrei und durch Tests abgesichert. Solange der Rückexport
läuft, funktionieren die bestehenden Skills im Chat unverändert weiter — die
Webapp ist keine Einbahnstraße.

**Vier Wächter, laufend statt am Ende.** Offene Platzhalter und interne
Feldnotizen **sperren** den Export; Zahlen ohne Beleg im Fall und
Formulierungen an der RDG-Grenze **warnen**. Sie laufen bei jedem
gespeicherten Stand und erscheinen als Anmerkung am Rand, mit Sprung an die
beanstandete Stelle. Alle vier sind deterministisch — eine Sperre, die
selbst raten muss, ist keine Sperre.

**Die Herkunft klebt am Text.** Eingefügter Bibliothekstext trägt eine
Auszeichnung, die das Umformulieren überlebt. Nur deshalb bleibt
nachvollziehbar, welcher Eintrag in welchem Fall gewirkt hat — eine
Tabellenzeile hätte das erste freie Überschreiben nicht überstanden.

**Freigeben ist Menschensache.** Der Status `freigegeben` wird ausschließlich
über die Oberfläche gesetzt und verlangt die Rolle `freigeber`. Kein
KI-Aufruf erreicht diesen Weg. Unbestätigte Fundstellen sperren die Freigabe;
interne Hinweise sind im Datenmodell vom Exportpfad getrennt und können
deshalb auch durch einen Modellfehler nicht in ein versandtes Schreiben
geraten.
