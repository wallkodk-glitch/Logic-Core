import { PageHeader } from '../components/PageHeader.tsx';
import { DataTools } from '../components/DataTools.tsx';
import { APP_VERSION } from '../config.ts';
import { isStandalone } from '../app/useDevice.ts';
import { SCHEMA_VERSION } from '../storage/schema.ts';

export function SettingsPage() {
  const installed = isStandalone();
  return <>
    <PageHeader title="Indstillinger" />
    <section className="settings-section"><h2>Data på din enhed</h2>
      <p className="muted">Projekter, beslutninger og historik bliver her. Gem en backup i Filer, så du også har en kopi uden for appen.</p>
      <DataTools />
    </section>
    <details className="settings-section installation-guide"><summary>{installed ? 'Installeret på hjemmeskærmen' : 'Føj til hjemmeskærmen'}</summary>
      <ol className="steps"><li>Åbn appens URL i Safari.</li><li>Tryk på Del → Føj til hjemmeskærm.</li><li>Vælg Åbn som webapp, hvis valget vises, og tryk Tilføj.</li></ol>
      <p className="muted">Brug samme installation til dit arbejde. Safari og andre installationer kan have hver deres lokale data. Browserens oprydning kan fjerne lokale data og recovery; behold din backup i Filer.</p>
    </details>
    <section className="settings-section"><h2>Om Logic Core</h2>
      <dl className="settings-details"><div><dt>Appversion</dt><dd>{APP_VERSION}</dd></div><div><dt>Dataskema</dt><dd>{SCHEMA_VERSION}</dd></div><div><dt>Lagring</dt><dd>Kun på denne enhed</dd></div></dl>
      <a className="button secondary" href="#/diagnostics">Åbn Diagnostics</a>
    </section>
  </>;
}
