# Foundation status — v0.1.2 Pipeline Proof

## Accepteret baseline

v0.1.1 main: `5294f5243fd5b5c8c7147c0d8fa6f78be40917ab`.
64/64 source-filer er verificeret med Git blob-hashes mod GitHub.

Jakob har bekræftet fysisk iPhone acceptance, Diagnostics 8/8, offline PWA,
backup/import/recovery og mobile build → install → deploy som PASS.
GitHub mobile run [35428251696](https://github.com/wallkodk-glitch/Logic-Core/actions/runs/35428251696)
blev også læst som successful under source-audit.

## Minimal v0.1.2-diff

Kun package/appversion (inklusive lockfile) og README / FOUNDATION_LOCK / VALIDATION /
FILE_TREE er opdateret. Ingen ændring i src, tests, public, dependencies, dataskema,
storage-key, build-scripts eller release-kontrakt. Workflows og generator/template
er uændrede fra accepteret main, inklusive setup-node-rettelsen.

## Foundation LOCKED — acceptance gate

Status: **AFVENTER fysisk v0.1.2 ZIP-only proof**.

Efter Jakobs acceptance kan dette dokument markeres **LOCKED** med dato og
Actions-run: kun ZIP uploadet; build/install/deploy PASS; Diagnostics 0.1.2/schema 1;
eksisterende data, CRUD, offline og backup/recovery PASS.

v0.2.0 bygges på den fastlåste v0.1.2 source, men skal ikke installeres før gate er bestået.

## Sikkerhedsmodel fastholdt

Read-only build/test før source-installation. Kun install-job har contents: write;
ingen npm/archive-scripts køres i dette job. Staging, path/shape/size-validering,
SHA-256, bytebeskyttede workflows, version monotonicity, non-force push og
freshness-checks er uændrede. Ingen PAT eller ekstra secrets.

Primary-write er atomisk for hele dokumentet; recovery-journal beskytter tidligere
raw bytes mellem to keys. Ingen silent reset eller fuld multi-tab-transaktionsgaranti.
Browser-/iOS-oprydning kan fjerne lokale data; eksport til Filer er den separate backup.
