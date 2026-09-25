import type { Decision } from '../../domain/decisions.ts';
import { decisionDrift, DRIFT_LABELS } from '../../domain/decision-intelligence.ts';
import { useNow } from '../../app/useNow.ts';

export function DecisionDrift({ decision }: { decision: Decision }) {
  const drift = decisionDrift(decision, useNow());
  return <div className="drift-summary">
    <h3>Ændringer i beslutningen</h3>
    <p className="field-help">{drift.versions} besluttede versioner · {drift.reviews} reviews{drift.reviewDue ? ' · review forfalder' : ''}.</p>
    {!drift.latest ? <p className="field-help">Der er endnu ingen tidligere besluttet version at sammenligne med.</p> : <>
      <p className="field-help">Fra version {drift.versions - 1} til {drift.versions}: {drift.latest.changed.length ? drift.latest.changed.map(field => DRIFT_LABELS[field]).join(', ') : 'Ingen indholdsændringer'}.</p>
      {drift.versions > 2 && <details className="decision-section"><summary>Første → seneste version</summary><p className="field-help">{drift.fromFirst!.changed.length ? drift.fromFirst!.changed.map(field => DRIFT_LABELS[field]).join(', ') : 'Ingen indholdsændringer'}.</p></details>}
      <p className="field-help">Drift betyder kun, at data er ændret. Det vurderer ikke, om valget er bedre eller dårligere. Åbn snapshots nedenfor for at læse grundlaget.</p>
    </>}
  </div>;
}
