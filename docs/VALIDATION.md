# Logic Core v0.1 — validering

## Udført i byggemiljøet

- Ren `npm ci` gennemført fra den inkluderede lockfile, efterfulgt af tests og produktionsbuild.
- `npm test`: **22/22 PASS**. Tester CRUD og alle seks statusser, genåbning af datalaget, UUID'er/timestamps, inputvalidering, quota-fejl, utilgængeligt lager, corrupt/future schemas, safe Diagnostics, eksport, stale editors og begrænset activity-log.
- Offline-tests eksekverer den faktiske worker-template med en isoleret Cache API-fake: precache, cache-scope, aktivering, offline-navigation, JS-assets, undtagelse af andre origins/apps og fejlet installation.
- `npm run build`: **PASS**. TypeScript strict, fuld bundling og asset/manifest/SW-kontrol.
- Build er gennemført med både `/` og `/logic-core/` som base path. Konfigurationstests dækker desuden user Pages-sites og custom domain.
- Imports, scripts, komponentgrænser, routes, manifest, worker-registration og workflow gennemgået.
- Workflow-YAML parsede korrekt; main-trigger, manuel trigger, build/deploy-afhængighed, Pages-base og job-permissions er kontrolleret.
- Mobil bootstrap er simuleret i et isoleret lokalt Git-repository. Workflowets faktiske installationsstep pakkede alle 50 kildefiler ud, committede og push'ede til en lokal Git-remote, bevarede workflowet og fjernede ZIP-filen. Alle filbytes matchede leverancen. Dette verificerer ikke GitHubs hosted permissions eller Pages-service.
- `localStorage` åbnes kun gennem storage-bindingen. Ingen `any`-typer i applikationen. Ingen backend-, auth-, AI- eller API-key-afhængighed ved første load.

## Ikke fysisk verificeret

- React-UI gennem et interaktivt browserflow: den tilgængelige cloud-browser afviste lokaladressen med `ERR_BLOCKED_BY_CLIENT`.
- iPhone Safari, standalone-installation, skærmens safe areas og faktisk softwaretastatur.
- Faktisk genåbning af installeret PWA offline efter iOS har afsluttet appen.
- iOS-delingsark/download af JSON.
- GitHub-hosted Actions og offentlig Pages-URL. Der er ikke oprettet eller deployet et eksternt repository fra dette miljø.

Unit-tests af storage/cache er ikke præsenteret som en gennemført browser- eller iPhone-test.
Kør accepttesten i README på den deployed app for at lukke disse punkter.
