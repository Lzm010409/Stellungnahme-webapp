# Betrieb auf Coolify

**Die Anwendung läuft:** https://werkbank.gollenstede.app

| | |
| --- | --- |
| Coolify-Projekt | Kuerzungsabwehr-Werkbank |
| Anwendung | `werkbank` (`g7oinc0aszdlwsaz7n6tae2u`) |
| Datenbank | `werkbank-postgres` (`thsbzqyeov34rei7pexf17bu`) |
| Branch | `claude/stellungnahme-webapp-konzept-kyhxer` |
| Build | Dockerfile, Port 3000, Healthcheck `/api/gesundheit` |

## Der Startvorgang richtet sich selbst ein

Bei jedem Start läuft `starten.mjs`, bevor der Server hochkommt:

1. **Migrationen anwenden** — versionierte SQL-Dateien aus `drizzle/`, mit
   Buchführung in `__migrationen`. Bereits angewandte werden übersprungen.
2. **Bibliothek befüllen**, falls sie leer ist — die Startbefüllung entsteht
   beim Bauen des Abbilds. Eine gefüllte Bibliothek bleibt unangetastet.
3. **Ersten Zugang anlegen**, falls `ERSTER_ADMIN_EMAIL` gesetzt ist und noch
   überhaupt kein Benutzer existiert.

Ein Neustart oder ein neues Deployment ist damit gefahrlos: nichts wird
doppelt angelegt, nichts überschrieben.

## Umgebungsvariablen

| Variable | Pflicht | Bedeutung |
| --- | --- | --- |
| `DATABASE_URL` | ja | Verbindungs-URL der Postgres-Ressource |
| `APP_BASIS_URL` | ja | Öffentliche Adresse, z.B. `https://werkbank.gollenstede.app` |
| `ANTHROPIC_API_KEY` | **fehlt noch** | Ohne diesen Wert lassen sich Prüfberichte nicht auswerten und Positionen nicht ausformulieren. Alles Übrige — Bibliothek, Fallimport, Auswahlmaske, Wächter, Ausgabe — läuft ohne ihn. |
| `AUTOIXPERT_API_TOKEN` | für P2 | Bearer-Token der externen Schnittstelle |
| `ENTRA_TENANT_ID` | für Microsoft-Anmeldung | Verzeichnis-ID des Tenants |
| `ENTRA_CLIENT_ID` | für Microsoft-Anmeldung | Anwendungs-ID der App-Registrierung |
| `ENTRA_CLIENT_SECRET` | für Microsoft-Anmeldung | Geheimnis der App-Registrierung |
| `ENTRA_AUTO_ANLEGEN` | nein | `true` legt unbekannte Tenant-Konten selbst an. Standard ist `false`: dann kann sich nur anmelden, wer vorher eingetragen wurde. |
| `ERSTER_ADMIN_EMAIL` | einmalig | Legt beim allerersten Start einen Admin-Zugang an |
| `ERSTER_ADMIN_NAME` | nein | Anzeigename dazu |
| `ERSTER_ADMIN_PASSWORT` | nein | Ohne diesen Wert ist der Zugang nur über Entra nutzbar |

Fehlt eine der drei `ENTRA_*`-Variablen, blendet die Anmeldemaske den
Microsoft-Knopf einfach aus und bietet nur die Passwortanmeldung an.

## App-Registrierung in Microsoft Entra

Im Azure-Portal unter **Microsoft Entra ID → App-Registrierungen → Neue
Registrierung**:

- Unterstützte Kontotypen: **nur eigenes Verzeichnis** (Single Tenant)
- Umleitungs-URI, Typ **Web**:
  `https://<APP_BASIS_URL>/api/auth/entra/callback`
- Unter **Zertifikate & Geheimnisse** ein Client-Geheimnis erzeugen
- Unter **API-Berechtigungen** genügen die Standardrechte
  `openid`, `profile`, `email` — es werden keine Graph-Daten gelesen

Mehr braucht die Anwendung nicht: sie liest aus dem ID-Token nur
Objekt-ID, Mailadresse und Anzeigename.

## Weitere Zugänge anlegen

