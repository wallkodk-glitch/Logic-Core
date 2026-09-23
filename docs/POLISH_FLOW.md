# Polish & Flow — v0.2.1

## Arkitektur og synlige ændringer

Det eksisterende AppShell/pages/components/domain/storage-layout er bevaret.
Store, schema, validators, backup og recovery er ikke ændret. Versionen kommer
stadig fra package.json via Vite; schema-versionen er separat og forbliver 2.

Home bruger to pure helpers i domain/workspace.ts:

- activityTarget klassificerer COMMAND, PROJECT og DECISION ud fra event-type.
  Den linker kun til records, der findes nu. Slettede records er passive.
  Commands bruger lokal disclosure-state i ActivityRow; intet nyt activity-modul.
- recentWorkspace bruger aktuelle projects/decisions, sorterer updatedAt faldende
  og derefter type:id med deterministisk strengsammenligning. Højst tre vises.
  Arkiverede projekter samt closed/archived decisions udelades. Ingen visit-log,
  nye persisted fields eller kopier af entity-data lagres.

Project-routes kunne tidligere kun læse simple word/hyphen-IDs. Data-validatoren
tillader også andre gyldige string-IDs. Nye aktivitetslinks afslørede den forskel.
Project-routes er derfor rettet til samme sikre URL-decode og ID-check som
Decision-routes; entityHref encodes IDs. Det er en konkret correctness-rettelse.

UI bruger systemfont, neutral mørk baggrund, få flader og dæmpet Logic-accent.
Orbit, terminal-labels, robot-copy og versionsfooter er fjernet. De eksisterende
ikoner, routes og Mere-placeringen af Decisions er bevaret.
Aktiviteter og workspace er rækker frem for ekstra kortstakke.

Draft-editorens eneste action area ligger i dokumentflowet og er sticky ved
toppen på mobil. Den reserverer sin egen højde og konkurrerer ikke med bottom-nav.
Ved registreret softwarekeyboard, lav landscape-skærm eller bredde mindst 720 px
bliver den statisk. Gem kladde kalder eksisterende save(); Beslut kalder save(true).
canDecide bruger præcis samme validator som store. Ingen alternativ save-logik
eller autosave. Den første sektion er åben, resten kan foldes ud efter behov.

## Startup-fejlen: observation kontra forklaring

**Oplyst fysisk observation:** Den gamle Home Screen-PWA kunne blive stående på
“Starter Logic Core…”, mens Safari/fresh install virkede og data var intakte.

**Verificeret i v0.2.0-koden:** Den statiske loading-label havde ingen timeout.
Registrering af service worker, state og hjælp afhænger af, at main-bundle starter.
En fejlet import før React-mount kan derfor efterlade labelen permanent.

**Sandsynlig mekanisme, ikke bevist enhedsdiagnose:** Gammel cached HTML kan pege
på et tidligere hashed bundle, som mangler efter cache eviction/deployment.
Worker/template-tests reproducerer denne type delvise cache, men der foreligger
ikke Safari-console-/cachelogs fra den konkrete iPhone-hændelse. Migration kan
ikke udpeges som årsagen; eksisterende schema-fejl bliver håndteret af store.

v0.2.1 retter den manglende recovery-vej:

1. Den indlejrede startup-script og styling ligger i index.html. Skærmen er
   uden for React-root og fungerer uden main JS/CSS, store eller service worker.
   En registreret scriptfejl eller 12 sekunders manglende mount viser hjælp.
2. Genindlæs er brugeraktiveret. Søg efter opdatering bruger kun egen worker-
   registration, har 8 sekunders timeout og giver luk/genåbn-vejledning.
3. Workerens navigation forbliver cache-first, når index og de kritiske JS/CSS-
   filer er intakte. Ved delvis cache forsøges online HTML med no-store og timeout.
   Offline vises cached HTML med startup-guard eller selvstændig recovery-HTML.
   Cache API-fejl blokerer ikke ellers tilgængelige online-assets.
