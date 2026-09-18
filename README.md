# Logic Core · Foundation v0.1

En statisk React + TypeScript + Vite-app til iPhone. Projekter, lokal Command-log,
versioneret lagring, PWA-app-shell og Diagnostics. Ingen backend, login eller API-nøgler.

## Deploy fra iPhone — ingen terminal

Du skal bruge **logic-core-v0.1.zip** og indholdet af **deploy.yml** fra leverancen.
ZIP-filen indeholder hele repositoryet; den skal **ikke** pakkes ud på telefonen.

1. Gem ZIP-filen i **Filer**. Åbn [GitHub](https://github.com/) i Safari, log ind, og opret et **Public** repository med navnet `logic-core`. Brug branchen `main`. Public fungerer med GitHub Free; kildekoden bliver offentlig, mens appens brugerdata forbliver på enheden.
2. I repositoryet: **Add file → Upload files → choose your files → Browse / Gennemse**. Vælg `logic-core-v0.1.zip` fra Filer. Upload den i repositoryets **rod**, og commit til `main`. Bevar det præcise filnavn.
3. Vælg **Add file → Create new file**. Skriv `.github/workflows/deploy.yml` som filnavn. Kopiér **hele** indholdet af den medfølgende `deploy.yml` ind i editoren, og commit til `main`. Det opretter mapperne automatisk. Upload ikke workflow-filen i roden.
4. Vælg **Settings → Pages → Build and deployment → Source → GitHub Actions**. Hvis Actions er deaktiveret, aktivér dem under **Settings → Actions → General**. Første installation skal have `contents: write`, som allerede står i workflowet.
5. Vælg **Actions → Deploy Logic Core → Run workflow → main → Run workflow**. Hvis første automatiske kørsel allerede er grøn, behøver du ikke køre igen. Et tidligt rødt run før trin 4 løses ved at køre workflowet igen bagefter.
6. Vent på grønt **build** og **deploy**. Åbn URL'en under deployment-resultatet eller **Settings → Pages → Visit site**.
7. Åbn URL'en i **Safari**. Vælg **Del → Føj til hjemmeskærm**. Aktivér **Åbn som webapp**, hvis valget vises. Tryk **Tilføj**, og start fra ikonet.
8. I appen: **Mere → Diagnostics → Kør checks igen**. Efter online-installationen forventes **8 / 8 PASS**. Følg iPhone-testen nedenfor.

Hvis en GitHub-knap ikke vises i mobilvisningen, vælg **Anmod om websted til computer**
i Safaris sidemenu. Det er stadig Safari på din iPhone.

Første run pakker ZIP-filen ud, committer kildefilerne til `main` og fjerner den
midlertidige ZIP-fil fra repositoryets rod. Samme run bygger og deployer appen.
Derefter bygger og deployer hvert push til `main` automatisk. Workflowet kræver ingen
personlige tokens eller secrets. Det genererede kildecommit udløser ikke et ekstra run.

Ved **403** i `git push`: se **Settings → Actions → General → Workflow permissions**,
vælg **Read and write permissions**, og kør workflowet igen. En organisationspolitik
kan kræve hjælp fra repositoryets administrator.

Alternativt kan hele ZIP-indholdet lægges direkte i et repository. `package.json`
skal ligge i roden, og workflowet skal ligge under `.github/workflows/`.

Pages-konfigurationen følger [Vites Pages-vejledning](https://vite.dev/guide/static-deploy.html#github-pages)
og [GitHubs officielle workflow-vejledning](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## iPhone-test — afslut foundation-valideringen

- Åbn appen fra hjemmeskærmen. Diagnostics skal vise **Kører som installeret web-app**.
- Opret projektet `iPhone-test`, vælg **Aktiv**, og gem. Se det under Projekter og Command.
- Redigér titel, beskrivelse og status. Gem, luk appen helt, og åbn den igen. Kontrollér ændringerne.
- Skriv og send en Command. Den skal vises i seneste aktivitet efter genåbning.
- Kontrollér alle hovedområder, herunder Beslutninger, Knowledge, Indstillinger og Diagnostics via Mere.
- Kør Diagnostics online og igen i flytilstand. Førstegangsbesøget skal være online; vent på service worker PASS, før du lukker appen og tester offline-genåbning.
- Eksportér JSON fra Diagnostics eller Indstillinger. På iPhone bruges delingsarket, hvis fil-deling understøttes; vælg **Gem i Filer**. Ellers bruges fil-download.
- Slet testprojektet via **Slet projekt → Slet permanent**. Luk og genåbn, og bekræft at det er væk.
- Kontrollér portræt, landskab, tastatur, skærmtop/-bund og at ingen side kræver vandret scrolling.

## Arkitektur

`AppShell` og en lille hash-router ejer navigationen. Siderne bruger `AppStore`
via React Context / `useSyncExternalStore`. Store ejer alle reads/writes og gemmer
et samlet, valideret v1-dokument. `schema.ts` er det ene sted for fremtidige migrationer.

| Mappe / fil | Ansvar |
| --- | --- |
| `src/app/` | Shell, navigation, netværks- og tastaturtilstand |
| `src/pages/` | Command, Projects/editor, modulpladsholdere, Settings, Diagnostics |
| `src/components/` | Ikoner, projektkort, overskrifter, eksport og Error Boundary |
| `src/domain/` | Faktiske TypeScript-modeller og status-union |
| `src/storage/` | Versioneret datalag, validering, write-fejl og React-binding |
| `src/pwa/` | Service worker-registration, status og Diagnostics |
| `src/utils/`, `src/config.ts` | Datoformattering og appkonfiguration |
| `public/` | Manifest, favicon, PNG-ikoner og Apple touch icon |
| `scripts/` | Pages-base, generering og kontrol af offline-build |
| `tests/` | Lagring, migration-grænse, navigation, base paths og worker-livscyklus |
| `.github/workflows/deploy.yml` | Mobil bootstrap, tests, build og Pages-deployment |

Den fulde filliste ligger i [docs/FILE_TREE.txt](docs/FILE_TREE.txt).

## Hvad virker i v0.1?

- Projekt-CRUD med `id`, `title`, `description`, `status`, `createdAt` og `updatedAt`.
- Statusser: `brainstorm`, `candidate`, `active`, `decided`, `locked`, `archived`.
- UUID'er, bevaret oprettelsesdato og monotont stigende ændringstid.
- Command-input gemmer lokalt; aktive projekter og seneste aktivitet på forsiden.
- Alle krævede områder i navigationen. Beslutninger, Muligheder og Knowledge er tydeligt markeret som planlagte.
- Dark mobil-layout, safe areas, 48px primære knapper, tastaturhensyn og tastaturnavigation.
- Standalone-manifest, lokale ikoner, versionsopdelt offline-app-shell og sikker opdateringslivscyklus.
- Otte PASS/FAIL-checks, JSON-eksport, forståelige lagringsfejl og React-fejlfallback.
- React er den eneste runtime-afhængighed ud over React DOM. Ingen eksterne fonte eller CDN-assets.

## Engineering og begrænsninger

- Data ligger i `localStorage` under en nøgle med appens base path. Browseren leverer origin-isolation. En ændret URL, browserprofil, privat session eller separat installation kan have et andet datasæt.
- Lokal lagring er ikke en backup. Rydning af browserdata og lageroprydning kan fjerne data. Eksportér jævnligt. Import/synkronisering er ikke med i v0.1.
- Data og aktivitet gemmes atomisk i samme JSON-write. Fejl viser ingen falsk gemt-tilstand. Beskadigede og nyere skemaer blokerer writes, og de originale bytes kan eksporteres.
- Fremtidige migrationer tilføjes eksplicit i `schema.ts`. Ingen fiktiv v0-migration er oprettet, da v1 er det første format.
- De seneste 300 aktiviteter bevares; projekter beskæres ikke automatisk. De seneste seks aktiviteter vises på Command.
- “Låst” er en statusmarkør i v0.1, ikke en adgangslås. Sletning kræver bekræftelse og har ingen undo.
- Projekteditoren bevarer input under et fejlet save. Ikke-gemte felter bevares ikke efter navigation eller lukning.
- Der er beskyttelse mod forældede editorer og registrerede ændringer fra andre faner. `localStorage` giver ikke fuld isolation af samtidige writes fra flere faner; brug én aktiv editor ad gangen.
- Offline virker efter et vellykket onlinebesøg med service worker PASS. Første load kræver internet. Cache-versioner slettes kun inden for denne app-scopes namespace.
- En hentet opdatering aktiveres, når alle appens faner/vinduer er lukket. Gem før lukning. Appen genindlæser ikke automatisk midt i redigering.
- Diagnostics beviser læsning/skrivning her og nu. Lagring over en faktisk iOS-lukning skal bekræftes med iPhone-testen ovenfor.
- Bygget til moderne Safari (build target Safari 16.4). Fysisk iPhone/PWA-installation og GitHub-hosted Actions-run er ikke verificeret i leverancemiljøet.

## Udviklerkommandoer — ikke nødvendige på iPhone

Node 24; præcise afhængigheder er låst i `package-lock.json`.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run preview
```

`npm run dev` starter udviklingsserveren uden service worker.
`npm run build` typechecker, bygger og verificerer assets, manifest og worker.
Workflowet henter den faktiske `base_path` fra GitHub Pages, inklusive root-sites
og custom domains. Lokalt kan `PAGES_BASE_PATH=/logic-core/` bruges til samme test.
Hash-navigation kræver ingen server-rewrites eller specialiseret 404-side.

## Valideringsstatus og v0.2

Se [docs/VALIDATION.md](docs/VALIDATION.md) for den præcise teststatus.

Efter en bestået iPhone-test anbefales **valideret JSON-import med backup før restore**
som første v0.2-leverance. Beskyt det lokale arbejde, før de større motorer tilføjes.
