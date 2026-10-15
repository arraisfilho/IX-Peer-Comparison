import { test, expect } from './support/fixtures.js';
import { CATALOG_OK_COUNT, IX } from '../fixtures/dataset.js';

const readyStatus = new RegExp(`^● ${CATALOG_OK_COUNT} IXes · \\d{2}/\\d{2}/\\d{4}, \\d{2}:\\d{2}:\\d{2} UTC$`);

const STATIC = {
  pt: {
    title: 'Comparativo de Peers IX',
    subtitle: 'Fonte: PeeringDB · Dados em tempo real',
    pickerLabel: 'IXes',
    searchPlaceholder: 'Buscar IX por nome, cidade ou país…',
    netSearchPlaceholder: 'buscar rede ou ASN…',
    noIxSelected: 'Nenhum IX selecionado — use a busca abaixo',
    emptyTitle: 'Selecione os IXes para comparar',
    emptySub: 'Use a busca acima para adicionar IXes. Até 6 IXes simultaneamente.',
    allCountries: 'Todos os países',
    copyButton: '⎘ Copiar',
    downloadButton: '⬇ Download .txt',
  },
  en: {
    title: 'IX Peer Comparison',
    subtitle: 'Source: PeeringDB · Real-time data',
    pickerLabel: 'IXes',
    searchPlaceholder: 'Search IX by name, city or country…',
    netSearchPlaceholder: 'search network or ASN…',
    noIxSelected: 'No IX selected — use the search below',
    emptyTitle: 'Select IXes to compare',
    emptySub: 'Use the search above to add Internet Exchange Points. Up to 6 IXes simultaneously.',
    allCountries: 'All countries',
    copyButton: '⎘ Copy',
    downloadButton: '⬇ Download .txt',
  },
  es: {
    title: 'Comparativo de Peers IX',
    subtitle: 'Fuente: PeeringDB · Datos en tiempo real',
    pickerLabel: 'IXes',
    searchPlaceholder: 'Buscar IX por nombre, ciudad o país…',
    netSearchPlaceholder: 'buscar red o ASN…',
    noIxSelected: 'Ningún IX seleccionado — use la búsqueda abajo',
    emptyTitle: 'Seleccione los IXes para comparar',
    emptySub: 'Use la búsqueda de arriba para agregar IXes. Hasta 6 IXes simultáneamente.',
    allCountries: 'Todos los países',
    copyButton: '⎘ Copiar',
    downloadButton: '⬇ Descargar .txt',
  },
};

const LOADED = {
  pt: {
    headers: ['Rede', 'ASN', 'País', 'Presença'],
    presence: ['Todos', 'Em todos IXes', 'Só Alpha-IX São …', 'Só Beta-IX Rio d…'],
    policy: ['Política: Todas', 'Open', 'Selective', 'Restrictive'],
    stats: ['Total únicos', 'Em todos IXes'],
    continentLabel: 'Continente',
    countryLabel: 'País',
    continents: ['Todos', 'América do Norte', 'América Central', 'América do Sul', 'Europa', 'Ásia', 'África', 'Oceania'],
    count: '37 redes',
    noResults: 'Nenhum resultado',
    exportLabel: '28 ASNs · um por linha, vírgula exceto no último',
  },
  en: {
    headers: ['Network', 'ASN', 'Country', 'Presence'],
    presence: ['All', 'In all IXes', 'Only Alpha-IX São …', 'Only Beta-IX Rio d…'],
    policy: ['Policy: All', 'Open', 'Selective', 'Restrictive'],
    stats: ['Unique total', 'In all IXes'],
    continentLabel: 'Continent',
    countryLabel: 'Country',
    continents: ['All', 'North America', 'Central America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania'],
    count: '37 networks',
    noResults: 'No results',
    exportLabel: '28 ASNs · one per line, comma except last',
  },
  es: {
    headers: ['Red', 'ASN', 'País', 'Presencia'],
    presence: ['Todos', 'En todos los IXes', 'Solo Alpha-IX São …', 'Solo Beta-IX Rio d…'],
    policy: ['Política: Todas', 'Open', 'Selective', 'Restrictive'],
    stats: ['Total únicos', 'En todos los IXes'],
    continentLabel: 'Continente',
    countryLabel: 'País',
    continents: ['Todos', 'América del Norte', 'América Central', 'América del Sur', 'Europa', 'Asia', 'África', 'Oceanía'],
    count: '37 reds',
    noResults: 'Sin resultados',
    exportLabel: '28 ASNs · uno por línea, coma excepto el último',
  },
};

