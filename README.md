# Logic Core v0.1.2 — Pipeline Proof

Minimal release oven på den fysisk accepterede v0.1.1. Appversion **0.1.2**,
schemaVersion **1**. Ingen nye features, dependencies, migrationer eller UI-ændringer.

## Installation fra iPhone — kun én ZIP

1. Eksportér en backup fra den eksisterende installerede Logic Core til Filer.
2. Gem denne releases **logic-core-mobile-release.zip** i Filer. Pak den ikke ud.
3. I Safari: åbn **wallkodk-glitch/Logic-Core**, gå til repositoryets rod,
   **Add file → Upload files → Browse**, vælg ZIP, og commit til **main**.
4. Vent på grønne **build → install → deploy** i **Mobile release Logic Core**.
   ZIP-filen fjernes automatisk fra main efter succesfuld source-installation.
5. Åbn din eksisterende PWA online, luk alle Logic Core-vinduer, og genåbn.
   Gentag online/luk/genåbn hvis en ny service worker stadig venter.

Upload ingen workflows eller source-filer. Begge protected workflows er byte-identiske
med den accepterede v0.1.1, inklusive setup-node uden staging npm-cache. Hvis Safari
skjuler Upload-knappen, vælg “Anmod om websted til computer”.

## Acceptance / gate før v0.2.0

- Diagnostics viser **0.1.2**, **schema 1** og **8/8 PASS online**.
- Eksisterende projekter og aktiviteter er intakte efter genåbning.
- Test projekt-CRUD, Command, backup/import/recovery og offline-genåbning.
- Actions viser succes, main viser bot-commit for 0.1.2, og ZIP er væk.
- **Upload først v0.2.0 når disse checks består.**

v0.1.1 er fysisk accepteret af Jakob. v0.1.2's ZIP-only proof er ikke fysisk
afprøvet i byggemiljøet; Foundation må markeres LOCKED, når ovenstående består.

## Uændret fundament

React + TypeScript + Vite; hash-navigation; lokal versioneret AppStore; JSON
import/export og én recovery-snapshot med journal; PWA og GitHub Pages.
Ingen backend, login, telemetry, secrets eller cloud-sync.

Origin, base path, manifest, install identity og storage-key er uændrede:
`logic-core:/Logic-Core/:data`; recovery: samme key + `:recovery`.

Læs [VALIDATION](docs/VALIDATION.md), [FOUNDATION_LOCK](docs/FOUNDATION_LOCK.md)
og [FILE_TREE](docs/FILE_TREE.txt) for checks og source-overblik.

Ved build/test/validation-fejl er remote source uændret og ZIP bliver. Ved push-fejl
sker ingen deployment. Ved Pages-fejl efter install er den testede source committed;
brug **Actions → Deploy Logic Core → Run workflow → main** til retry.

Lokalt lager er ikke en ekstern backup. Brug samme installerede PWA, bevar URL'en,
og gem regelmæssigt JSON i Filer. Brug én aktiv editor ad gangen.
