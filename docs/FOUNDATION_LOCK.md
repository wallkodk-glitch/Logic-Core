# Foundation status — v0.3.0

**Foundation og ZIP-only pipeline: LOCKED.** Jakob har fysisk accepteret v0.2.1:
Decision Engine, Projects/Command, backup/recovery, offline PWA, Diagnostics 8/8,
activity-navigation, Fortsæt, keyboard, portrait og landscape.
**v0.3.0's fysiske update-/feature-acceptance afventer deployment.**

## Accepteret source

- Repository: wallkodk-glitch/Logic-Core, main.
- Baseline commit: 5df92a0b2c326ff1047caeb1fccd461c8aeb17f6.
- Commit message: Install Logic Core v0.2.1 mobile release.
- Accepteret ZIP: 95 filer, SHA-256
  474f44c00f7c10f4d38f1d0a839ff85dd181526fe9aa1692d8e5530d1e95c235.
- 95/95 baseline-filer matchede GitHub Git blob-hashes ved dette commit.

## Identiteter og migration

Primary key: `logic-core:/Logic-Core/:data`.
Recovery key: `logic-core:/Logic-Core/:data:recovery`.
Pages: https://wallkodk-glitch.github.io/Logic-Core/.
Manifest: id `./`, start_url `./#/`, scope `./`, display standalone.
Manifest, ikoner, config og start-/worker-lifecycle er uændrede bytes.

Appversion 0.3.0 og schema 3 er adskilte. Schema 2 → 3 tilføjer opportunities: [].
Schema 1 → 2 → 3 understøttes. Eksisterende data/revision/timestamps bevares, uden
normalisering eller link-cleanup under migration. En fejlet migrationswrite bevarer
raw source og blokerer redigering. Recovery-journalens implementation er uændret.

## Låst release-system

| Protected workflow | SHA-256 |
| --- | --- |
| deploy.yml | 174cac52436afe120843118d78ed7c1a717d3f93ee24b368d2bf4601ffcc7f4b |
| mobile-release.yml | 089bce6379f1d6ad4a72362e54ae737dc4b4b2cdcea3312ae84512e3b91ad705 |

Workflows, scripts/mobile_release.py, mobile-workflow.template.yml,
generate-mobile-workflow.py og package-release.py er byte-identiske med v0.2.1.
Node 24 og det fungerende setup-node cache-fix er bevaret.

Build/test kører før source-installation med read-only source-permissions. Kun
isoleret install-job har contents: write; archive-leveret npm/script kører ikke dér.
Trusted installer genvaliderer digest og main, bevarer workflows/metadata og bruger
non-force push. Samme/lavere version afvises. ZIP-only push deployer ikke gammel
source via standard-workflowet. Mobile-runnet deployer selv artifact, uden at
forudsætte at GITHUB_TOKEN bot-commit starter et nyt workflow.

Snapshot synkroniserer kun src, public, scripts, tests, docs samt .gitignore,
README.md, index.html, package.json, package-lock.json, tsconfig.json,
vite.config.ts og valgfri LICENSE. .git, workflows og unmanaged metadata beskyttes.
Ingen dist/node_modules/caches/secrets/userdata i pakken.

## PWA og databeskyttelse

Ingen automatisk skipWaiting eller reload midt i arbejde. Waiting worker kræver
aktivt brugersamtykke, intet kendt ugemt arbejde og ét åbent app-vindue. ACK,
controllerchange, én reload, timeout-cleanup og late-reply-beskyttelse er uændrede.
Naturlig activation efter lukning af alle vinduer følger browserens lifecycle.

Startup fallback er stadig uafhængig af React; data ryddes aldrig automatisk.
Route-focus/title vælger nu kun #main-content h1, aldrig den skjulte startup-heading.
Pending-work tracking beskytter både PWA-opdatering og intern navigation.

Import valideres før writes. Source snapshots og Decision commits er immutable
gennem appens API/deepFreeze, men backups er ikke kryptografisk signerede.
Browserlagring er stadig enhedslokal; behold en ekstern JSON-backup i Filer.
