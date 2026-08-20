/**
 * Minimal JSONC support. `tsconfig.json` is JSON with comments and trailing
 * commas, both of which `JSON.parse` rejects, so strip them before parsing.
 */
export function parseJsonc(text: string): unknown {
  return JSON.parse(removeTrailingCommas(removeComments(text)));
}

function removeComments(text: string): string {
  let output = '';
  let index = 0;

  while (index < text.length) {
    const char = text.charAt(index);
    const next = text.charAt(index + 1);

    if (char === '"') {
      const end = findStringEnd(text, index);
      output += text.slice(index, end);
      index = end;
    } else if (char === '/' && next === '/') {
      const end = text.indexOf('\n', index);
      index = end === -1 ? text.length : end;
    } else if (char === '/' && next === '*') {
      const end = text.indexOf('*/', index + 2);
      index = end === -1 ? text.length : end + 2;
    } else {
      output += char;
      index += 1;
    }
  }

  return output;
}

function removeTrailingCommas(text: string): string {
  let output = '';
  let index = 0;

  while (index < text.length) {
    const char = text.charAt(index);

    if (char === '"') {
      const end = findStringEnd(text, index);
      output += text.slice(index, end);
      index = end;
      continue;
    }

    if (char === ',' && isFollowedByCloser(text, index + 1)) {
      index += 1;
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}

/** Index just past the closing quote of the string starting at `start`. */
function findStringEnd(text: string, start: number): number {
  let index = start + 1;

  while (index < text.length) {
    const char = text.charAt(index);
    if (char === '\\') {
      index += 2;
    } else if (char === '"') {
      return index + 1;
    } else {
      index += 1;
    }
  }

  return text.length;
}

function isFollowedByCloser(text: string, start: number): boolean {
  for (let index = start; index < text.length; index++) {
    const char = text.charAt(index);
    if (char === '}' || char === ']') {
      return true;
    }
    if (!/\s/.test(char)) {
      return false;
    }
  }

  return false;
}
