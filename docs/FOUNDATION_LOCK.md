# Logic Core v0.1.1 — Foundation Lock release notes

Status: implementeret og lokalt valideret. GitHub-hosted v0.1.1-deployment og fysisk
iPhone acceptance udføres af Jakob efter upload. Foundation erklæres først LOCKED,
når den afsluttende acceptance er bestået.

## Baseline og scope

Alle 50 source-filer i den accepterede v0.1-leverance blev sammenlignet med blobs i
`wallkodk-glitch/Logic-Core`, main `08ffc9be54dcf29c05c62132bebae3afdec697a6`.
De matchede byte for byte. Ændringerne bygger videre på netop denne baseline.
Brugerens fysisk verificerede v0.1-resultater accepteres; de genpåstås ikke som
fysiske v0.1.1-tests.

Ingen framework-/dependency-opgradering, redesign, backend, AI, analytics, nye
produktmoduler eller cloud-sync. Projects, Command, navigation, Diagnostics,
Error Boundary, mobile safe areas og service worker-livscyklus er bevaret.

## Implementerede ændringer

- Appversion 0.1.1 i package og lock; dataformat forbliver schemaVersion 1.
- Import fra lokal JSON-fil, størrelsesgrænse, fuld validering, read-only preview,
  separat bekræftelse og opdatering af React efter en samlet primary-write.
- Støtte for det eksisterende v0.1-exportformat, nye backups med backupVersion 1,
  samt rå komplette schema 1-dokumenter.
- Validering af præcise object/array-shapes, revision, unikke string-IDs, statuses,
  activity-typer og kanoniske ISO-timestamps. Ukendt/fremtidigt/partial format afvises.
- Eksisterende raw primary gemmes umiddelbart før restore som recovery under en
  separat key. Preview tilbyder også eksport til Filer; recovery kan eksporteres
  efter restore. Appen påstår aldrig, at en download er gemt uden brugerens valg.
- Recovery-status, valideret restore med preview/bekræftelse, eksport og separat
  bekræftet permanent sletning. Restore af recovery gemmer det erstattede datasæt
  som det nye pre-restore snapshot.
- Parsing, writes og serialisering ligger samlet i storage-laget. UI kalder ingen
  localStorage-metoder. Storage events følger både primary og recovery.
- Gammel bootstrap fjernet fra standard deployment. Separat mobil-workflow og
  testbar Python-controller validerer/bygger før permanent source-commit.
- Deterministisk ZIP-pakker og væsentligt udvidede regression-/fejltests.

## Data-sikkerhed og atomicitet

Primary-key er uændret: `logic-core:/Logic-Core/:data`. Recovery-key er
`logic-core:/Logic-Core/:data:recovery`. Appversion og dataskema er uafhængige;
der udføres ingen opdigtet migration. Fixtures i `tests/fixtures` blev genereret
med den oprindelige v0.1 AppStore og indeholder kun syntetiske testdata.

Et browser-localStorage-system kan ikke lave én transaktion over to keys.
Derfor bruges en lille recovery-journal:

1. Parse og validér hele importen; vis preview. Ingen writes.
2. Ved eksplicit restore: validér igen og kontrollér begge raw keys mod preview.
3. Skriv en journal med tidligere recovery samt raw primary før/efter den planlagte restore.
4. Erstat hele primary i én `setItem`; dette er commit-punktet.
5. Afslut recovery til den snapshot, der svarer til den gennemførte primary-write.

En ugyldig import eller fejlet journal-write ændrer ingen keys. Fejler primary-write,
bevares primary og den oprindelige recovery gendannes. Fejler også rollback-write,
bevares den tidligere recovery inde i journalen; den er ikke gået tabt, selv om raw
recovery-key nu indeholder journalformatet. Genåbning afslutter ud fra primary.
Ved succesfuld primary-write og fejlet oprydning meldes succes med en tydelig
advarsel, recovery bevares, og yderligere writes blokeres indtil oprydning.

Hvis primary hverken matcher journalens før- eller efterværdi, blokeres writes,
og begge raw dokumenter kan eksporteres. Korrupte/nyere primary dokumenter nulstilles
aldrig automatisk. En eksplicit valid restore kan erstatte dem, men de originale
bytes bevares i recovery. Korrupte recovery-data kan eksporteres som nødkopi og
slettes med bekræftelse; de må ikke blindt importeres som normale app-data.

