export async function saveJsonFile(json: string, kind: 'backup' | 'recovery'): Promise<string> {
  const name = `logic-core-${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Logic Core · dataeksport' });
    return 'Eksporten er sendt til den valgte app.';
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'JSON-eksporten er klar. Gem den i Filer / Downloads.';
}
