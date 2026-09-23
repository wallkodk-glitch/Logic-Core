# v0.2.1 — Validation

App 0.2.1, schema 2. Accepteret baseline:
516027d5a917541ceee76df7cf82d94eeb5792ed (v0.2.0).
Resultaterne gælder faktisk kørte checks i byggemiljøet, ikke fysisk iPhone.
Efter to afbrudte sessioner blev source kontrolleret og hele suiten kørt igen.

## Automatiske resultater

| Check | Resultat |
| --- | --- |
| npm ci --no-audit --no-fund | Exit 0, 26 locked packages |
| npm test — Node | 201 PASS, 0 FAIL, 0 skipped/cancelled |
| npm test — Python release controller | 27 PASS, 0 FAIL |
| Samlet testantal | **228 PASS, 0 FAIL** |
| npm run typecheck | Exit 0 |
| PAGES_BASE_PATH=/Logic-Core/ npm run build | Exit 0, 62 moduler |
| PWA/build verifier | PASS, 10 app-shell URLs, scope /Logic-Core/ |
| Workflow/generator --check | PASS |
| Workflow YAML + run-step shell syntax | PASS, begge YAML-filer og 12 shell-steps |
| Protected workflow-byte-identitet | PASS |
| Data/store/validation/backup/recovery | Uændrede bytes mod v0.2.0 |
| Dependencies og lockfile | Kun app-version ændret; 0 nye/opgraderede dependencies |
| git diff --check | PASS |

Node 24.19.0, npm 11.9.0, Python 3.12.14.
Build: index 5.58 kB (gzip 2.15), CSS 15.14 kB (gzip 3.85),
JavaScript 298.49 kB (gzip 91.12). PWA build-hash: 6716e4c9046468dd.
Miljøets npm http-proxy-advarsel påvirkede ikke exit-status. Ingen npm-opgradering.

## Eksakte suiter

| Suite | PASS | FAIL |
| --- | ---: | ---: |
| backup.test.ts | 43 | 0 |
| config.test.ts | 3 | 0 |
| decision-ui.test.ts | 3 | 0 |
| decisions.test.ts | 25 | 0 |
| migration.test.ts | 47 | 0 |
| offline.test.ts | 6 | 0 |
| storage.test.ts | 14 | 0 |
| workspace.test.ts | 13 | 0 |
| update-controller.test.ts | 11 | 0 |
| startup.test.ts | 7 | 0 |
| worker-update.test.ts | 12 | 0 |
| upgrade-v021.test.ts | 3 | 0 |
| polish-ui.test.ts | 14 | 0 |
| test_release.py | 27 | 0 |
| **Total** | **228** | **0** |

Alle eksisterende testfiler og v0.1-fixtures er bevaret byte-identisk.
60 nye tests supplerer de 168 eksisterende tests.

Activity/recent: korrekte typer/routes, slettede targets, command expansion-target,
Unicode/encoded IDs, stabil tie-sortering, max 3 og ingen mutation.
Decision: samme validator/save-transaktion, valid/invalid input, ét contextual
save-control, read-only besluttede inputs, historik og eksisterende stale/write checks.

Startup: den faktisk leverede inline-script køres uden React i Node VM.
Timeout, bundlefejl, unhandled rejection, successful mount, manuel reload,
update-check, offline/legacy guidance og hung-request-timeout testes.
Worker-template køres med isoleret Cache API/clients: ingen implicit skipWaiting,
eksplicit message/ack, flere vinduer, fejlet activation, komplet/delvis/tom cache,
Cache API-fejl og online fallback. Eksisterende offline-tests består uændret.
Update-controller testes for begge eventrækkefølger, timeout, gamle replies,
ugemte ændringer, deduplikerede tryk og ingen reload uden samtykke.

En syntetisk fixture er genereret af den uændrede v0.2.0 AppStore. v0.2.1 åbner
den uden primary-write og bevarer projects, activities, decisions, scores,
commits og reviews. Backup/recovery roundtrip og newer-schema read-only recovery
testes uden sletning af brugerdata. Ingen rigtige brugerdata blev anvendt.

React-rendering udfører de faktiske komponenter for alle otte hovedskærme.
Kun browser-/store-adaptere udskiftes i SSR-testen. Markup-tests beviser labels,
links, disclosure-semantik, headings, actions og fejltekst; ikke touch/pixel-layout.

## Release-sikkerhed

27 eksisterende Python-tests dækker ZIP struktur og required files, corrupt ZIP,
traversal/absolute paths, forbidden payloads, symlink/special files, collisions,
size limits, equal/downgrade, package-lock mismatch, protected workflows, digest
og staged-source mismatch, metadata protection, lokal Git commit/push samt
push-rejection og concurrent main advance.

Installerens gate-rækkefølge og permissions er statisk auditeret.
Npm/test/typecheck/build-fejl kan ikke starte install/deploy. Den eksisterende
live-version slettes ikke ved disse fejl. Faktiske fejl hos GitHub Pages blev
ikke fremprovokeret.

Den separate RELEASE_REPORT_v0.2.1.md indeholder den endelige ZIP's checksum,
filantal, archive-validering og resultat af en lokal komplet release-rehearsal
fra v0.2.0. Rehearsal er ikke en GitHub-hosted deployment.

## Statisk UI-audit og fysisk testgrænse

Alle hovedskærme er gennemgået for 320, 375, 390 og 430 CSS px. Auditdetaljer og
acceptance findes i POLISH_FLOW.md. Browser-preview blev forsøgt, men browseren
afviste lokal URL med ERR_BLOCKED_BY_CLIENT. Derfor er faktisk layout/overflow,
iOS keyboard/safe-area, touch og landscape **ikke browser- eller fysisk testet**.

v0.2.1's GitHub-hosted Actions/Pages-run, iPhone Files-flow, fysisk persistence,
offline reopen og opdatering af eksisterende Home Screen-PWA afventer Jakob.
