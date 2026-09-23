# Foundation status — v0.2.1

**Foundation og ZIP-only release pipeline: LOCKED**, baseret på Jakobs oplyste
fysiske acceptance af v0.2.0. **v0.2.1's fysiske acceptance afventer deployment.**
De to statusser må ikke forveksles.

## Accepteret source

Repository: wallkodk-glitch/Logic-Core, main.
Commit: 516027d5a917541ceee76df7cf82d94eeb5792ed — Install Logic Core v0.2.0 mobile release.
80/80 lokale baseline-filer blev verificeret mod GitHub Git blob-hashes.
Main blev genkontrolleret efter afbrudte arbejdssessioner og var uændret.

v0.2.0 havde ifølge Jakob fungerende Decision Engine, Project/Command,
backup/recovery, offline PWA og Diagnostics 8/8 på fysisk iPhone.
v0.2.1 ændrer præsentation og startup/update-adfærd, ikke det accepterede datalag.

## Låste identiteter

- Data schema 2; ingen ny migration.
- Primary key: logic-core:/Logic-Core/:data.
- Recovery key: logic-core:/Logic-Core/:data:recovery.
- Pages origin/base: https://wallkodk-glitch.github.io/Logic-Core/.
- Manifest id ./, start_url ./#/, scope ./, display standalone.
- Manifestets to farver følger det nye design; øvrig manifest-identitet og ikoner
  er uændrede.
- Afhængigheder, store, schema, validation, backup og recovery er byte-identiske
  med v0.2.0. Den eksisterende v1 → v2-migration er bevaret.

## Låst release-system

Protected workflow SHA-256:

- deploy.yml: 174cac52436afe120843118d78ed7c1a717d3f93ee24b368d2bf4601ffcc7f4b
- mobile-release.yml: 089bce6379f1d6ad4a72362e54ae737dc4b4b2cdcea3312ae84512e3b91ad705

Begge workflows, trusted controller, generator, template og package-release.py
er byte-identiske. Mobile setup-node bruger fortsat Node 24 uden den tidligere
runner.temp cache-indstilling.

Build/test foregår før source-installation med read-only source-permissions.
Kun isoleret install-job har contents: write; archive-leveret npm/script kører
ikke dér. Installer genvaliderer digest og current main, bevarer workflows og
metadata og bruger non-force push. Samme/lavere appversion afvises.

ZIP-only upload trigger mobile-workflowet. Standard deploy springer ZIP-only
push over og blokerer desuden ved en ventende ZIP. Bot-commit med GITHUB_TOKEN
forudsættes ikke at starte et nyt workflow; samme mobile run deployer artifact.

Snapshot synkroniserer kun src, public, scripts, tests, docs samt .gitignore,
README.md, index.html, package.json, package-lock.json, tsconfig.json,
vite.config.ts og valgfri LICENSE. .git, workflows og unmanaged metadata beskyttes.
ZIP indeholder ikke node_modules, dist, git, caches eller secrets.

## Databeskyttelse og opdatering

Ingen partial import eller silent reset. Preview, eksplicit restore, fuld
validation, atomisk primary-write og recovery-journal er uændrede. Historik er
immutable gennem appens API; importerede dokumenter er ikke kryptografisk signerede.

Opdateringssamtykke er kun midlertidig UI-state. Ingen ny persistent field.
Appen blokerer opdatering ved kendt ugemt arbejde. Waiting worker kræver, at
afsenderen er det eneste åbne app-vindue. Kun et aktivt, eksplicit update-request
kan give reload efter worker-acknowledgement og controllerchange. Naturlig
worker-activation ved lukning af alle vinduer følger browserens normale lifecycle.

v0.2.1 er en leveret release med automatiseret validation; fysisk iPhone- og
GitHub-hosted release-acceptance skal registreres efter Jakobs ZIP-upload.
