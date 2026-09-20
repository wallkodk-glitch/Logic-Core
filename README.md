# Logic Core v0.2.0 — Decision Engine

App **0.2.0**, data **schema 2**. Bygget direkte på den fastlåste v0.1.2
Pipeline Proof. React/TypeScript/Vite, local-first og GitHub Pages PWA bevares.
Ingen AI, backend, login, telemetry, API keys eller cloud-sync.

## Installer fra iPhone — kun én ZIP

**Gate: installér og acceptér først v0.1.2.** Diagnostics skal vise 0.1.2/schema 1,
eksisterende data skal være intakte, og ZIP-only Actions-run skal være grønt.

1. Eksportér en JSON-backup fra din eksisterende PWA til Filer. Behold denne
   schema 1-backup separat fra senere schema 2-backups.
2. Gem v0.2.0's **logic-core-mobile-release.zip** i Filer uden at udpakke.
   Gem A og B i hver sin mappe, så iOS ikke tilføjer et tal til filnavnet.
3. Safari → **wallkodk-glitch/Logic-Core** → repository root →
   **Add file → Upload files → Browse** → vælg denne ZIP → **Commit to main**.
4. Actions → **Mobile release Logic Core**: vent på grønne build, install og deploy.
   ZIP fjernes automatisk ved installation. Upload ingen workflows/source-filer.
5. Åbn den eksisterende PWA online. Luk alle Logic Core-vinduer, og genåbn.
   Gentag hvis service worker stadig venter. **Slet ikke app/browserdata.**
6. Diagnostics: **0.2.0 / schema 2 / 8/8 PASS**. Kontrollér dine eksisterende data.

Safari kan kræve “Anmod om websted til computer” for at vise Upload-knappen.
Origin, Pages-base `/Logic-Core/`, manifest/install identity og storage-key
`logic-core:/Logic-Core/:data` er uændrede. Recovery bruger samme key + `:recovery`.

## Første beslutning

Mere → Decisions → Ny beslutning. Gem kladden løbende og før navigation/lukning.
Arbejd gennem Goal, Reality, Constraints/Assumptions, Options, valgfri Scoring,
dit manuelle valg og Execution/Review.

“Beslut og gem snapshot” kræver titel, mål, mindst to navngivne muligheder,
dit valg, begrundelse og næste handling. Hvis du bruger kriterier, kræves alle
scores. Et højt tal vælger aldrig for dig.

En besluttet beslutning er skrivebeskyttet. Genåbning laver en kladde uden at
ændre tidligere snapshots. Næste beslutning tilføjer et nyt snapshot.
Reviews tilføjes med Fasthold / Genåbn / Afslut. Projektlink er valgfrit.

## iPhone acceptance — v0.2.0

- Projekter og aktiviteter fra v0.1.2 er bevaret; CRUD og Command fungerer.
- Lav/gem/genåbn en kladde, også uden projekt og uden kriterier.
- Tilføj to kriterier og scores. Kontrollér et vægtet signal; vælg gerne den
  lavere score. Appen må ikke ændre dit valg.
- Beslut → snapshot 1 → genåbn → ændr antagelser → beslut → snapshot 2.
  Kontrollér at snapshot 1 er uændret.
- Tilføj reviews med Fasthold, Genåbn og Afslut; tidligere reviews bevares.
- Link en beslutning til et testprojekt; slet projektet. Beslutningen og
  historikken skal bestå uden projektlink.
- Test arkivering, genåbning og bekræftet sletning med testdata.
- Eksportér schema 2-backup. Test preview/restore og recovery med backup sikret.
  En gammel schema 1-backup skal vise **1 → 2** og **0 beslutninger**:
  restore erstatter ALT aktuelt indhold, ikke kun projekter.
- Luk/genåbn, åbn offline, og kontrollér gemte beslutninger/historik.
- Kontrollér smal skærm (320 px), touch, tastatur og ingen horisontal sidescroll.

## Sikkerhed og begrænsninger

Hele dokumentet valideres før skrivning. V1 migreres eksplicit til v2;
projekter/aktiviteter bevares, decisions starter tom. Korrupt/future data
nulstilles aldrig. Preview og recovery-journal er bevaret.

Gem manuelt; ingen autosave, sync eller push-notifikationer. localStorage er
ikke en ekstern backup. Brug én aktiv editor. Stale-write-checks beskytter mod
kendte forældede versioner, men localStorage giver ikke en ægte multi-tab lock.
Historik er uændrelig gennem appen, ikke et kryptografisk revisionsbevis.

V0.1.x kan ikke læse schema 2. Installer ikke gammel kode oven på v2-data.
Release-controlleren afviser samme/lavere appversion. En eventuel rollback
kræver en ny, højere release med bevidst kompatibilitet — ikke blot en gammel ZIP.

## Release-kontrakt — uændret

Én root-snapshot ZIP. Validate/stage → locked install → tests → typecheck/build →
PWA/source-byte-verification → install/bot-commit/remove ZIP → Pages deploy.
Begge protected workflows og setup-node-fixet er uændrede fra accepteret main.
Kun install-job har contents: write; ingen npm/release-scripts fra arkivet kører dér.

Validation/build/test-fejl: ingen source-installation eller deployment; ZIP bliver.
Push-fejl: ingen deploy. Pages-fejl efter installation: testet source er committed,
ZIP er fjernet; retry **Actions → Deploy Logic Core → Run workflow → main**.
Ingen workflow/source-upload eller terminal er nødvendig.

Læs [Decision Engine](docs/DECISION_ENGINE.md), [VALIDATION](docs/VALIDATION.md),
[FOUNDATION_LOCK](docs/FOUNDATION_LOCK.md) og [FILE_TREE](docs/FILE_TREE.txt).