Dette er ikke fuld isolation mellem samtidige faner eller garanti mod iOS, der
rydder browserdata. Brug én aktiv editor under restore og gem separate backups i
Filer. Journalen kan kortvarigt kræve flere gange datasetstørrelsen; ved manglende
plads stopper restore før primary-commit. Importgrænsen er 8 MiB.

## Release-arkitektur

`mobile-release.yml` trigges kun på ZIP-stien ved push til main; manual dispatch
kan bruges til retry. `deploy.yml` ignorerer ZIP-only push og stopper desuden, hvis
en ZIP stadig findes, så et blandet source+ZIP-push ikke deployer gammel source.
Begge bruger samme concurrency-gruppe med `cancel-in-progress: false`.

| Job | Rettigheder | Arbejde |
| --- | --- | --- |
| Standard build | contents: read, pages: read | checkout uden gemte credentials, Node 24, npm ci, tests, typecheck/build/assets |
| Mobile build | contents: read, pages: read | valider ZIP, staging, Node 24, npm ci, tests, typecheck/build/assets, byte-verifikation, artifacts |
| Mobile install | contents: write | revalidér det testede artifacts SHA-256 og version; sync, fjern ZIP, commit og fast-forward push |
| Begge deploy-jobs | contents: read, pages: write, id-token: write | afvis forældet main, deploy det byggede Pages-artifact |

Ingen archive-provided script eller npm-lifecycle køres i jobbet med source-write.
Controlleren ligger verbatim i det allerede installerede workflow, så første
v0.1-upgrade virker uden eksisterende installer-script. Generator og tests sikrer,
at den indlejrede controller og den læsbare Python-fil matcher.

GITHUB_TOKEN kan ikke levere workflow-write gennem `contents: write`. Derfor
kræver engangsinstallationen både ny `mobile-release.yml` og erstatning af
`deploy.yml`. ZIP skal indeholde præcis de allerede installerede workflows;
forskelle afvises. Almindelige app-releases kræver herefter én ZIP. En fremtidig
ændring af workflows er en eksplicit manuel controller-opgradering.

