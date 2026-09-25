# v0.3.0 — Opportunity & Decision Intelligence

## Klare ansvarsområder

- Importeret analyse: immutable kildeversioner, plain text, med provenance.
- Lokalt arbejdsrum: manuelle noter, tags, titel/domæne, status, review-dato og links.
- Analysesignal: deterministisk beregning af dine egne scores, ingen automatiske valg.
- Beslutning: eksisterende Decision draft/commit/review semantics.
- Drift: hvilke gemte felter der ændrede sig mellem committed versioner.

AppStore, StoragePort, detached transaction clone, deepFreeze og atomisk setItem er
beholdt. Nye units er opdelt i domain, validation, bridge, operations og UI. Ingen
state-, router-, schema-, markdown- eller database-dependency er tilføjet.

## Opportunity Signal

Alle syv dimensioner skal være heltal 1–5: upside, confidence, fit, speed,
capitalEfficiency, reversibility og downsideRisk (1 lav risiko, 5 høj risiko).

`signal = ((upside + confidence + fit + speed + capitalEfficiency + reversibility + (6 - downsideRisk)) / 7 - 1) * 25`

Resultatet er 0–100; UI viser heltal. Inkomplet evaluation giver null/intet signal.
Ingen authoritative total gemmes. Højere signal ændrer aldrig status eller valg.

## Links og beslutningsstart

Opportunity kan have op til 10 eksisterende Projects og 10 Decisions. Project-sletning
fjerner både Decision-project-link og Opportunity-project-links atomisk.
Decision-sletning fjerner Opportunity-decision-links atomisk. Opportunity-sletning
bevarer Projects, Decisions og aktivitetshistorik. Historiske activity-targets er
ikke foreign keys; de vises utilgængelige, når kilden er slettet.

Start beslutning kræver gemt, aktuel Opportunity. Det opretter én almindelig draft
og ét backlink i samme write. To tomme alternativer, intet selectedOptionId og ingen
commits. Titel/mål/reality/assumptions/risiko/næste handling prefilles konservativt.
Reality bevarer kilde-label, bridgeKey og snapshot-ID; fuld analyse ligger i kilden.
Lange prefill-felter afkortes til eksisterende Decision-limits. Første linked Project
videreføres, hvis der er et. Project detail viser relateret arbejde derived only.

## Decision Drift, Attention og Fortsæt

Drift sammenligner latest vs previous commit og first vs latest: valgt option, titel,
mål, reality, constraints, assumptions, options, criteria, scores, rationale,
biggestRisk, changeConditions, nextAction og reviewAt. Arrays sammenlignes inklusive
rækkefølge. Antal commits/reviews og aktuell review-due vises. Én/ingen commit giver
forklaring om manglende sammenligningsgrundlag. Ingen normativ vurdering og ingen
ændring af historiske snapshots. Ungemte/current draft-ændringer er ikke en ny commit.

Attention viser højst 3 objektive forhold: due Decision reviews, due Opportunity
reviews, derefter inbox-opportunities. Due først, ældste dato først, stabil type/id
tie-break. Due inbox vises kun én gang. Parkeret Opportunity kan stadig have due
review; rejected/archived vises ikke. Ingen Attention-state gemmes.

Fortsæt viser højst 3 senest opdaterede aktuelle Projects, Decisions og Opportunities,
med stabil type/id tie-break. Opportunity inbox/candidate/active er aktuelle;
parked/rejected/archived er ikke. Activity bevarer command-expansion og sikre links
for Project/Decision/Opportunity, inklusive slettet historik.

## Navigation, startup og opdatering

Central guard dækker internal links, bottom nav, back-links, programmatic navigation,
browser hash/back og beforeunload hvor understøttet. Pending Command, Project,
Decision, Review, Opportunity, Bridge-input/preview og backup-preview registreres.
Afvist navigation bevarer den accepterede route og monterede formular. Godkendt
navigation spørger ikke igen ved den efterfølgende hashchange. Ingen autosave.

Ved annulleret browser Back erstattes den forsøgte historikpost med den accepterede
hash. Det er loop-frit, men den forsøgte back-entry bliver forbrugt/erstattet. iOS
force-quit/app-switch kan ikke garanteres intercepted. Gem før lukning.

#main-content h1 styrer focus/title; startup-heading må ikke vælges. Standalone
startup-fallback, worker/ACK/one-window/timeout/single-reload og legacy guidance er
beholdt. Ingen automatisk activation eller reload midt i arbejde.

## Fysisk acceptance efter ZIP-deploy

1. Tag schema 2-backup. Upload kun release-ZIP til root og commit main. Vent på grøn
   Mobile release build/install/deploy og automatisk ZIP-fjernelse.
2. Åbn den eksisterende v0.2.1 Home Screen-PWA online; vent på Opdatering klar.
3. Skriv ugemt Command-tekst; opdateringsknappen skal være blokeret. Gem/fjern teksten.
4. Luk andre Logic Core-vinduer. Tryk Opdatér og genåbn. Bekræft én reload.
5. Kontrollér 0.3.0/schema 3/Diagnostics 8/8 online, intakte Projects/Decisions/commits/
   reviews/activity og tom opportunities-collection. Kontrollér aktiv heading/title.
6. Importér eksempel: preview ændrer intet, checkbox/confirm kræves. Edit local fields.
   Re-import samme bridgeKey med ændret analysis: ny version, alle local fields bevaret.
   Eksakt duplicate og metadata-only update: ingen ekstra version.
7. Test signal, status, søgning/domænefilter, source-historik og passive kilde-links.
   Test invalid/partial batch: ingen dataændring.
8. Start beslutning: draft, ingen selected option, backlink og evt. Project-link.
   Test related work og delete link-cleanup med testdata.
9. Decision → decide → reopen → ændr assumption/risiko/action → decide. Første snapshot
   uændret; anden commit findes; Drift angiver netop de ændrede felter.
10. Test Attention, Fortsæt og alle activity-typer. Slettede targets må ikke være links.
    Command skal stadig kunne foldes ud.
11. Test ugemt arbejde på alle formularer/previews: bottom-nav, back-link, browser Back,
    annullér/bevar, bekræft/forlad. Test 320/375/390/430 px hvor muligt, portrait/landscape,
    keyboard, safe-area, lange titler/links/AI-tekster, touch og sticky actions.
12. Efter preload: luk → flytilstand → genåbn → browse alle tre entities → gem lokal
    Opportunity-edit → luk/genåbn. Eksportér schema 3-backup; preview/restore/recovery
    skal medtage Opportunities. Test gamle schema 1/2-backups med en gemt sikkerhedskopi.

Startup recovery kan realistisk testes ved offline first-load/forstyrret asset-load i
et separat testvindue. Slet ikke produktionsdata for at fremprovokere en fejl. En normal
velfungerende opdatering behøver ikke vise fallbacken.

## Kendte grænser

Browser storage kan stadig ramme quota; Opportunity-bounds er ingen ledig-plads-garanti.
Fejlet write publicerer ingen halv state. Ingen automatisk history-pruning; efter 8
kilde-snapshots skal der eksporteres/ryddes op eksplicit. Ingen Opportunity-review-log:
reviewAt flyttes/fjernes manuelt. Historik er ikke kryptografisk signeret. Optimistisk
stale-write check er ikke en tværproceslås; brug én aktiv editor.

Fysisk iPhone/UI-layout og GitHub-hosted deployment er ikke verificeret i byggemiljøet.
Den separate release-rapport skelner automated verified, static reviewed og physical pending.
