import * as JD from 'decoders';

/**
 * Accepts a numeric CLI string and returns it as a whole number >= 1.
 * Rejects `0`, negatives, decimals and junk like `7days`, all of which used to
 * slip through `parseInt` and either hang or silently misbehave.
 */
export const countDecoder: JD.Decoder<number> = JD.numeric
  .then(JD.positiveInteger)
  .refine((n) => n >= 1, 'Must be 1 or greater');

/** Same as `countDecoder`, but `0` is a meaningful value (e.g. tree depth). */
export const nonNegativeCountDecoder: JD.Decoder<number> = JD.numeric.then(JD.positiveInteger);
