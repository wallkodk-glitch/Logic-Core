# v0.3.0 — Validation

App **0.3.0**, schema **3**. Baseline v0.2.1:
`5df92a0b2c326ff1047caeb1fccd461c8aeb17f6`.
Checks nedenfor er faktisk kørt i byggemiljøet. Fysisk iPhone-acceptance er separat.

## Fresh automated verification

| Check | Resultat |
| --- | --- |
| npm ci --no-audit --no-fund | Exit 0; 26 locked packages |
| npm test — Node | 332 PASS, 0 FAIL, 0 skipped, 0 cancelled, 0 todo |
| npm test — Python release controller | 27 PASS, 0 FAIL, 0 skipped |
| **Samlet** | **359 PASS, 0 FAIL, 0 skipped** |
| npm run typecheck | Exit 0 |
| PAGES_BASE_PATH=/Logic-Core npm run build | Exit 0; inkluderer typecheck |
| Vite | 80 modules, production target safari16.4 |
| PWA/build verifier | PASS; 11 app-shell URLs; /Logic-Core/ |
| Workflow/generator --check | PASS |
| YAML syntax / run-step bash -n | PASS; 2 workflows, 12 shell-steps |
| Protected workflow/controller/template/generator/packager bytes | Identiske med accepteret v0.2.1 |
| Dependency diff | 0 nye/opgraderede dependencies; kun package/appversion |

Node **24.19.0**, npm **11.9.0**, Python **3.12.14**.
Vite output: index 5.58 kB (gzip 2.15), CSS 16.09 kB (gzip 4.03), JS 336.16 kB
(gzip 100.41). PWA build-hash: **3c650ec7e7fba49e**. Npm's miljøspecifikke
http-proxy-advarsel ændrede ikke exit-status; ingen npm-opgradering blev foretaget.

## Regression og nye cases

Den accepterede baseline blev først kørt uændret: 201 Node + 27 Python = 228 PASS.
Alle gamle cases er bevaret. Schema-afhængige forventninger er flyttet fra current 2 /
future 3 til current 3 / future 4. Gamle v0.1/v0.2-fixtures er uændrede.
**131 nye Node-cases** supplerer regressionerne.

- Migration: v1 → v2 → v3 og v2 → v3, eksakte eksisterende records/revision/commits/
  reviews, determinisme, idempotens og raw preservation ved failed write.
- Opportunity: exact shapes, IDs, enums, dates, ranges, unikke keys/refs, foreign keys,
  tekst/array/byte-bounds, CRUD, monotone timestamps, stale/quota/reload og history.
- Bridge: single/batch, preview uden writes, explicit confirmation, malformed/future/
  partial batch, caps, duplicate keys, canonical duplicates, metadata-only duplicates,
  ny version, lokale felter/links bevaret og atomic failure. Det downloadbare eksempel
  testes gennem den faktiske preview/import-kontrakt.
- Source snapshots: deepFreeze, immutable tidligere bytes og ingen dubletter; ingen
  statusvalg fra signal. Signal-formel, null ved inkomplet input og risiko-invertering.
- Relations: atomisk cleanup ved Project/Decision-delete; Opportunity-delete bevarer
  andre entities; draft/opportunity-backlink i samme write, ingen automatisk selection.
- Derived: Drift på konkrete commit-felter, first/latest, reviews/due og ingen mutation;
  Attention og Fortsæt har deterministisk sortering, caps og statusfiltrering.
- Navigation: alle dirty-ejere, confirm/cancel, route-state, one-prompt, hashchange/back,
  actual router event binding, internal/external links og beforeunload.
- Backup/recovery: schema 1/2/3, preview-count, invalid Opportunities før write, recovery
  med Opportunities, quotas/stale/journal og eksisterende roundtrips.
- UI: React SSR af eksisterende og nye skærme, links, actions, plain text escaping,
  source history, activity-classification og H1-regression med startup + app markup.

H1-testen blev kontrolleret ved midlertidigt at genindføre den gamle globale selector:
den fejlede, fordi startup-heading fik focus. Den scoped selector består.

Auditen fandt også, at en invalid Bridge ved commit ellers kunne nå transaction-
housekeeping før JSON-parse. Regressionstesten fejlede med en pending recovery-journal.
Parse sker nu før transaction; ugyldig JSON lader både primary og recovery stå urørt.
Recovery-journalens egen implementation er byte-identisk med baseline.

## PWA og release

Alle eksisterende offline/startup/worker/update-controller tests er bevaret og genkørt.
De udfører leveret startup-script/worker i isolerede adapters og tester explicit ACK,
one-window, dirty block, timeout, late replies, controllerchange-rækkefølge og én reload.
Ingen tests rydder brugerdata; fixtures bruger isoleret MemoryStorage.

Python-controllerens 27 cases dækker archive/root/traversal/corruption, required files,
symlinks/collisions, bounds, equal/downgrade, lockfile mismatch, protected workflows,
digest/source mismatch, metadata, lokal Git commit/push, push-rejection og main advance.
Workflow permissions/gates/triggers er desuden statisk auditeret. Ingen pipeline-refactor.

Den separate **RELEASE_REPORT_v0.3.0.md** indeholder checksum/filantal, endelig archive-
validation, build-filhases og den konkrete staged release-rehearsal fra v0.2.1.
En lokal Git rehearsal er ikke en GitHub-hosted Pages-deployment.

## Statisk UI-review og fysisk grænse

Command, Projects/list/editor, Decisions/list/editor, More, Settings, Diagnostics og
Opportunity/list/editor/Bridge er gennemgået for responsive struktur ved 320, 375,
390 og 430 CSS px: min-width:0, wrapping, 16px form-inputs, 44–48px targets, safe-area,
keyboard/landscape sticky-regler, disclosures og reduced motion. Intet globalt overflow
hidden er tilføjet. Dette er statisk audit, ikke målt browserlayout.

Browser rendering blev forsøgt, men lokal preview-URL blev afvist med
ERR_BLOCKED_BY_CLIENT. Faktisk pixel/overflow, iOS keyboard/safe-area, portrait/landscape,
Files/download, VoiceOver og fysisk persistence er **pending**. GitHub Actions/Pages
og v0.2.1 → v0.3.0 Home Screen-update afventer Jakobs upload og acceptance.
Se docs/OPPORTUNITY_INTELLIGENCE.md og release-rapportens sekvens.
