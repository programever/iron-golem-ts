import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseJsonc } from './jsonc';

describe('parseJsonc', () => {
  it('parses plain JSON', () => {
    assert.deepEqual(parseJsonc('{"a": 1}'), { a: 1 });
  });

  it('strips line and block comments', () => {
    const text = `{
      // the compiler options
      "compilerOptions": {
        /* strictness */
        "strict": true
      }
    }`;
    assert.deepEqual(parseJsonc(text), { compilerOptions: { strict: true } });
  });

  it('strips trailing commas in objects and arrays', () => {
    assert.deepEqual(parseJsonc('{"include": ["src",], "a": 1,}'), { include: ['src'], a: 1 });
  });

  it('leaves comment-like and comma-like sequences inside strings alone', () => {
    assert.deepEqual(parseJsonc('{"url": "https://x.dev", "glob": "a/*", "t": "x,}"}'), {
      url: 'https://x.dev',
      glob: 'a/*',
      t: 'x,}'
    });
  });

  it('handles escaped quotes inside strings', () => {
    assert.deepEqual(parseJsonc('{"a": "say \\"hi\\" // not a comment"}'), {
      a: 'say "hi" // not a comment'
    });
  });

  it('throws on genuinely malformed input', () => {
    assert.throws(() => parseJsonc('{"a": }'));
  });
});
