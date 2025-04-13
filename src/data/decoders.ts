import * as JD from 'decoders';

export const stringNumberDecoder: JD.Decoder<number> = JD.string.transform((v) =>
  JD.number.verify(parseInt(v))
);
