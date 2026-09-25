# Logic Core v0.3.0

App **0.3.0**, data **schema 3**. Bygget direkte på den fysisk accepterede v0.2.1.
Opportunities får et lokalt arbejdsrum med immutable AI-kildeversioner. Decision
Drift viser konkrete ændringer i dine allerede gemte beslutningsversioner.
Ingen AI-tjenester kontaktes fra appen.

## Installer fra iPhone

1. Eksportér gerne en JSON-backup til Filer inden opdateringen.
2. Gem **logic-core-mobile-release.zip** i en separat mappe i Filer. Udpak ikke;
   filnavnet skal være præcis dette, uden `(1)` eller versionsnummer.
3. Safari → **wallkodk-glitch/Logic-Core** → repository root → **Add file →
   Upload files → Browse** → vælg ZIP → **Commit to main**.
4. Actions → **Mobile release Logic Core** → vent på grøn build, install og deploy.
   ZIP bliver fjernet automatisk. Ingen workflows eller sourcefiler skal redigeres.
5. Åbn den **eksisterende** Home Screen-app online. Vent på **Opdatering klar**.
   Gem/fjern ugemt arbejde, luk andre Logic Core-vinduer, og vælg
   **Opdatér og genåbn**. Den kontrollerede opdatering må kun genindlæse én gang.
6. Mere → Diagnostics: **0.3.0 / schema 3 / 8/8 PASS** online. Kontrollér eksisterende
   Projects, Decisions, commits, reviews og aktivitet. Muligheder starter tomme.

Safari kan kræve “Anmod om websted til computer” for Upload-knappen.
Adressen forbliver https://wallkodk-glitch.github.io/Logic-Core/.
Bevar installationen og browserdata under testen; sletning er ikke en update-løsning.

## Brug muligheder

Mere → Muligheder → **Importér fra AI**. Indsæt JSON eller vælg en JSON-fil,
kontrollér preview, og bekræft. Et komplet eksempel kan hentes fra importskærmen.
Se [Bridge-formatet](docs/OPPORTUNITY_BRIDGE.md) for et kopierbart AI-prompt og limits.

Samme bridgeKey og ændret analyse tilføjer en kildeversion. Lokale felter bevares.
Identisk analyse, også en tidligere version, giver ingen ekstra snapshot eller write.
Manuel oprettelse, noter, status, tags, review-dato og links kræver ingen AI-import.
Opportunity Signal er kun et manuelt, beregnet analysesignal. **Start beslutning**
opretter en almindelig draft med kildehenvisning; intet alternativ vælges automatisk.

## Data, navigation og sikkerhed

Schema 1 → 2 → 3 og schema 2 → 3 migrerer eksplicit. Eksisterende arrays, records,
revisioner og timestamps bevares; opportunities tilføjes som []. Samme storage-key,
origin, base path og PWA-identitet. Ukendt nyere/corrupt data bevares og blokerer writes.
Backup-wrapper forbliver version 1; schema 1/2/3 kan previewes og restores til schema 3.
Recovery-journal og atomisk primary-write er bevaret.

Intern navigation spørger, når der er kendt ugemt arbejde. Browser Back annulleres
ved at gendanne den accepterede hash uden at unmount'e editoren. iOS kan ikke
love et close-/force-quit-varsel; gem selv. Ingen autosave. Brug én aktiv editor.

Ingen nye dependencies, backend, login, cloud-sync, telemetry, API keys eller AI-runtime.
Importerede tekster er plain text. Eksterne kilde-links åbnes kun ved dit tryk.

## Release-kontrakt

Én root-snapshot ZIP: validate/stage → npm ci → tests → typecheck/build →
asset/source-verifikation → install/bot-commit/remove ZIP → Pages deploy.
Protected workflows, trusted controller, generator og setup-node-fix er byte-identiske.

Fejl før installation bevarer source og live-app; ZIP bliver. Push-fejl giver ingen
ny deploy. Pages-fejl efter installation efterlader testet source committed og ZIP
fjernet; retry **Actions → Deploy Logic Core → Run workflow → main**.
Samme/lavere version afvises. Ingen automatisk schema-downgrade.

[Opportunity/Decision Intelligence og acceptance](docs/OPPORTUNITY_INTELLIGENCE.md) ·
[Validation](docs/VALIDATION.md) · [Foundation Lock](docs/FOUNDATION_LOCK.md) ·
[Decision Engine](docs/DECISION_ENGINE.md) · [File tree](docs/FILE_TREE.txt).
Historiske v0.2.1-designnoter findes i docs/POLISH_FLOW.md.
