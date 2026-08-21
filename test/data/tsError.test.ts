import { strict as assert } from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import { getErrorMessage, getSeverity, resetDiagnosticCatalogue } from '../../src/data/tsError';

// These tests run with the repo root as cwd, so `typescript` resolves to the
// dev dependency, exactly as it resolves to the audited project's copy in use.
describe('getErrorMessage', () => {
  afterEach(() => resetDiagnosticCatalogue());

  it("reads the real message from TypeScript's diagnostic catalogue", () => {
    assert.equal(getErrorMessage('TS2554'), 'Expected {0} arguments, but got {1}.');
    assert.equal(
      getErrorMessage('TS2307'),
      "Cannot find module '{0}' or its corresponding type declarations."
    );
    assert.equal(getErrorMessage('TS2531'), "Object is possibly 'null'.");
  });

  it('falls back for codes TypeScript does not define', () => {
    assert.equal(getErrorMessage('TS99999'), 'Unknown error code.');
    assert.equal(getErrorMessage('garbage'), 'Unknown error code.');
  });

  it('falls back when no TypeScript can be resolved from cwd', () => {
    const originalCwd = process.cwd();
    process.chdir('/');
    try {
      assert.equal(getErrorMessage('TS2554'), 'Unknown error code.');
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe('getSeverity', () => {
  it('combines the severity label with the real message', () => {
    assert.equal(getSeverity('TS2554'), '🔴 High: Expected {0} arguments, but got {1}.');
    assert.equal(getSeverity('TS2339'), "🟠 Medium: Property '{0}' does not exist on type '{1}'.");
    assert.equal(getSeverity('TS6133'), "🟢 Low: '{0}' is declared but its value is never read.");
  });

  it('labels real codes with no severity opinion as unknown severity, with a real message', () => {
    assert.equal(getSeverity('TS2552'), "🟡 Unknown: Cannot find name '{0}'. Did you mean '{1}'?");
  });
});
