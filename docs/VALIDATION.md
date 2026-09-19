# Logic Core v0.1.1 — præcis valideringsstatus

Valideret i leverancemiljøet 2026-09-19. Den fysisk accepterede v0.1-baseline er
bevaret som grundlag. Resultater her gælder v0.1.1, med mindre andet er angivet.

## Kørte checks

| Check | Resultat |
| --- | --- |
| Baseline mod GitHub main | 50/50 v0.1-filer matchede Git blob-hash byte for byte |
| Node / npm / Python | 24.19.0 / 11.9.0 / 3.12.14 |
| `npm ci --no-audit --no-fund` | Exit 0; 26 packages installeret fra lockfile |
| `npm test` — Node | **65 tests, 65 pass, 0 fail, 0 skipped** |
| `npm test` — Python unittest | **27 tests, 27 pass**; inkluderer yderligere subcases |
| Samlet automatiseret suite | **92 tests bestået**; oprindelige 22 regressionstests bevaret |
| `npm run typecheck` | Exit 0; TypeScript strict, ingen typefejl |
| `PAGES_BASE_PATH=/Logic-Core/ npm run build` | Exit 0; Vite, typecheck og asset-verifikation består |
| Production app | 43 moduler; index, CSS, JavaScript, manifest og lokale ikoner bygget |
| PWA-generering | 10 app-shell URLs; korrekt `/Logic-Core/` scope; worker-syntaks valid |
| Pages base-konfiguration | Repo med præcis case `/Logic-Core/`, root, user site og custom-domain paths dækket |
| YAML-syntax | Begge workflows parsede med PyYAML 6.0.3 |
| Shell-syntax | Alle workflow-run-steps kontrolleret med `bash -n` |
| Permissions/trigger/gates | Auditeret via parsed YAML og automatiseret workflow-test |
| Embedded installer | Byte-identisk med Python-controller; compile og generator `--check` består |
| Source storage-audit | Eneste direkte localStorage-reference er bindingen i storage/context.tsx |

App-tests dækker CRUD i alle seks statusser, Command-persistence, genåbning af
store, schema, ugyldige data, stale editors, Diagnostics, hash-navigation,
Pages-base og eksekvering af den faktiske service worker-template i en isoleret
Cache API-test. Nye tests dækker legacy v0.1 primary/export, komplet restore,
preview, ingen mutation ved korrupt import, recovery-bytebevarelse, restore,
eksport, delete, stale preview, quota, dobbelt skrivefejl og afbrudt journal.

## Kørte release-simulationer

- Den rigtige controller pakkede en komplet release ud i separat staging ved siden
  af et lokalt Git-repository med oprindelig v0.1-source og de nye workflows.
- I staging kørte den rigtige `npm ci`, alle 92 tests, separat TypeScript-check og
  production build med `/Logic-Core/`; alle returnerede exit 0.
- Efter build blev samtlige source-bytes sammenlignet med ZIP; ingen forskel.
- Controlleren synkroniserede source, bevarede workflows/metadata, fjernede ZIP,
  committede som github-actions[bot] og push'ede til en **lokal** bare Git-remote.
  Installeret version 0.1.1, ren Git-worktree og korrekt remote commit blev verificeret.
- Unit-test med rigtig pre-receive-hook afviste Git-push: remote source og ZIP
  blev bevaret. En separat rigtig Git-test med nyere remote main stoppede før install.
- Fejl blev fremprovokeret i staging med rigtige kommandoer:

| Fejlindsprøjtning | Kommandoens exit | Remote source/ZIP |
| --- | --- | --- |
| Dependency afviger fra lock; offline cache tillader ikke pakken | npm ci: 1 | Uændret |
| Ekstra test med eksplicit assertion failure | npm test: 1 | Uændret |
| String tildelt et number-felt | TypeScript: 2 / TS2322 | Uændret |
| index.html henviser til manglende entry | Vite build: 1 | Uændret |

Fejlscenarierne kørte i separate/staged kildefiler. Den afsluttende succes-simulation
brugte en ren udpakning af release-ZIP. At GitHub springer downstream-jobs over ved
fejl er kontrolleret i workflow-grafen; GitHubs runner/deploy-service blev ikke
aktiveret fra dette miljø.

## Static audit

- Standard deploy: source-read-only; ingen gammel ZIP-bootstrap.
- ZIP-trigger på main, standard paths-ignore og ekstra ZIP-presence guard.
- Read-only mobile build uden gemte checkout credentials; source-write kun i
  isoleret install-job, som ikke kører archive-provided kode.
- SHA-256, versionskontrol, validerede archive paths, staging, sync-afgrænsning,
  workflow-beskyttelse, non-force push og freshness-checks.
- Build består før commit; samme mobile run deployer efter GITHUB_TOKEN-push.
- Ingen backend-, login-, telemetry- eller API-key-afhængighed ved første load.
- Appversion 0.1.1, schemaVersion 1 og oprindelig storage-key bevaret.

## Ikke fysisk kørt for v0.1.1

- GitHub-hosted Actions, GITHUB_TOKEN write-policy, branch protection og Pages-deploy.
- Fremprovokeret fejl i GitHubs faktiske Pages-service; failure-state er auditeret.
- React-flow i Safari, Files-picker/delingsark, standalone-opdatering, skærmrotation,
  safe areas, softwaretastatur og persistence efter en faktisk iOS-proceslukning.
- En faktisk efterfølgende v0.1.2+ ZIP-upload fra iPhone.

Disse punkter er **ikke markeret PASS**. Brug iPhone-testen i README. Den nye release
er klar til denne test; fysisk Foundation LOCKED-status afventer Jakob.
