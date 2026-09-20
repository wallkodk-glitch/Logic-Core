# Foundation status — v0.2.0

## Accepteret udgangspunkt

v0.1.1 main: `5294f5243fd5b5c8c7147c0d8fa6f78be40917ab`.
64/64 source-filer blev verificeret med Git blob-hashes mod GitHub.
Jakob har bekræftet fysisk iPhone, Diagnostics 8/8, offline, backup/recovery og
mobile build/install/deploy PASS. Den status gælder baseline, ikke de nye releases.

## To separate releases — fast rækkefølge

1. **v0.1.2 / schema 1:** minimal Pipeline Proof. Kun app/package-version og de
   fire relevante dokumenter ændres. Ingen runtime-, test-, pipeline- eller
   schemaændring. ZIP SHA-256:
   `34858f6a2e39c3fa04733c0541f04617d83029ca6544c32f6840af0023e66e07`.
2. **v0.2.0 / schema 2:** denne source er baseret på netop den fastlåste v0.1.2
   source-state (lokal predecessor commit `7f1d70a`). Decision Engine samt
   eksplicit migration tilføjes uden at ændre release-kontrakten.

**Foundation LOCKED: AFVENTER Jakobs fysiske v0.1.2 ZIP-only acceptance.**
Når den består, kan status registreres LOCKED med dato/Actions-run; der kræves
ingen kildefilredigering fra iPhone. Installér først derefter v0.2.0.
v0.2.0's egen acceptance er en separat gate.

## Låste identiteter og release-kontrakt

Begge workflows, trusted controller, generator, template, pakker, setup-node-fix,
Pages-base, storage-key og PWA install identity er uændrede fra accepteret main.

Protected workflow SHA-256:

- deploy.yml: `174cac52436afe120843118d78ed7c1a717d3f93ee24b368d2bf4601ffcc7f4b`
- mobile-release.yml: `089bce6379f1d6ad4a72362e54ae737dc4b4b2cdcea3312ae84512e3b91ad705`

Read-only stage/build/test først. Kun isoleret install-job har contents: write;
intet archive-leveret npm/script køres dér. Controller genvaliderer ZIP-digest
og current main før installation; push er non-force. Same/lower version afvises.
GITHUB_TOKEN-commit starter ikke et ekstra push-run; samme mobile run deployer
allerede testet artifact. ZIP-only push starter ikke normal deploy.

Et fuldt source-snapshot synkroniserer kun src, public, scripts, tests, docs samt
.gitignore, README.md, index.html, package.json, package-lock.json, tsconfig.json,
vite.config.ts og valgfri LICENSE. .git, .github-workflows og unmanaged metadata
beskyttes. ZIP må ikke indeholde node_modules, dist, git, caches eller secrets.

## Databeskyttelse

Ingen silent reset, lossful migration eller partial import. Fuld validation før
én primary write; recovery-journal bevarer raw pre-restore-data. Historiens app-API
er append-only. Imports valideres, men er ikke digitalt signerede beviser.
Samtidige faner har stale-detection, ikke en garanteret cross-tab transaction lock.
Bevar separat JSON-backup i Filer før upgrade og ved løbende brug.
