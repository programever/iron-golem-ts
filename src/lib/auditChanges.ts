import * as path from 'path';
import { execSync } from 'child_process';
import { parseTscErrorLine, runTsc } from './tsc';

export async function runAuditChanges(): Promise<void> {
  const changedFiles = getChangedFiles();
  if (changedFiles.length === 0) return;

  const tscOutput = runTsc((s) => s);
  if (tscOutput == null) return;

  const filteredErrors = filterErrorsByChangedFiles(tscOutput, changedFiles);
  if (filteredErrors.length === 0) return;

  console.error('💫 You can run `iron-golem-ts -k changes` to check the errors status.');
  console.error('💀 TypeScript errors for changed files:');
  filteredErrors.forEach((line) => console.error(line));
  process.exit(1);
}

/**
 * `--porcelain -z` keeps the fixed-width `XY ` prefix but drops git's C-style
 * quoting, so paths with spaces or unicode survive intact. `-uall` is required
 * because git otherwise collapses an untracked directory into a single entry,
 * hiding every new file inside it.
 */
export function getChangedFiles(): string[] {
  const output = execSync('git status --porcelain -z -uall', { encoding: 'utf-8' });
  return parseStatusEntries(output.split('\0'));
}

export function parseStatusEntries(entries: string[]): string[] {
  const files: string[] = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (entry === undefined || entry.length < 4) {
      continue;
    }

    files.push(entry.slice(3));

    // Renames and copies emit the source path as its own entry; skip it.
    const status = entry.slice(0, 2);
    if (status.includes('R') || status.includes('C')) {
      index += 1;
    }
  }

  return files;
}

export function filterErrorsByChangedFiles(tscOutput: string, changedFiles: string[]): string[] {
  const changed = new Set(changedFiles.map(normalizePath));

  return tscOutput.split('\n').filter((line) => {
    const parsed = parseTscErrorLine(line);
    return parsed !== null && changed.has(normalizePath(parsed.filePath));
  });
}

/** Compare whole paths, so `src/a.ts` no longer matches `src/a.ts.bak`. */
function normalizePath(filePath: string): string {
  return path.normalize(filePath).split(path.sep).join('/').replace(/^\.\//, '');
}
