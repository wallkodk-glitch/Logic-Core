import { PageHeader } from '../components/PageHeader.tsx';
import { OpportunityBridge } from '../components/OpportunityBridge.tsx';
export function OpportunityBridgePage() {
  return <><a className="back-link" href="#/opportunities">← Muligheder</a><PageHeader title="Importér muligheder" /><OpportunityBridge /></>;
}
