import { PageHeader } from '../components/PageHeader.tsx';
import { ExportButton } from '../components/ExportButton.tsx';
import { APP_VERSION } from '../config.ts';
import { isStandalone } from '../app/useDevice.ts';
import { ACTIVITY_LIMIT } from '../storage/schema.ts';

export function SettingsPage() {
  return <><PageHeader eyebrow="SYSTEM / SETTINGS" title="Indstillinger" /><section className="settings-section"><p className="eyebrow">PÅ DIN IPHONE</p><h2>{isStandalone() ? 'Logic Core er installeret.' : 'Giv Logic Core sin egen plads.'}</h2><ol className="steps"><li>Åbn appens URL i Safari.</li><li>Tryk på Del, og vælg “Føj til hjemmeskærm”.</li><li>Slå “Åbn som webapp” til, hvis valget vises, og tryk Tilføj.</li><li>Åbn Logic Core fra det nye ikon.</li></ol><p className="muted">Brug samme installerede app til dit arbejde. Safari, privat browsing og andre installationer kan have hver deres lokale data.</p></section><section className="settings-section"><p className="eyebrow">DIT LOKALE ARBEJDSRUM</p><h2>Gem en kopi af dine data.</h2><p>Projekter og de seneste {ACTIVITY_LIMIT} aktiviteter gemmes på denne enhed. De bliver ikke sendt til en server.</p><p className="muted">Lokal lagring er ikke en backup. Rydning af browserdata eller systemets oprydning kan fjerne dem. Eksportér jævnligt. Import kommer senere.</p><ExportButton /></section><section className="settings-section"><p className="eyebrow">FOUNDATION</p><dl className="settings-details"><div><dt>Appversion</dt><dd>{APP_VERSION}</dd></div><div><dt>AI-forbindelse</dt><dd>Ikke tilsluttet</dd></div><div><dt>Datatilstand</dt><dd>Lokal</dd></div></dl><a className="button secondary" href="#/diagnostics">Åbn Diagnostics</a></section></>;
}
