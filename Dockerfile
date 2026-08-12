# ---------------------------------------------------------------------------
# Abhängigkeiten
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Übersetzen
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next prüft beim Bauen keine Datenbankverbindung, braucht die Variable aber
# als gesetzt. Der echte Wert kommt zur Laufzeit aus Coolify.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ---------------------------------------------------------------------------
# Laufzeit
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# poppler-utils liefert pdftotext und pdftoppm. Beide werden für das Einlesen
# der Prüfberichte gebraucht — auch der Bildpfad für eingescannte Berichte.
RUN apt-get update && \
    apt-get install -y --no-install-recommends poppler-utils ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 werkbank && \
    useradd --system --uid 1001 --gid werkbank werkbank

# Standalone-Ausgabe: Next legt Server und die tatsächlich benötigten
# Abhängigkeiten selbst zusammen, das Abbild bleibt dadurch klein.
COPY --from=build --chown=werkbank:werkbank /app/.next/standalone ./
COPY --from=build --chown=werkbank:werkbank /app/.next/static ./.next/static
COPY --from=build --chown=werkbank:werkbank /app/public ./public

# Die Skills werden zur Laufzeit gelesen: der Bibliotheksimport und die
# Playbook-Fragmente greifen darauf zu.
COPY --from=build --chown=werkbank:werkbank /app/skills ./skills

USER werkbank
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/gesundheit').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
