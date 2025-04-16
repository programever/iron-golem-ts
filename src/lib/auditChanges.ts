import { execSync } from 'child_process';
import { runTsc } from './tsc';

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

function getChangedFiles(): string[] {
  const staged = execSync('git diff --name-only --cached', { stdio: 'pipe' }).toString();
  const unstage = execSync('git diff --name-only', { stdio: 'pipe' }).toString();
  return `${staged}\n${unstage}`
    .split('\n')
    .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
}

function filterErrorsByChangedFiles(tscOutput: string, changedFiles: string[]): string[] {
  const filteredLines = tscOutput.split('\n').filter((line) => {
    return changedFiles.some((file) => line.includes(file));
  });

  return filteredLines;
}
