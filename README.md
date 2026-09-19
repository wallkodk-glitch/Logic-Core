# Logic Core · Foundation v0.1.1

Den accepterede v0.1-app med valideret JSON-restore, lokal recovery og en permanent
release-pipeline fra iPhone. React / TypeScript / Vite, lokalt schema **1**.
Ingen backend, login, telemetry, API-nøgler eller cloud-sync.

## Engangsinstallation fra v0.1 på iPhone

Brug det eksisterende repository **wallkodk-glitch/Logic-Core**, branch **main**.
Gem `logic-core-mobile-release.zip`, `deploy.yml` og `mobile-release.yml` i **Filer**.
ZIP-filen skal ikke pakkes ud.

1. I den nuværende installerede Logic Core: **Indstillinger → Eksportér data som JSON → Gem i Filer**.
2. I Safari på GitHub: åbn repositoryets **`.github/workflows/`**-mappe. Vælg **Add file → Upload files** og upload begge YAML-filer dér: erstat `deploy.yml`, opret `mobile-release.yml`. Commit til **main**. Vent på grønt **Deploy Logic Core**.
3. Gå til repositoryets **rod**. **Add file → Upload files → Browse/Gennemse**: vælg præcis `logic-core-mobile-release.zip`, og commit til **main**.
4. Åbn **Actions → Mobile release Logic Core**. Vent på grønne **build → install → deploy**. Source opdateres, og ZIP-filen fjernes automatisk fra main.
5. Åbn [Logic Core](https://wallkodk-glitch.github.io/Logic-Core/) eller **Settings → Pages → Visit site**. Åbn online, luk derefter alle Logic Core-vinduer og den installerede app, og start igen fra dit eksisterende hjemmeskærmsikon. Kontrollér **0.1.1** i Diagnostics. Gentag luk/genåbn, hvis en opdatering stadig venter.
6. Kør iPhone-testen nedenfor. Slet ikke appen eller Safari-data for at opdatere.

Hvis upload-knappen mangler: vælg **Anmod om websted til computer** i Safari.
YAML-filerne skal ligge i `.github/workflows/`, ikke i roden. Upload begge filer
uden at ændre deres indhold; release-valideringen kontrollerer dem byte for byte.

**Hvorfor to workflow-filer denne ene gang?** `GITHUB_TOKEN` med `contents: write`
kan ikke selv installere workflow-ændringer. Derfor erstattes den gamle bootstrap
manuelt, og fremtidige ZIP-releases beskytter workflows mod ændring.
Se [GitHubs dokumentation om workflow-permission](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents).

Pages er allerede sat til **GitHub Actions**. Ved permissions-fejl: kontrollér
**Settings → Actions → General → Workflow permissions → Read and write permissions**.
Kun mobile-workflowets install-job anmoder om source-write. Branch protection eller
organisationspolitik kan stadig blokere bot-push; et sådant run deployer ikke.

## Fremtidig release: én ZIP

1. Eksportér en backup fra Logic Core.
2. Upload **`logic-core-mobile-release.zip`** til repositoryets rod, commit til **main**.
3. Vent på grønt **Mobile release Logic Core**, genåbn appen, og kontrollér den nye version og Diagnostics.

Astra skal levere et komplet root-snapshot med en **højere** app-version og identiske
beskyttede workflows. Samme/lavere version afvises. Normale app-releases kræver kun
ZIP-upload. En fremtidig ændring af selve workflows kræver igen en eksplicit manuel
workflow-upload; løsningen bruger ingen PAT eller ekstra secrets.

## iPhone acceptance

- Kontrollér eksisterende projekter og aktiviteter før nye ændringer. **Diagnostics: 0.1.1, schema 1, 8/8 PASS online**.
- Opret, redigér og slet et testprojekt. Send en Command. Luk/genåbn og kontrollér persistence.
- Eksportér backup **A** til Filer. Opret derefter testprojekt **B**.
- Importér A: preview skal vise versionsoplysninger og antal. **Fortryd** først; B skal stadig findes.
- Importér A igen, sæt bekræftelsesfeltet, og vælg **Gendan og erstat data**. B skal være væk; recovery skal findes.
- Vælg **Eksportér recovery → Gem i Filer**. Vælg derefter **Gendan tidligere snapshot**, gennemgå preview og bekræft. B skal komme tilbage, også efter luk/genåbn.
- Importér en anden JSON-fil med forkert struktur, hvis du har en i Filer. Den skal afvises uden dataændring. Automatiske tests dækker også ugyldig JSON og korrupte dokumenter.
- Slet recovery via den separate bekræftelse. Projekter/aktiviteter skal være bevaret.
- Kontrollér navigation, portrait/landscape, tastatur og ingen vandret scrolling. Efter service worker PASS: luk og genåbn offline. Online-checket viser forventeligt FAIL i flytilstand.

## Ved et fejlet release-run

- **Validering / npm / tests / typecheck / build fejler:** gammel source og live app bevares; den uploadede ZIP bliver i main. Erstat den med en rettet ZIP, eller slet kun ZIP-filen. Slet ikke app-data.
- **Push fejler:** remote source og ZIP bevares; ingen deployment. Ret den viste permissions-/branch-fejl og kør mobile-workflowet igen på main.
- **Pages fejler efter install:** den testede source er committed, ZIP er fjernet. Kør **Actions → Deploy Logic Core → Run workflow → main** for at bygge/deploye samme installerede version igen.
- **main er ændret under runnet:** den forældede release stopper. Se hvilken version der nu ligger i main, før du uploader igen.

## Arkitektur og tekniske checks

Det eksisterende AppShell, hash-navigation, projekt-CRUD og PWA-layout er bevaret.
`AppStore` ejer storage. `schema.ts` validerer v1; `backup.ts` validerer og serialiserer
backup; `recovery.ts` beskytter den tidligere rå primary med en lille journal.
Import-preview og recovery-knapper ligger i `DataTools` under Indstillinger.

| Område | Ansvar |
| --- | --- |
| `src/app`, `src/pages`, `src/components` | Eksisterende app og lokal backup-UI |
| `src/domain`, `src/storage` | TypeScript-modeller, v1-validering, atomisk primary-write, recovery |
| `src/pwa`, `public`, `scripts/build-pwa.mjs` | Uændret PWA-fundament og offline-app-shell |
| `scripts/mobile_release.py` | ZIP-validering, staging, afgrænset source-sync og bot-commit |
| `.github/workflows/deploy.yml` | Almindelige source-commits; ingen source-write |
| `.github/workflows/mobile-release.yml` | ZIP-trigger; read-only build, isoleret install, Pages-deploy |

[Foundation-rapport](docs/FOUNDATION_LOCK.md) · [Præcis validering](docs/VALIDATION.md) · [File tree](docs/FILE_TREE.txt).

Build-miljøet bruger **Node 24** og **Python 3** (allerede på Ubuntu GitHub runners).
Det kræver ingen installationer på Jakobs iPhone. Dependencies er uændrede fra v0.1.

```sh
npm ci --no-audit --no-fund
npm test
npm run typecheck
PAGES_BASE_PATH=/Logic-Core/ npm run build
python3 -B scripts/package-release.py --output /tmp/logic-core-release
```

`npm run build` inkluderer typecheck og verifikation af Pages-assets, manifest og worker.
Workflowet bruger Pages' faktiske `base_path`. Bevar URL/base path for at bevare samme
storage-key: `logic-core:/Logic-Core/:data`; recovery bruger samme key + `:recovery`.

Recovery og primary ligger begge lokalt. Safari/iOS kan fjerne lokale data; eksport i
Filer er den separate backup. Luk andre Logic Core-faner før restore. Importgrænsen
er 8 MiB, og der er én pre-restore snapshot, ikke en versionshistorik.

Næste milestone er **Foundation acceptance på fysisk iPhone og én efterfølgende
ZIP-opdatering**, før foundation erklæres LOCKED. Decision Engine startes ikke her.
