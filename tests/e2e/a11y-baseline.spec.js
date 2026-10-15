// Accessibility baseline. The expected failure turns into a blocking check in Phase 7.

import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './support/fixtures.js';
import { IX } from '../fixtures/dataset.js';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const analyze = (page) => new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

test.describe('accessibility baseline', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.addIX(IX.A.name);
    await app.addIX(IX.B.name);
  });

  test('axe can analyse the comparison view', async ({ page }) => {
    const results = await analyze(page);
    expect(results.passes.length).toBeGreaterThan(0);
  });

  test.fail('A11Y: no serious or critical axe violations (WCAG 2.x A/AA)', async ({ page }, testInfo) => {
    const results = await analyze(page);
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    await testInfo.attach('axe-blocking-violations.json', {
      body: JSON.stringify(blocking.map(({ id, impact, help, nodes }) => ({ id, impact, help, nodes: nodes.length })), null, 2),
      contentType: 'application/json',
    });
    expect(blocking.map((v) => v.id)).toEqual([]);
  });
});
