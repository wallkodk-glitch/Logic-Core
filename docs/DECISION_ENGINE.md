# Decision Engine — model fra v0.2.0, UI v0.2.1

## Hvad betyder dataene?

| Lag | Betydning |
| --- | --- |
| Gemte input | Dine mål, observationer, begrænsninger, antagelser og vurderinger. Appen verificerer format, ikke sandhed. |
| Analytical signal | Deterministisk sum(weight × score) / sum(weight), beregnet ved visning. Ingen authoritative total gemmes. |
| Menneskeligt valg | selectedOptionId vælges af dig. Ingen automatisk vinder, tie-break eller anbefaling. |
| DecisionCommit | Kopi af hele beslutningsgrundlaget på beslutningstidspunktet. Gamle kopier ændres ikke ved senere redigering. |
| DecisionReview | Append-only udfald, ændringer, læring og keep/reopen/close knyttet til det daværende commit. |

## Domæne og grænser

Decision indeholder id, title, goal, reality, constraints, assumptions, valgfrit
linkedProjectId, options, criteria, scores, status, valgfrit selectedOptionId,
rationale, biggestRisk, changeConditions, nextAction, valgfrit reviewAt,
commits, reviews, createdAt og updatedAt.

Options: id, title, description, upside, downside, opportunityCost, reversibility
(easy/moderate/hard). Criteria: id, title, integer weight 1–5.
Scores: optionId, criterionId, integer score 1–10. Unique option/criterion-pairs.
Status: draft, decided, closed, archived. Review-due beregnes, gemmes ikke.

Maksimalt 100 beslutninger, 8 options, 8 criteria, 50 commits og 100 reviews pr.
beslutning. Titel 120 tegn; narrative felter 4.000; option-felter 2.000.
Historik trimmes ALDRIG automatisk; ved grænsen afvises nye records med en besked.
Eksportér og bevar dit arbejde før oprydning. Aktivitet er fortsat begrænset til
de seneste 300 events ved app-skrivninger. Backup-input er højst 8 MiB.

Draft kræver en titel; resten kan gemmes ufærdigt. Scores skal altid have gyldige
referencer, heltalsværdier og unikke par, men draft må mangle scores.
En option med manglende score får ingen delvis total. Decided kræver mindst
to navngivne options, goal, manuelt selectedOptionId, rationale, nextAction og,
hvis criteria bruges, fuld score-dækning for alle option × criterion-par.
Ingen criteria og ingen scores er fuldt gyldigt. Lige signaler er gyldige.

## Historik og status

- Create/edit/decide er hele dokumenttransaktioner med revision og raw stale-check.
- Beslut gemmer formular + nyt commit atomisk. Commit har egen id/timestamp og
  snapshot af title, goal, reality, constraints, assumptions, options, criteria,
  scores, selectedOptionId, rationale, biggestRisk, changeConditions, nextAction,
  reviewAt. Current project-link er ikke en historisk foreign key.
- Decided/closed content skal matche seneste snapshot. Redigering kræver reopen.
- Reopen bevarer alle tidligere commits/reviews. Re-decide tilføjer et commit.
- Review kræver decided, gyldigt aktuelt commit og et ikke-tomt outcome.
  keep bevarer decided, reopen giver draft, close giver closed.
- Review kan kun referere det seneste commit på review-tidspunktet. Efter et
  reopen/close-review kræves nyt commit før flere reviews af beslutningen.
- Close kræver decided. Draft kan arkiveres; archived/closed kan genåbnes.
- Delete fjerner beslutning og historik efter tydelig UI-confirmation. Historiske
  activity-events kan fortsat nævne slettede records.
- Public store-snapshots deep-freezes; kopier isolerer formularer og caller-input.
  Importeret JSON er brugerleverede data; systemet kan ikke bevise historisk
  autenticitet eller afsløre en velstruktureret ekstern omskrivning af historik.

## Projekter

linkedProjectId er valgfri og skal eksistere i current projects. Sletning af et
projekt fjerner alle aktuelle links i samme atomiske transaktion, opdaterer
de berørte beslutningers updatedAt og bevarer historik. Import af dangling links
afvises; der gættes eller ryddes ikke automatisk i korrupt import.

## Schema 1 → 2

Storage identity ændres ikke. En eksplicit pure migration validerer først hele
det gamle dokument med dets gamle activity-types/object-shapes. Den kopierer
projects, activity og revision uændret og tilføjer decisions: [] + schemaVersion: 2.
Ingen timestamp-normalisering, revision-bump eller silent default-felter.

Ved boot afvikles en eventuel gammel recovery-journal først. V1 migreres derefter
helt i hukommelsen, rå primary sammenlignes igen og v2 skrives med ét setItem.
Recovery overskrives ikke af boot-migration. Ved quota-/write-fejl bevares de
oprindelige v1-bytes, data vises read-only med fejl, og Diagnostics rapporterer
ikke fejlagtigt en gennemført v2-lagring. Et nyt refresh kan prøve igen.

Ved import valideres/migreres alt før preview og igen ved restore-grænsen.
Preview viser originalt schema, mål-schema, antal projekter/decisions/activities.
V1-backup har ingen decisions: restore erstatter derfor eksisterende decisions
med []. Det er bevidst fuld restore, ikke merge.

Backup-formatversion og recovery-journal-version forbliver 1; data-schema er 2.
Normale exports indeholder schema 2. Gamle v1-backups/recovery kan restores via
migration. Recovery bevarer de præcise raw primary-bytes fra før restore.
Primary setItem er atomisk; to localStorage-keys er ikke én transaktion, så den
eksisterende journal håndterer afbrudt restore/finalisering. Ingen ny journalmodel.

## Mobil og routing

Hash-routes: #/decisions, #/decisions/new, #/decisions/:id.
Decisions forbliver under Mere. Liste har search, statusfilter og due-filter.
Editorens syv sektioner kan foldes sammen; første sektion er åben. Labels og
stacked score-cards er bevaret; ingen desktop score-matrix. v0.2.1 samler draft-
handlinger i én mobil sticky action area ved toppen. Den bliver statisk ved
åbent keyboard, lav landscape-skærm og tablet/desktop. Samme save-transaktion
og validation bruges; ingen autosave eller nye persisted fields.
Date-input bliver slutningen af valgt dag i enhedens tidszone, gemt som UTC.
Due vises kun for decided uden et review af samme commit på/efter due-tidspunkt.
Ingen push-notifikation. Due-opdatering sker hvert minut og ved genaktivering.

Kladder gemmes manuelt. Gem før skift af navigation eller lukning: iOS garanterer
ikke beforeunload-advarsler. Ved kendt konflikt bevares formularen, skrivning
afvises, og brugeren vælger eksplicit at indlæse den nyeste version.

## Moduler

- domain/decisions.ts: types, enums, limits, pure score/date helpers.
- storage/validation.ts: fælles form-, id-, date- og immutability-primitiver.
- storage/decision-validation.ts: strukturel/reference/historik-validering.
- storage/schema.ts: v2-document + eksplicit v1-migration.
- storage/store.ts: eksisterende AppStore, nu med Decision-transaktioner.
- storage/backup.ts: schema-aware preview/export; recovery-algoritmen er uændret.
- pages/DecisionsPage og DecisionEditorPage: liste og mobil workspace.
- components/decisions: felter, options, scoring, historik og review.
- Ingen nyt state-framework, routing-framework, runtime dependency eller server.