4. Store afviser fortsat nyere schema, viser “Opdatér appen” og bevarer raw data.
   AppShell viser fejlen og adgang til Diagnostics/eksport. Ingen resetknap.

**Grænse:** En allerede cached v0.2.0-index får ikke denne guard retroaktivt.
Den første opdatering til v0.2.1 kan derfor stadig kræve online + luk alle
app/Safari-vinduer + genåbn. Slet ikke installationen eller browserdata.
En JavaScript-hovedtråd, som er fuldstændig blokeret, kan heller ikke køre en timer.

## Kontrolleret update lifecycle

Waiting worker aktiveres ikke automatisk ved install. Appen viser “Opdatering
klar”; kun “Opdatér og genåbn” starter message-flowet.

Ephemeral pending-work registrerer Command, Project/Decision-editor, review og
backup-preview. Kendte ugemte ændringer blokerer handlingen. MessageChannel
anmoder med LOGIC_CORE_ACTIVATE_V1. Worker kontrollerer åbne vinduer i eget scope
inklusive ukontrollerede og accepterer kun den eneste in-scope afsender.

ACK + faktisk controllerchange + stadig intet ugemt arbejde er alle nødvendige
før en enkelt reload. Midlertidig inert/overlay forhindrer nye input under
handlingen. Controllerchange uden aktivt samtykke giver aldrig reload.
Timeout/rejection lukker kanalen og annullerer reload-intentionen; sene svar fra
en gammel request kan ikke aktivere en ny. Ældre workers får manuel vejledning.

Dette er ikke en tværgående transaktionslås. Et nyt vindue kan åbne efter
kontrollen; derfor instrueres brugeren i at gemme og lukke øvrige vinduer.
Appen vil ikke selv reloade disse vinduer. Browserens normale activation efter
lukning af alle vinduer er bevaret.

