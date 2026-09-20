# v0.1.2 — Validation

Baseline: accepteret main `5294f5243fd5b5c8c7147c0d8fa6f78be40917ab`.
App 0.1.2, data schema 1. Følgende er faktisk kørt i byggemiljøet:

| Check | Resultat |
| --- | --- |
| npm ci --no-audit --no-fund | Exit 0; 26 locked packages |
| npm test, Node | 65 PASS, 0 FAIL, 0 skipped |
| npm test, Python release suite | 27 PASS, 0 FAIL |
| npm run typecheck | Exit 0 |
| Production build, /Logic-Core/ | Exit 0; 43 moduler |
| PWA/build verification | 10 app-shell URLs; assets, ikoner, manifest og worker PASS |
| Generator --check | PASS; indlejret controller matcher |

Build-output: index 1.34 kB, CSS 14.26 kB, JS 262.30 kB (gzip 81.37 kB).
Node 24.19.0, npm 11.9.0, Python 3.12.14. Ingen dependencies er opgraderet.
Den normale npm-advarsel om byggemiljøets http-proxy-konfiguration påvirkede ikke checks.

Archive-validering, protected-workflow byte identity og fuld filliste kontrolleres
af den uændrede pakker og installer før leverancen fastlåses. Begge workflow-filer
og setup-node-fixet er byte-identiske med accepteret main. Ingen source-write
permission er tilføjet til standard deploy.

Ændrede filer: package.json, package-lock.json, README.md, docs/FOUNDATION_LOCK.md,
docs/VALIDATION.md og docs/FILE_TREE.txt. Ingen runtime-kode er ændret.

Kendte begrænsninger er de samme som i v0.1.1: localStorage er ikke ekstern backup,
én aktiv editor anbefales, og en PWA-opdatering kan kræve onlinebesøg + luk/genåbn.

Fysisk GitHub/iPhone acceptance af denne release er ikke udført i byggemiljøet.
Følg README. Den accepterede v0.1.1-status er brugerbekræftet og må ikke forveksles
med en allerede udført v0.1.2-installation.
