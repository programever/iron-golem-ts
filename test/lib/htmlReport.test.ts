import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AuditData } from '../../src/lib/audit';
import { generateHtmlReport } from '../../src/lib/htmlReport';

function auditData(targetDate: Date, errors: AuditData['errors']): AuditData {
  return { targetDate, commitDate: targetDate, hash: 'abc1234', errors };
}

async function renderReport(data: AuditData[]): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iron-golem-ts-'));
  try {
    await generateHtmlReport(dir, data);
    return fs.readFileSync(path.join(dir, 'iron-golem-ts', 'report.html'), 'utf-8');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('generateHtmlReport', () => {
  it('escapes file paths so they cannot inject markup', async () => {
    const html = await renderReport([
      auditData(new Date(2025, 0, 1), { 'src/<script>alert(1)</script>.ts': [2531] })
    ]);

    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  });

  it('reports the newest audit entry regardless of input order', async () => {
    const html = await renderReport([
      auditData(new Date(2025, 0, 1), { 'src/old.ts': [2531, 2322] }),
      auditData(new Date(2025, 5, 1), { 'src/new.ts': [2304] })
    ]);

    assert.ok(html.includes('Total Errors: 1'));
    assert.ok(html.includes('src/new.ts'));
    assert.ok(!html.includes('src/old.ts'));
  });

  it('does not reorder the caller’s array', async () => {
    const data = [
      auditData(new Date(2025, 5, 1), { 'src/new.ts': [2304] }),
      auditData(new Date(2025, 0, 1), { 'src/old.ts': [2531] })
    ];
    await renderReport(data);

    assert.equal(data[0]?.targetDate.getMonth(), 5);
  });

  it('throws when there is no audit data', async () => {
    await assert.rejects(() => renderReport([]));
  });
});