Bot-commits med GITHUB_TOKEN udløser ikke et nyt almindeligt push-workflow.
Mobile-runnet fortsætter derfor selv med Pages-deployment. ZIP-sletningen laver
ingen rekursiv loop. Se [GitHub om token-triggeradfærd](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
og [workflow-permissions](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents).

## Præcis archive- og sync-kontrakt til Astra

Artifactnavn: **logic-core-mobile-release.zip**. Filer direkte i archive root.
Snapshot må ikke pakkes ind i en `logic-core-vX/`-mappe.

Synkroniserede mapper (filer, der er fjernet fra snapshot, fjernes også fra disse):
`src/`, `public/`, `scripts/`, `tests/`, `docs/`.

Synkroniserede root-filer: `.gitignore`, `README.md`, `index.html`, `package.json`,
`package-lock.json`, `tsconfig.json`, `vite.config.ts`, samt valgfri `LICENSE`.

Snapshot indeholder også `.github/workflows/deploy.yml` og
`.github/workflows/mobile-release.yml`, men de valideres kun og ændres aldrig af
installeren. `.git`, alle øvrige `.github`-metadata og øvrige root-metadata i
repositoryet bevares. Payloads til andre root-filer afvises. En ændring i denne
kontrakt kræver en bevidst controller-opgradering.

Validatoren afviser absolute paths, `..`, backslash/drive paths, tomme path-led,
symlinks/specialfiler, dubletter/case-kollisioner, file/directory-kollisioner,
`.git`, node_modules, dist, caches og kendte secret-filnavne. Alle entries læses
og CRC-kontrolleres før extraction. Grænser: 10 MiB ZIP, 30 MiB udpakket, 5 MiB
pr. fil, 1.000 entries. Krypteret eller ukendt komprimering afvises.

package.json, lock, main-entry, build/config-filer, tests og begge workflows er
påkrævet. Package/lock-versioner skal matche. Kun stabile numeriske `x.y.z`
versioner med **strengt højere** version end main accepteres; shell-lignende
versionsstrenge afvises. Ingen automatisk downgrade eller bypass.

ZIP må ikke indeholde node_modules, dist, .git, lokale caches eller secrets.
Filnavnsvalidering kan ikke bevise, at almindelig source er fri for indlejrede
secrets eller ondsindet kode. Astra skal stadig levere gennemgået source. Build-jobbet
kører source-kode med read-only token; dette er ikke en generel malware-sandbox.
Appens brugerdata ligger aldrig i release-ZIP eller Actions.

Fremgangsmåde for Astra: bump package og lock, bevar schema hvis kompatibelt, kør
checks, brug `scripts/package-release.py`, og lever kun den genererede ZIP til en
normal app-release. Ingen ændring af beskyttede workflows uden særskilt aftale.

## Failure modes og repository-state

| Fejl | Resultat / resterende state | Verifikation |
| --- | --- | --- |
| Korrupt ZIP | Stop før staging; gammel source, uploadet ZIP og live app bevares | Automatiseret |
| Forkert root | Stop før staging | Automatiseret |
| `../` / absolute path | Stop før staging; ingen fil skrives udenfor | Automatiseret |
| Manglende package/config | Stop før staging | Alle krævede filer afprøvet |
| npm ci fejler | Ingen install-job/source-commit/deploy; ZIP bliver | Faktisk fremprovokeret i staging + workflow-gates audit |
| Test fejler | Samme | Faktisk fejlet test-run i staging + gates audit |
| TypeScript fejler | Samme | Faktisk TS2322 i staging + gates audit |
| Vite fejler | Samme | Faktisk manglende entry i staging + gates audit |
| Pages fejler | Testet source er allerede committed, ZIP væk; run er fejlet. Retry standard deploy på main | Statisk audit; ikke fremprovokeret hos GitHub |
| Git push fejler | Ingen deploy; gammel remote source og ZIP bevares. Lokal runner-commit er midlertidig | Faktisk afvist push til lokal bare Git-remote |
| ZIP upload mens site er live | ZIP-only starter kun mobile; intet step rydder eksisterende Pages | Trigger-/workflow-audit; fysisk live test afventes |
| Samme version | Afvises før staging; ZIP bliver | Automatiseret |
| Lavere version | Afvises før staging; ZIP bliver | Automatiseret |
| main ændres under run | Refuse stale install/deploy; aldrig force push | Lokal Git-race-test + deploy-gate audit |
| Artifact ændres efter build | SHA-256/source-byte-kontrol afviser | Automatiseret |

Validering og build sker før det permanente source-commit. Ingen `rm -rf` af repo.
Ved en afbrudt lokal sync før push påvirkes kun den midlertidige Actions-checkout.
Branch protection kan afvise install; der kræves ikke en force-push-bypass.

Git og Pages er ikke én transaktion. Efter et succesfuldt push kan en senere
Pages-fejl efterlade ny testet source med tidligere live version. Intet workflow
sletter bevidst den gamle deployment. Retry fra standard workflow bruger den
allerede installerede version, så det er ikke nødvendigt at omgå versionstjekket.
En afbrydelse med uklar push-status skal afklares i main, før man prøver igen.

## Validering, begrænsninger og næste milestone

Se [VALIDATION.md](VALIDATION.md) for præcise kommandoer og testresultater.
Ingen v0.1.1-clouddeployment, fysisk iPhone-test eller Safari Files-delingsflow
påstås udført i leverancemiljøet. UI er bevaret og de nye controls er mobile,
men den fysiske tastatur/safe-area/Files-kontrol indgår i Jakobs acceptance.

Bevar eksisterende appinstallation og URL. Service worker installerer opdateringen
uden automatisk genindlæsning midt i en edit; luk alle app-vinduer efter onlinebesøg
for at aktivere den nye cache. Der er ingen import af vilkårlige nødkopi-/journalfiler,
ingen merge, historik, server eller multi-device-sync.

Næste milestone: gennemfør acceptance på iPhone, behold en ekstern JSON-backup,
og bevis derefter én reel efterfølgende version via ZIP alene. Det sidste bekræfter
permanensen i release-processen. Herefter kan Foundation markeres LOCKED, før nye
produktmotorer overvejes.
