# Stellungnahme-Webapp

Webapp für das Kfz-Sachverständigenbüro Gollenstede: Erstellung von Stellungnahmen
gegen Kürzungsschreiben und Prüfberichte von Kfz-Versicherern, mit KI-gestützter
Pflege der Argumentbibliothek und Import von Falldaten aus autoiXpert.

## Status

Konzeptphase, Fassung 2 (gegen die Skill-Dateien geprüft). Noch kein Anwendungscode.

## Konzept

Das vollständige Umsetzungskonzept liegt unter [`docs/konzept.html`](docs/konzept.html):

| Kennung | Entscheidung |
| --- | --- |
| E1 | Übersetzungsstrategie der Skills — Ablauf als Code, Fachwissen als Playbook |
| E2 | Technischer Stack |
| E3 | Betrieb als Coolify-Application *(entschieden)* |
| E4 | Datenmodell und Migration der Argumentbibliothek |
| E5 | Freigabe-Regel für KI-erzeugte Einträge |
| E6 | Auswahlmaske als Leitinteraktion, Drag & Drop als Ergänzung |

Dazu: Risiken R1–R4, Feature-Vorschläge F1–F8, Phasenplan P0–P5.

## Offene Punkte

- **Netzfreigabe `app.autoixpert.de`** in der Claude-Code-Umgebung — blockiert Phase P2.
- **Testmaterial**: Aktenzeichen, Prüfberichte (Scan und Text), versandte Stellungnahmen.

## Hinweis zur Sichtbarkeit

Dieses Repository ist derzeit **öffentlich**. Die Argumentbibliothek des Büros,
der Hausstil und die Geschäftspapier-Vorlage gehören nicht in ein öffentliches
Repository. Vor dem Einchecken der Skills unter `skills/` ist die Sichtbarkeit
auf *privat* umzustellen.
