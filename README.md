# Stellungnahme-Webapp

Webapp für das Kfz-Sachverständigenbüro Gollenstede: Erstellung von Stellungnahmen
gegen Kürzungsschreiben und Prüfberichte von Kfz-Versicherern, mit KI-gestützter
Pflege der zugehörigen Argumentbibliothek und Import von Falldaten aus autoiXpert.

## Status

Konzeptphase. Es existiert noch kein Anwendungscode.

## Konzept

Das vollständige Umsetzungskonzept liegt unter [`docs/konzept.html`](docs/konzept.html)
und behandelt:

- **E1** Übersetzungsstrategie der beiden Skills (`stellungnahme-erstellen`,
  `argumentbibliothek-erweitern`) in eine Webapp
- **E2** Technischer Stack
- **E3** Betrieb und Datenhaltung
- **E4** Datenmodell der Argumentbibliothek
- **E5** Freigabe-Regel für KI-erzeugte Argumente
- **R1–R3** Risiken: erfundene Fundstellen, RDG-Grenze, Falldaten im Modell
- **F1–F8** Feature-Vorschläge mit Priorisierung
- **P0–P5** Phasenplan

## Offene Voraussetzung

Die beiden Skills des Plugins `kuerzung-stellungnahme` werden unter `skills/`
im Repository benötigt. Sie werden zur versionierten Grundlage von
`packages/playbook/` — der Wahrheit über Tonfall, Aufbau und Prüfregeln.
