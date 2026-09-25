# Opportunity Bridge v1

Bridge-formatet er separat fra AppData schema 3 og backup-wrapper version 1.
Det importerer kildeanalyser; det er ikke en fuld backup eller en automatisk beslutning.
Appen foretager ingen AI-kald, søgninger eller automatiske eksterne requests.

## Flow på iPhone

Mere → Muligheder → Importér fra AI → indsæt ren JSON eller vælg fil → Kontrollér
import → gennemgå kilde/dato/antal nye, nye versioner og uændrede → marker eksplicit
bekræftelse → Bekræft import. Preview ændrer ingen storage. Hele batchen accepteres
eller afvises. Hvis data ændres efter preview, skal importen kontrolleres igen.

## Komplet syntetisk eksempel

Alle felter nedenfor er obligatoriske, bortset fra sourceRunId. Ingen ukendte felter.
Datoer bruger præcis UTC ISO-formen YYYY-MM-DDTHH:mm:ss.sssZ. Arrays kan være tomme.
Eksemplet er ikke en valideret forretningsmulighed.

```json
{
  "format": "logic-core-opportunity-bridge",
  "bridgeVersion": 1,
  "generatedAt": "2026-09-20T12:00:00.000Z",
  "source": "Logic Opportunity Hunter · eksempel",
  "items": [
    {
      "bridgeKey": "business:example-001",
      "generatedAt": "2026-09-20T12:00:00.000Z",
      "sourceRunId": "run-1",
      "analysis": {
        "title": "Eksempel: test en produktidé",
        "domain": "Business",
        "summary": "Afprøv om et konkret kundebehov findes.",
        "thesis": "Et lille forsøg kan teste efterspørgslen før større investering.",
        "evidence": [
          "Eksempeldata: ét interview, endnu ikke tilstrækkelig evidens."
        ],
        "whyNow": "Ny feedback giver anledning til et lille forsøg.",
        "upside": "Et produkt, der løser et konkret problem.",
        "downside": "Tid kan bruges på en idé uden betalende kunder.",
        "constraints": [
          "Ingen PC"
        ],
        "assumptions": [
          "Der findes efterspørgsel."
        ],
        "unknowns": [
          "Betalingsvillighed"
        ],
        "nextTest": "Tal med fem mulige kunder.",
        "sourceLinks": [
          "https://example.com/research"
        ]
      }
    }
  ]
}
```

## Kontrakt og grænser

| Felt / collection | Grænse |
| --- | --- |
| format / bridgeVersion | logic-core-opportunity-bridge / 1 |
| items | 1–20; bridgeKey unik i batchen |
| bridgeKey | 1–128 tegn, lowercase a–z, tal, kolon, punktum, underscore, bindestreg; første tegn alfanumerisk |
| source | 1–120 tegn |
| sourceRunId | Valgfrit ID, 1–128 tegn, ingen kontroltegn eller ydre whitespace |
| analysis.title / domain | 1–120 / 1–64 tegn |
| summary | 1–2.000 tegn |
| thesis, whyNow, upside, downside, nextTest | 0–2.000 tegn hver; feltet skal findes |
| evidence, constraints, assumptions, unknowns | Højst 8 ikke-tomme strenge, højst 500 tegn hver |
| sourceLinks | Højst 8 unikke http/https-URLs, højst 2.048 tegn hver; ingen credentials/kontroltegn/whitespace |
| Hele Bridge JSON | Højst 128 KiB UTF-8 |
| Gemte snapshot inkl. metadata | Højst 16 KiB UTF-8 JSON |
| Opportunities i appen | Højst 50 |
| Kildeversioner pr. opportunity | Højst 8; ingen automatisk sletning |
| Hele opportunities-array | Højst 1 MiB UTF-8 JSON |

Tekstgrænser måles som JavaScript string.length (UTF-16 code units). Bytegrænser
måles separat. Lokale tags: højst 12 unikke, trimmede strenge på 32 tegn. Noter:
4.000 tegn; næste handling: 2.000 tegn; højst 10 links til Projects og 10 Decisions.
Domæne er almindelig tekst; Business/Product/AI er kun UI-forslag.

## Re-import og provenance

Behold samme bridgeKey for samme mulighed over tid. Første import opretter en
inbox-opportunity og snapshot #1. Lokal titel/domæne initialiseres fra analysen.
Senere import med samme key bevarer alle lokale felter, også titel, domæne, status,
noter, evaluation, tags, links, review-dato og næste handling.

Canonical JSON af **analysis** sammenlignes mod alle tidligere snapshots for samme
bridgeKey. Objektfelternes rækkefølge ignoreres; arrays, tekst og whitespace har
betydning. Ændret kilde-label, sourceRunId eller generatedAt alene er ikke en ny
analyse. En identisk tidligere analyse giver unchanged og ingen write/revision/event.
En ændret analyse tilføjes; tidligere payloads forbliver urørte.

Snapshot bevarer originalt valideret bridge-item, lokalt UUID/importedAt, sourceLabel,
bridgeGeneratedAt, generatedAt og optional sourceRunId. Ingen arbitrary objects,
HTML/Markdown-rendering eller script-eksekvering. Links er passive, brugeraktiverede.
Kildeanalyser er attribution, ikke app-verificerede fakta.

## Kopierbart prompt til ekstern AI

> Returnér kun gyldig JSON til Logic Core Opportunity Bridge v1, uden kodehegn.
> Brug format logic-core-opportunity-bridge, bridgeVersion 1, generatedAt i UTC ISO
> med millisekunder, source og items. Hvert item skal have stabil lowercase bridgeKey,
> generatedAt, eventuelt sourceRunId, og analysis med præcis title, domain, summary,
> thesis, evidence[], whyNow, upside, downside, constraints[], assumptions[], unknowns[],
> nextTest og sourceLinks[]. Brug korte plain-text-felter, tomme arrays hvor nødvendigt,
> kun http/https-kildelinks, og angiv usikkerhed i analysen. Bevar bridgeKey ved updates.
> Højst 20 items/128 KiB pr. dokument og 16 KiB pr. item inklusive metadata.
> Følg eksempel og feltgrænser ovenfor. Vælg aldrig lokal status eller en beslutning.

Der deles ikke lokale appdata automatisk med den eksterne AI. Hvis du selv kopierer
information ud, bestemmer du indholdet. Quota-fejl accepterer ingen del af batchen.
