import { execSync } from 'child_process';
import { resetTsConfig, updateTsConfig } from './tsc';

export async function runPreCommit(): Promise<void> {
  const changedFiles = getChangedFiles();
  if (changedFiles.length === 0) return;

  updateTsConfig();
  const tscOutput = runTsc();
  resetTsConfig();

  const filteredErrors = filterErrorsByChangedFiles(tscOutput, changedFiles);
  if (filteredErrors.length === 0) return;

  console.error('💫 You can run `iron-golem-ts -k changes` to check the errors status.');
  console.error('💀 TypeScript errors for changed files:');
  filteredErrors.forEach((line) => console.error(line));
  process.exit(1);
}

function getChangedFiles(): string[] {
  const staged = execSync('git diff --name-only --cached', { stdio: 'pipe' }).toString();
  const unstage = execSync('git diff --name-only', { stdio: 'pipe' }).toString();
  return `${staged}\n${unstage}`
    .split('\n')
    .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
}

function runTsc(): string {
  try {
    return execSync('tsc --noEmit', { stdio: 'pipe' }).toString();
  } catch (error) {
    if (error instanceof Error && 'stdout' in error && error.stdout) {
      return error.stdout.toString();
    } else {
      throw new Error('💀 An unknown error occurred while running TSC');
    }
  }
}

function filterErrorsByChangedFiles(tscOutput: string, changedFiles: string[]): string[] {
  const filteredLines = tscOutput.split('\n').filter((line) => {
    return changedFiles.some((file) => line.includes(file));
  });

  return filteredLines;
}