Standardlifecycle blev kontrolleret mod de primære referencer:
[Service worker lifecycle](https://web.dev/articles/service-worker-lifecycle) og
[skipWaiting](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting).
Implementeringsresultaterne kommer fra den lokale kode og dens tests.

## Statisk mobil-audit

Ingen browser-rendering blev mulig: lokal preview returnerede
ERR_BLOCKED_BY_CLIENT. Tabellen beskriver derfor **kode-/markup-kontrol**,
ikke målte skærmbilleder eller bekræftet fravær af pixel-overflow.

Alle otte skærme er læst og React-renderet. Fælles CSS har min-width:0,
fleksible actions, max-width:100%, 16 px inputs, tekstombrydning og safe areas.
Der skjules ikke overflow globalt for at maskere layoutfejl.

| Bredde (CSS px) | Standard sidegutter | Indholdsbredde uden ekstra safe-area | Statisk vurdering |
| --- | ---: | ---: | --- |
| 320 | 16 | 288 | Rækker/formfelter kan krympe; knapper ombrydes |
| 375 | 18,75 | 337,5 | Samme mobilregler |
| 390 | 19,5 | 351 | Samme mobilregler |
| 430 | 21,5 | 387 | Samme mobilregler |

| Skærm | Kontrolleret i kode ved alle fire bredder |
| --- | --- |
| Home | Kompakt composer, højst 3 workspace-rækker, 6 events, fuld command-tekst ved expansion |
| Projects list | Titel før metadata, lange titler ombrydes, hele rækken er link |
| Project editor | Fuldbredde input, labels, 48 px actions, form-actions kan wrappe |
| Decisions list | Fleksible søge/filterfelter, links, roligere status/due-tekst |
| Decision editor | Syv sammenfoldelige sektioner, stacked scores, én action area, ingen matrix |
| More | Simple fuldbredde menurækker, ens ikonstørrelse, sekundær forklaring |
| Settings | Data samlet; installation foldet væk; lange backup-tal/IDs kan ombrydes |
| Diagnostics | Lange fejl/paths ombrydes; monospace reserveret til systemtal/status |

Minimum touch target er 44 px for links/composer-send, 48 px for primære knapper
og inputs, 52 px for bottom-nav. Hele activity-row er touch target.
Bottom-nav bruger safe-area-inset-bottom; main reserverer navhøjde + ekstra luft.
VisualViewport/fokus-hook fra v0.2.0 er bevaret. Lange tekster, visible focus og
prefers-reduced-motion er håndteret i CSS. Ingen dekorative animationer.

**Fysisk uafklaret:** Faktisk 320 px horizontal scroll, notch/home-indicator,
iOS tastatur/rotation, native date/select/file inputs og Safari text zoom.

## Fysisk acceptance efter ZIP-upload

Brug en sikker JSON-backup og test-records til destruktive handlinger.

- [ ] Actions: build, install og deploy er grønne; ZIP fjernet automatisk.
- [ ] Eksisterende Home Screen-app åbner; Diagnostics viser 0.2.1, schema 2, 8/8 PASS.
- [ ] Eksisterende projekter, beslutninger, scores, commits/reviews og aktivitet er intakte.
- [ ] Project CRUD og gemt Command virker efter luk/genåbn.
- [ ] Tryk på projektaktivitet åbner det konkrete projekt.
- [ ] Tryk på beslutningsaktivitet åbner den konkrete beslutning og viser Decision.
- [ ] Slet et test-element: historikken står tilbage med “Ikke længere tilgængelig”
      uden link/pil eller navigation til en manglende side.
- [ ] En lang Command kan foldes ud, læses helt og foldes sammen igen.
- [ ] Fortsæt viser højst tre aktuelle elementer og åbner begge typer korrekt.
- [ ] Home, Projects, Project editor, Decisions, Decision editor, Mere, Settings
      og Diagnostics føles rolige og har læsbar tekst uden afskårne actions.
- [ ] Kontrollér normal iPhone-bredde og om muligt en 320 px visning.
      Hvis 320 px ikke er tilgængelig, registrér “ikke testet”.
- [ ] Kontrollér portrait/landscape, lange titler/tekst, safe areas og bottom-nav.
- [ ] Åbn tastatur i Command og begge editors; felter og actions kan nås.
- [ ] Scroll en draft: Gem kladde er tilgængelig; Beslut vises kun ved gyldigt input.
      Gem, genåbn og kontrollér indhold. Ingen automatisk gemning.
- [ ] Beslut → genåbn → re-decide; tidligere snapshots/reviews er uændrede.
- [ ] Eksportér backup, vælg den fra Filer, se preview, bekræft restore med testdata.
      Recovery kan eksporteres/restores; ugyldig JSON ændrer ikke data.
- [ ] Efter online indlæsning og SW PASS: luk helt, åbn i flytilstand, navigér,
      læs data og gem en testkladde. Genåbn igen.
- [ ] Ved en senere ventende release: tryk Opdatér og genåbn uden ugemt arbejde.
      Kontrollér ny version efter én genindlæsning.
- [ ] Samme update med ugemt draft/Command/review må være blokeret.
      Andre åbne Logic Core-vinduer skal give vejledning om at lukke dem.
- [ ] Startup recovery: ved realistisk opstået indlæsningsfejl vises hjælp senest
      efter 12 sekunder; Genindlæs/Søg efter opdatering må ikke slette data.
      Fremprovokér ikke korruption i dine rigtige data for at teste dette.

Ny message-baseret activation kan ikke fysisk bevises alene ved at åbne en
v0.2.1-app uden en waiting worker. Registrér “afventer næste release”, hvis den
ikke kan testes naturligt. Automatisk protokol- og timeout-test er gennemført.

Anbefalet næste milestone: fysisk acceptance af denne polish-release og en
kontrolleret efterfølgende opdatering, som beviser den nye update-knap i den
eksisterende PWA. Udvid først derefter produktets moduler.