async function loadedTexts(app) {
  const stats = await app.stats();
  const texts = await app.texts();
  await app.searchNetworks('zzz');
  const noResults = await app.tableMessage();
  await app.searchNetworks('');
  await app.openExport(IX.A.name);
  const exportLabel = (await app.exportDialog()).label;
  await app.closeExport();
  return {
    headers: (await app.headers()).slice(0, 4),
    presence: (await app.presenceFilters()).map((b) => b.label),
    policy: (await app.policyFilters()).map((b) => b.label),
    stats: [stats.totalLabel, stats.inAllLabel],
    continentLabel: texts.continentLabel,
    countryLabel: texts.countryLabel,
    continents: (await app.continents()).map((c) => c.label),
    count: await app.countLabel(),
    noResults,
    exportLabel,
  };
}

test.describe('languages', () => {
  test('Portuguese is the default when nothing is stored', async ({ app }) => {
    await app.open();
    expect(await app.activeLang()).toBe('pt');
    expect(await app.texts()).toMatchObject(STATIC.pt);
    expect(await app.langButtonTitles()).toEqual(['Português', 'English', 'Español']);
    expect(await app.subtitleHighlight()).toEqual(['PeeringDB']);
  });

  for (const lang of ['en', 'es', 'pt']) {
    test(`switching to "${lang}" translates the static texts`, async ({ app }) => {
      await app.open({ lang: lang === 'pt' ? 'en' : 'pt' });
      await app.setLang(lang);
      expect(await app.activeLang()).toBe(lang);
      expect(await app.texts()).toMatchObject(STATIC[lang]);
    });

    test(`switching to "${lang}" translates the comparison view`, async ({ app }) => {
      await app.open();
      await app.addIX(IX.A.name);
      await app.addIX(IX.B.name);
      await app.setLang(lang);
      expect(await loadedTexts(app)).toEqual(LOADED[lang]);
    });
  }

  test('the choice is stored in localStorage and survives a reload', async ({ app }) => {
    await app.open();
    await app.setLang('es');
    expect(await app.storedLang()).toBe('es');
    await app.reload();
    expect(await app.activeLang()).toBe('es');
    expect(await app.texts()).toMatchObject(STATIC.es);
  });

  test('a stored language is applied on startup', async ({ app }) => {
    await app.open({ lang: 'en' });
    expect(await app.activeLang()).toBe('en');
    expect(await app.texts()).toMatchObject(STATIC.en);
  });

  test('switching language re-renders from memory without any API call and resets the status line', async ({ app, api }) => {
    await app.open();
    await app.addIX(IX.A.name);
    expect(await app.status()).toBe(`● ${CATALOG_OK_COUNT} IXes disponíveis`);
    const calls = api.requests().length;
    const before = await app.table();
    for (const lang of ['en', 'es', 'pt']) await app.setLang(lang);
    await api.waitForIdle();
    expect(api.requests()).toHaveLength(calls);
    expect(await app.table()).toEqual(before);
    expect(await app.status()).toMatch(readyStatus);
  });

  test('an unknown stored language falls back to Portuguese', async ({ app }) => {
    await app.open({ lang: 'fr' });
    expect(await app.activeLang()).toBe('pt');
    expect(await app.texts()).toMatchObject(STATIC.pt);
    await app.search('zz');
    expect(await app.searchMessage()).toBe('Nenhum IX encontrado');
  });

  test('ARQ-10: switching language still works when localStorage writes fail', async ({ app }) => {
    await app.open({ storageFull: true });
    await app.setLang('en');
    expect(await app.activeLang()).toBe('en');
    expect((await app.texts()).title).toBe('IX Peer Comparison');
  });

  test.fail('I18N-01: switching language updates <html lang> and the document title', async ({ app, page }) => {
    await app.open();
    await app.setLang('es');
    expect(await app.documentLang()).toMatch(/^es\b/);
    expect(await page.title()).toContain('Comparativo de Peers IX');
    await app.setLang('en');
    expect(await app.documentLang()).toMatch(/^en\b/);
    expect(await page.title()).toContain('IX Peer Comparison');
  });

  test.fail('I18N-04: in English, country names are English', async ({ app }) => {
    await app.open({ lang: 'en' });
    await app.addIX(IX.A.name);
    const labels = (await app.countryOptions()).map((o) => o.label);
    expect(labels).toContain('🇧🇷 Brazil (BR)');
    expect(labels).toContain('🇩🇪 Germany (DE)');
  });

  test.fail('I18N-05: the Spanish row count is not "reds"', async ({ app }) => {
    await app.open({ lang: 'es' });
    await app.addIX(IX.A.name);
    const count = await app.countLabel();
    expect(count).toMatch(/^29 /);
    expect(count).not.toMatch(/\breds\b/);
  });
});