Die Coolify-API bietet keinen Endpunkt, um Befehle im laufenden Container
auszuführen — deshalb die Einrichtung über den Startvorgang. Weitere
Benutzer legst Du über das Container-Terminal in der Coolify-Oberfläche an:

```bash
pnpm benutzer:anlegen --email vorname@gollenstede-sachverstand.de \
                      --name "Vorname Nachname" --rolle ersteller
```

Ohne `--passwort` entsteht ein Zugang, der sich ausschliesslich über
Microsoft Entra nutzen lässt — der vorgesehene Normalfall.

## Bibliothek zurück nach Markdown

Damit die Skills im Chat mit dem aktuellen Stand arbeiten:

```bash
pnpm bibliothek:export
```

## Rollen

| Rolle | Darf |
| --- | --- |
| `ersteller` | Einträge anlegen und ändern, Fundstellen bestätigen |
| `freigeber` | zusätzlich Einträge freigeben |
| `admin` | wie Freigeber, plus Benutzerverwaltung |

Der Statuswechsel auf `freigegeben` ist ausschließlich über die Oberfläche
möglich und verlangt die Rolle `freigeber` oder `admin`. Kein KI-Aufruf
erreicht diesen Weg — das ist Entscheidung E5 aus dem Konzept, und sie ist
im Code verankert, nicht nur beschrieben.

## Lokale Entwicklung

```bash
pnpm install
cp .env.example .env.local     # DATABASE_URL eintragen
pnpm db:push
pnpm bibliothek:import
pnpm benutzer:anlegen --email test@example.org --name Test \
                      --rolle admin --passwort geheim
pnpm dev
```

Ein Sichtprüfungslauf durch einen echten Browser inklusive Bildschirmfotos:

```bash
pnpm exec tsx scripts/rundgang.ts http://localhost:3000 /tmp/rundgang
```

## Was die Anwendung kann

| Bereich | Zustand |
| --- | --- |
| Argumentbibliothek pflegen und freigeben | läuft |
| Fall aus autoiXpert laden | läuft, Schnittstelle noch nicht gegen echte Daten geprüft |
| Prüfbericht einlesen (Text und Scan) | läuft |
| Kürzungspositionen auslesen | braucht `ANTHROPIC_API_KEY` |
| Sonderfall-Prüfliste B.1–B.8 | läuft |
| Auswahlmaske mit Vorschlägen, Suche, eigenem Text | läuft |
| Ausformulieren im Hausstil | braucht `ANTHROPIC_API_KEY` |
| Vier Wächter vor dem Export | läuft |
| Word- und Klartext-Ausgabe | läuft |
| Eigenen Text in die Bibliothek übernehmen | läuft |

## Bekannte Einschränkungen

- **`app.autoixpert.de`** ist aus der Claude-Code-Umgebung heraus durch die
  Egress-Richtlinie gesperrt (403 auf den CONNECT-Tunnel). Der Fall-Import
  (P2) lässt sich deshalb dort nicht gegen die echte Schnittstelle prüfen.
  Auf dem Coolify-Server besteht diese Beschränkung nicht.
- Das **Container-Abbild** lässt sich in der Entwicklungsumgebung nicht bauen,
  weil auch Docker Hub gesperrt ist. Gebaut wird deshalb auf Coolify — dort
  läuft es. Geprüft wurde vorab im nachgestellten Container-Layout: Migration,
  Startbefüllung, Serverstart und ein zweiter Lauf ohne Doppelarbeit.
- **Kalkulationsbeträge** liefert die autoiXpert-Schnittstelle laut ihrer
  eigenen Dokumentation noch nicht („werden zukünftig im Gutachten-Objekt
  enthalten sein"). Die Kürzungspositionen kommen deshalb aus dem
  Prüfbericht; die Fallansicht weist darauf hin.
- **Lesezugriffe auf Gutachten sind kostenpflichtig**, je Gutachten einmalig.
  Der Client greift deshalb zuerst über den Pfad zu (genau ein Zugriff) und
  sucht nur dann über das Aktenzeichen, wobei die Suche nach zehn Listenseiten
  abbricht und das auch meldet.
