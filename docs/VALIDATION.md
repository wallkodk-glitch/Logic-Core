# v0.2.0 — Validation

Validation i byggemiljøet; ikke en påstand om fysisk iPhone/GitHub acceptance.
Udgangspunkt: accepteret v0.1.1 main 5294f5243fd5b5c8c7147c0d8fa6f78be40917ab,
derefter fastlåst v0.1.2 source commit 7f1d70a. App 0.2.0, schema 2.

## Udførte automatiske checks

| Check | Faktisk resultat |
| --- | --- |
| npm ci --no-audit --no-fund | Exit 0; 26 locked packages |
| npm test — Node | 141 PASS, 0 FAIL, 0 skipped |
| npm test — Python release tests | 27 PASS, 0 FAIL |
| Total automated tests | 168 PASS, 0 FAIL |
| npm run typecheck | Exit 0 |
| PAGES_BASE_PATH=/Logic-Core/ npm run build | Exit 0; 54 moduler |
| PWA/build verifier | PASS; 10 app-shell URLs, korrekte assets, ikoner, manifest og worker |
| Generator --check | PASS; workflow/controller/template konsistent |
| Begge workflows | YAML parse + shell syntax + permissions + byte identity PASS |
| Git diff whitespace check | PASS |
| Eksisterende release-scripts / package-contract | Byte-identiske med accepteret baseline |
| Manifest, registration, storage-key, base config | Byte-identiske med accepteret baseline |

Node 24.19.0, npm 11.9.0, Python 3.12.14. Ingen dependencies opgraderet.
Build-output: index 1.34 kB; CSS 16.20 kB (gzip 4.32); JS 295.94 kB (gzip 90.32).
PWA build hash: 20139b26ae753739; scope /Logic-Core/.
Npm advarer om miljøets http-proxy-config; alle nævnte checks afsluttede med exit 0.

## Suiteopdeling

| Node-suite | Tests |
| --- | ---: |
| backup.test.ts | 43 |
| config.test.ts | 3 |
| decision-ui.test.ts | 3 |
| decisions.test.ts | 25 |
| migration.test.ts | 47 |
| offline.test.ts | 6 |
| storage.test.ts | 14 |
| I alt | 141 |

Eksisterende Project CRUD, Command/activity, stale writes, quota-fejl og recovery
bevares. Legacy-forventninger er tilpasset den eksplicitte migration; den gamle
v0.1 fixture er ikke ændret.

Decision-tests dækker draft CRUD/reload, valg uden projekt, projekt-unlink,
atomisk write failure, complete/incomplete/invalid scoring, ties, ingen criteria,
manuelt valg af lavere score, decide/reopen/re-decide, immutable snapshots,
append-only reviews, close/archive/delete, stale writers, due-datoer, tekst-/array-
og historikgrænser samt 300-event-begrænsningen.

Migration-tests dækker pure v1→v2, bevarede projects/activity/revision, boot-write,
read-only fejltilstand ved mislykket migration, unknown/corrupt schemas,
schema 1-preview/restore, schema 2 roundtrip, v1 recovery og gamle pending journaler.
36 malformed v2-varianter afvises både ved preview og ved write-boundary restore
uden ændring af primary eller recovery.

React-renderingstests udfører de faktiske options-, scoring- og history-components:
labels, escaping, stacked markup, beregnede signaler og bevaret historisk indhold.
De tester ikke DOM-interaktioner, pixel-layout, keyboard eller touch.

Offline-tests udfører den faktiske worker-template i Node VM med fake Cache API:
precache, scoped oprydning, cached app-shell/assets, afgrænsning til egen app og
fejlet worker-installation uden sletning af gammel cache. Ikke en fysisk iOS-test.

## Release-controller og fejltilstande

De eksisterende 27 Python-tests er uændrede og faktisk kørt. De dækker corrupt/
missing ZIP, forkert root, alle required files, traversal/absolute paths,
forbudte payloads, symlinks/special files, collisions, size cap, ugyldige/ens/lavere
versioner, lockfile-mismatch, protected workflows, digest-mismatch, ændret stage,
staging protection, rigtig lokal Git install/commit/push, push-rejection,
concurrent main advance, metadata preservation og workflow permission/gate-order.

Npm-install-, test-, TypeScript- og Vite-failure er beskyttet af normale fail-fast
steps og install.needs: build; gate-rækkefølgen er testet/statisk auditeret.
Faktiske fejl i GitHub-hosted npm/Pages-infrastruktur er ikke fremprovokeret her.
Pages-deployment kan først ske efter build og install; den eksisterende live-app
slettes ikke bevidst ved en tidligere fejl.

Den separate leveringsrapport indeholder SHA-256, archive-validation og resultater
af lokal fuld sekvens v0.1.1 → ZIP A → v0.1.2 → ZIP B → v0.2.0.
Ingen sådan simulation kaldes en rigtig GitHub Pages-deployment.

## Kendte begrænsninger / fysisk acceptance

Browser-runtime blev forsøgt mod lokal app, men returnerede
net::ERR_BLOCKED_BY_CLIENT. Derfor **IKKE TESTET fysisk**:

- iPhone/Safari UI, 320 px overflow, touch og keyboard.
- Service-worker upgrade på eksisterende installeret iPhone.
- iOS Files download/import dialogs og faktisk lokal persistens efter OS-lukning.
- Nye GitHub-hosted Actions-runs og Pages-publicering af A/B.

Disse checks udføres af Jakob med README-checklisten efter ZIP-upload.
Bevar pre-upgrade JSON i Filer, brug samme installerede app, og installér A før B.

Andre grænser: manuelle draft-saves; én aktiv editor anbefales; ingen cloud-backup
eller push reminders; iOS kan rydde lokal storage; immutable betyder app-adfærd,
ikke kryptografisk autenticitet af importeret JSON. V0.1.x kan ikke læse schema 2.
