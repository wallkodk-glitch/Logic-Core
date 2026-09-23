# Logic Core v0.2.1 — Polish & Flow

App **0.2.1**, data **schema 2**. Bygget direkte på den fysisk accepterede v0.2.0.
Roligere mobilflader, genveje til dit arbejde og bedre hjælp ved app-opdatering.
Samme React/TypeScript/Vite-app, data og ZIP-release-system.

## Installer fra iPhone

1. Gem gerne en JSON-backup fra Indstillinger i Filer før opdatering.
2. Gem **logic-core-mobile-release.zip** i Filer uden at udpakke. Brug en separat
   mappe, så filnavnet ikke får et ekstra tal.
3. Safari → **wallkodk-glitch/Logic-Core** → repository root →
   **Add file → Upload files → Browse** → vælg ZIP → **Commit to main**.
4. Actions → **Mobile release Logic Core** → vent på grøn build, install og deploy.
   GitHub fjerner ZIP automatisk. Ingen andre filer skal uploades eller redigeres.
5. Åbn din eksisterende PWA online. Gem arbejdet, luk alle Logic Core-vinduer i
   Safari og på hjemmeskærmen, og genåbn. Gentag om nødvendigt ved denne første
   opgradering fra den ældre worker. **Slet ikke appen eller browserdata.**
6. Mere → Diagnostics: **0.2.1 / schema 2 / 8/8 PASS**. Kontrollér eksisterende data.

Safari kan kræve “Anmod om websted til computer” for at vise Upload-knappen.
Live-adressen forbliver https://wallkodk-glitch.github.io/Logic-Core/.

## Hvad er nyt?

- Tryk på projekt-/beslutningsaktivitet for at åbne kilden. Slettede elementer
  bliver stående som historie uden et link. Commands kan foldes ud.
- “Fortsæt” samler op til tre senest opdaterede projekter/beslutninger.
- Færre labels, badges og dekorative flader. Systemtypografi og roligere navigation.
- Kladder har én mobil handlingslinje: **Gem kladde**, samt **Beslut**, når input
  er gyldigt. De syv sektioner kan foldes sammen. Ingen autosave.
- Startfejl får en selvstændig hjælpeskærm efter 12 sekunder eller ved registreret
  scriptfejl. Ingen automatisk sletning eller nulstilling af lokale data.
- Fra v0.2.1 kan en ventende opdatering aktiveres med **Opdatér og genåbn**.
  Gem først alle ændringer og luk andre app-vinduer. Ingen automatisk reload midt
  i redigering. Ældre workers får vejledning i manuel luk/genåbn.

Den nye startbeskyttelse virker først, når v0.2.1's HTML er hentet. Den kan ikke
retroaktivt ændre en allerede cached v0.2.0-startskærm.

## Data og beslutninger

Schema, storage-key og PWA-installationsidentitet er uændrede. Ingen v0.2.1-migration.
Eksisterende schema 2-data læses uden omskrivning. Gamle schema 1-backups bruger
den eksisterende v1 → v2-migration ved restore. Restore erstatter hele datasættet.

Decision Engine bevarer dine input, dit manuelle valg, immutable snapshots og
append-only reviews. Scoring er valgfri og beregner kun et analytisk signal.
Genåbn en besluttet beslutning for at ændre den; gamle snapshots bevares.

Ingen nye dependencies, backend, login, AI, telemetry, API keys eller cloud-sync.
Gem kladder før navigation. Brug én aktiv editor; stale-write-kontrol er ikke
en ægte tværgående browserlås. Bevar også en backup i Filer.

## Release-kontrakt

Én root-snapshot ZIP: validate/stage → npm ci → tests → typecheck/build →
asset/source-verifikation → install/bot-commit/remove ZIP → Pages deploy.
Protected workflows, trusted installer, generator og setup-node-fix er uændrede.

Fejl før source-installation bevarer repository source og live-app; ZIP bliver.
Push-fejl giver ingen deploy. Pages-fejl efter installation efterlader testet
source committed og ZIP fjernet; retry via **Actions → Deploy Logic Core →
Run workflow → main**. Samme/lavere version afvises.

Læs [ændringer og fysisk acceptance](docs/POLISH_FLOW.md),
[validation](docs/VALIDATION.md), [Foundation Lock](docs/FOUNDATION_LOCK.md),
[Decision Engine](docs/DECISION_ENGINE.md) og [file tree](docs/FILE_TREE.txt).
