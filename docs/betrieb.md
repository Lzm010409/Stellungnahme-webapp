# Betrieb auf Coolify

Die Anwendung läuft als Coolify-Application auf `coolify.gollenstede.app`
(geprüft: Coolify 4.1.2, API erreichbar).

## Einmalig einrichten

### 1. Postgres-Ressource

In Coolify im Projekt eine **PostgreSQL 16**-Ressource anlegen. Die von
Coolify erzeugte interne Verbindungs-URL wird gleich als `DATABASE_URL`
gebraucht.

### 2. Application anlegen

- Quelle: `Lzm010409/Stellungnahme-webapp`, Branch `main`
- Build Pack: **Dockerfile**
- Port: `3000`
- Healthcheck-Pfad: `/api/gesundheit`

### 3. Umgebungsvariablen

| Variable | Pflicht | Bedeutung |
| --- | --- | --- |
| `DATABASE_URL` | ja | Verbindungs-URL der Postgres-Ressource |
| `APP_BASIS_URL` | ja | Öffentliche Adresse, z.B. `https://werkbank.gollenstede.app` |
| `ANTHROPIC_API_KEY` | für KI-Funktionen | Bibliothekserweiterung und Ausformulierung |
| `AUTOIXPERT_API_TOKEN` | für P2 | Bearer-Token der externen Schnittstelle |
| `ENTRA_TENANT_ID` | für Microsoft-Anmeldung | Verzeichnis-ID des Tenants |
| `ENTRA_CLIENT_ID` | für Microsoft-Anmeldung | Anwendungs-ID der App-Registrierung |
| `ENTRA_CLIENT_SECRET` | für Microsoft-Anmeldung | Geheimnis der App-Registrierung |
| `ENTRA_AUTO_ANLEGEN` | nein | `true` legt unbekannte Tenant-Konten selbst an. Standard ist `false`: dann kann sich nur anmelden, wer vorher eingetragen wurde. |

Fehlt eine der drei `ENTRA_*`-Variablen, blendet die Anmeldemaske den
Microsoft-Knopf einfach aus und bietet nur die Passwortanmeldung an.

### 4. App-Registrierung in Microsoft Entra

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

### 5. Erste Einrichtung nach dem ersten Deployment

Im Container-Terminal der Application:

```bash
# Datenbankschema anlegen
pnpm db:push

# Bibliothek aus den Referenzdateien übernehmen
pnpm bibliothek:import

# Ersten Zugang anlegen (ohne --passwort: nur über Microsoft anmeldbar)
pnpm benutzer:anlegen --email vorname@gollenstede-sachverstand.de \
                      --name "Vorname Nachname" --rolle admin
```

## Wiederkehrende Aufgaben

```bash
# Abgleichbericht ansehen, ohne etwas zu schreiben
pnpm bibliothek:import --bericht

# Bibliothek zurück nach Markdown schreiben, damit die Skills im Chat
# weiter mit dem aktuellen Stand arbeiten
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

## Bekannte Einschränkungen

- **`app.autoixpert.de`** ist aus der Claude-Code-Umgebung heraus durch die
  Egress-Richtlinie gesperrt (403 auf den CONNECT-Tunnel). Der Fall-Import
  (P2) lässt sich deshalb dort nicht gegen die echte Schnittstelle prüfen.
  Auf dem Coolify-Server besteht diese Beschränkung nicht.
- Das **Container-Abbild** konnte in der Entwicklungsumgebung nicht gebaut
  werden, weil auch Docker Hub gesperrt ist. Das Dockerfile ist geschrieben
  und setzt auf der geprüften Standalone-Ausgabe auf; der erste echte Build
  findet auf Coolify statt.
