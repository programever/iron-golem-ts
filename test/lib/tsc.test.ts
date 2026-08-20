import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { buildNodeFromErrors, parseTscErrorLine, parseTscErrors } from '../../src/lib/tsc';

const TSC_OUTPUT = [
  "src/a.ts(43,7): error TS2531: Object is possibly 'null'.",
  'src/a.ts(52,1): error TS2322: Type mismatch.',
  'src/nested/b.ts(1,1): error TS2304: Cannot find name.',
  'Found 3 errors in 2 files.',
  ''
].join('\n');

describe('parseTscErrorLine', () => {
  it('extracts the file path and error code', () => {
    assert.deepEqual(
      parseTscErrorLine("src/a.ts(43,7): error TS2531: Object is possibly 'null'."),
      {
        filePath: 'src/a.ts',
        errorCode: 2531
      }
    );
  });

  it('ignores summary and unrelated lines', () => {
    assert.equal(parseTscErrorLine('Found 3 errors in 2 files.'), null);
    assert.equal(parseTscErrorLine(''), null);
  });

  it('handles file paths containing spaces and parentheses', () => {
    assert.deepEqual(parseTscErrorLine('src/a (copy)/b c.ts(1,1): error TS2322: Type mismatch.'), {
      filePath: 'src/a (copy)/b c.ts',
      errorCode: 2322
    });
  });

  it('does not confuse the line/column numbers with the error code', () => {
    const parsed = parseTscErrorLine('src/a.ts(2322,1): error TS2531: Object is possibly null.');
    assert.equal(parsed?.errorCode, 2531);
  });
});

describe('parseTscErrors', () => {
  it('groups error codes by file', () => {
    assert.deepEqual(parseTscErrors(TSC_OUTPUT), {
      'src/a.ts': [2531, 2322],
      'src/nested/b.ts': [2304]
    });
  });

  it('returns an empty record for clean output', () => {
    assert.deepEqual(parseTscErrors(''), {});
  });
});

describe('buildNodeFromErrors', () => {
  it('aggregates counts up the directory tree', () => {
    const root = buildNodeFromErrors({
      'src/a.ts': [1, 2],
      'src/nested/b.ts': [3],
      'src/nested/c.ts': [4, 5, 6]
    });

    assert.equal(root.errorCount, 6);
    const src = root.children.get('src');
    assert.equal(src?.errorCount, 6);
    assert.equal(src?.children.get('a.ts')?.errorCount, 2);
    assert.equal(src?.children.get('nested')?.errorCount, 4);
  });

  it('handles an empty error set', () => {
    assert.equal(buildNodeFromErrors({}).errorCount, 0);
  });
});
