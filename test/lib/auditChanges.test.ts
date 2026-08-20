import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { filterErrorsByChangedFiles, parseStatusEntries } from '../../src/lib/auditChanges';

describe('parseStatusEntries', () => {
  it('keeps the full path for unstaged modifications', () => {
    // The leading space in ` M` is significant: trimming it used to eat the
    // first character of the file name.
    assert.deepEqual(parseStatusEntries([' M README.md', '']), ['README.md']);
  });

  it('handles staged, untracked and mixed statuses', () => {
    assert.deepEqual(parseStatusEntries(['M  src/a.ts', '?? src/b.ts', 'MM src/c.ts', '']), [
      'src/a.ts',
      'src/b.ts',
      'src/c.ts'
    ]);
  });

  it('takes the destination of a rename and skips the source entry', () => {
    assert.deepEqual(parseStatusEntries(['R  src/new.ts', 'src/old.ts', ' M src/a.ts', '']), [
      'src/new.ts',
      'src/a.ts'
    ]);
  });

  it('preserves paths containing spaces', () => {
    assert.deepEqual(parseStatusEntries([' M src/a file.ts', '']), ['src/a file.ts']);
  });
});

describe('filterErrorsByChangedFiles', () => {
  const output = [
    "src/a.ts(1,1): error TS2531: Object is possibly 'null'.",
    'src/a.ts.bak(1,1): error TS2322: Type mismatch.',
    'src/untouched.ts(1,1): error TS2304: Cannot find name.'
  ].join('\n');

  it('returns only errors for changed files', () => {
    assert.deepEqual(filterErrorsByChangedFiles(output, ['src/a.ts']), [
      "src/a.ts(1,1): error TS2531: Object is possibly 'null'."
    ]);
  });

  it('matches whole paths rather than substrings', () => {
    assert.deepEqual(filterErrorsByChangedFiles(output, ['src/a.ts.bak']), [
      'src/a.ts.bak(1,1): error TS2322: Type mismatch.'
    ]);
  });

  it('treats ./ prefixed paths as equivalent', () => {
    assert.equal(filterErrorsByChangedFiles(output, ['./src/a.ts']).length, 1);
  });

  it('returns nothing when no changed file has errors', () => {
    assert.deepEqual(filterErrorsByChangedFiles(output, ['src/other.ts']), []);
  });
});
