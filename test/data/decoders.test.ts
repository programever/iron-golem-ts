import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { countDecoder, nonNegativeCountDecoder } from '../../src/data/decoders';

describe('countDecoder', () => {
  it('accepts positive whole numbers', () => {
    assert.equal(countDecoder.verify('7'), 7);
  });

  it('rejects zero and negatives, which would loop forever', () => {
    assert.throws(() => countDecoder.verify('0'));
    assert.throws(() => countDecoder.verify('-1'));
  });

  it('rejects decimals and trailing junk', () => {
    assert.throws(() => countDecoder.verify('1.5'));
    assert.throws(() => countDecoder.verify('7days'));
    assert.throws(() => countDecoder.verify(''));
  });
});

describe('nonNegativeCountDecoder', () => {
  it('accepts zero', () => {
    assert.equal(nonNegativeCountDecoder.verify('0'), 0);
  });

  it('rejects negatives', () => {
    assert.throws(() => nonNegativeCountDecoder.verify('-1'));
  });
});
