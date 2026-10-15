import { test, expect } from './support/fixtures.js';
import { IX } from '../fixtures/dataset.js';
import { A_ASNS, A_ONLY_ASNS, AB_SHARED_ASNS, exportBody } from './support/expected.js';

const B_ASNS = [
  '64501', '64502', '64503', '64505', '64509', '64511', '64513', '64515', '64519', '64520', '64526',
  '64601', '64602', '64603', '64604', '64605', '64606', '64607', '64608', '4200000001',
];
const label = (count) => `${count} ASNs · um por linha, vírgula exceto no último`;

async function openWith(app, ...ixes) {
  await app.open();
  for (const ix of ixes) await app.addIX(ix.name);
}

test.describe('ASN export', () => {
  test('the dialog lists the IX ASNs sorted numerically, one per line, with a comma on all but the last', async ({ app }) => {
    await openWith(app, IX.A);
    await app.openExport(IX.A.name);
    const dialog = await app.exportDialog();
    expect(dialog).toMatchObject({
      title: `Export ASNs — ${IX.A.name}`,
      label: label(28),
      copyLabel: '⎘ Copiar',
      downloadLabel: '⬇ Download .txt',
    });
    expect(dialog.lines[0]).toBe('64501,');
    expect(dialog.lines.at(-2)).toBe('64529,');
    expect(dialog.lines.at(-1)).toBe('4200000001');
    expect(dialog.lines.slice(0, -1).every((line) => /^\d+,$/.test(line))).toBe(true);
    expect(dialog.content).toBe(exportBody(A_ASNS));
    // the stub network (ASN 0) is left out
    expect(dialog.lines).not.toContain('0,');
    expect(dialog.titleColor).toBe((await app.chip(IX.A.name)).color);
  });

  test('download saves the same text as asns_<slug>.txt', async ({ app }) => {
    await openWith(app, IX.A);
    await app.openExport(IX.A.name);
    const { content } = await app.exportDialog();
    expect(await app.downloadExport()).toEqual({ filename: 'asns_alpha-ix-s-o-paulo.txt', content });
  });

  test('copy puts the text on the clipboard and confirms for 2 s', async ({ app, page }) => {
    await app.open({ clock: true });
    await app.addIX(IX.A.name);
    await app.openExport(IX.A.name);
    await page.clock.pauseAt((await app.pageNow()) + 1000);
    await app.copyExport();
    await expect(app.copyButton).toHaveText('✓ Copiado!');
    expect(await app.clipboardText()).toBe(exportBody(A_ASNS));
    await page.clock.runFor(1999);
    await expect(app.copyButton).toHaveText('✓ Copiado!');
    await page.clock.runFor(1);
    await expect(app.copyButton).toHaveText('⎘ Copiar');
  });

  test('when the Clipboard API is refused, copy falls back to execCommand without confirmation', async ({ app }) => {
    await app.open({ clipboardDenied: true });
    await app.addIX(IX.A.name);
    await app.openExport(IX.A.name);
    await app.copyExport();
    await expect.poll(() => app.clipboardText()).toBe(exportBody(A_ASNS));
    await expect(app.copyButton).toHaveText('⎘ Copiar');
  });

  test.fail('A11Y-02: Escape closes the export dialog', async ({ app }) => {
    await openWith(app, IX.A);
    await app.openExport(IX.A.name);
    await app.pressInExport('Escape');
    expect(await app.isExportOpen()).toBe(false);
  });

  test('the dialog closes with × or a click on the backdrop, not with a click inside', async ({ app }) => {
    await openWith(app, IX.A);
    await app.openExport(IX.A.name);
    await app.closeExport();
    expect(await app.isExportOpen()).toBe(false);
    await app.openExport(IX.A.name);
    await app.clickInsideExport();
    expect(await app.isExportOpen()).toBe(true);
    await app.clickExportBackdrop();
    expect(await app.isExportOpen()).toBe(false);
  });

  test('one export button per IX, with the name cut at 12 characters', async ({ app }) => {
    await openWith(app, IX.A, IX.B);
    expect(await app.exportButtons()).toEqual(['↓ Alpha-IX Sã…', '↓ Beta-IX Rio…']);
  });

  // Phase 5 changes the default to "the visible rows"; these pin today's rules.
  test.describe('which networks are exported', { tag: '@export-semantics' }, () => {
    test('"Todos": every member of that IX, ignoring policy, continent, country and search', async ({ app }) => {
      await openWith(app, IX.A, IX.B);
      await app.setPolicy('open');
      await app.setContinent('Europa');
      await app.setCountry('DE');
      await app.searchNetworks('india');
      expect(await app.rowNames()).toEqual(['India Carrier']);
      await app.openExport(IX.A.name);
      expect(await app.exportDialog()).toMatchObject({ label: label(28), content: exportBody(A_ASNS) });
      await app.closeExport();
      await app.openExport(IX.B.name);
      expect(await app.exportDialog()).toMatchObject({ label: label(20), content: exportBody(B_ASNS) });
    });

    test('"Só X": the networks exclusive to X when exporting X', async ({ app }) => {
      await openWith(app, IX.A, IX.B);
      await app.setPresence('only', IX.A.name);
      await app.openExport(IX.A.name);
      expect(await app.exportDialog()).toMatchObject({ label: label(16), content: exportBody(A_ONLY_ASNS) });
    });

    test('"Só X": nothing when exporting another IX', async ({ app }) => {
      await openWith(app, IX.A, IX.B);
      await app.setPresence('only', IX.A.name);
      await app.openExport(IX.B.name);
      expect(await app.exportDialog()).toMatchObject({ label: label(0), content: '', lines: [] });
    });

    test('"Em todos IXes": the networks present at every IX, for any IX', async ({ app }) => {
      await openWith(app, IX.A, IX.B);
      await app.setPresence('inAll');
      for (const ix of [IX.A, IX.B]) {
        await app.openExport(ix.name);
        expect(await app.exportDialog(), ix.name).toMatchObject({ label: label(12), content: exportBody(AB_SHARED_ASNS) });
        await app.closeExport();
      }
    });
  });
});
