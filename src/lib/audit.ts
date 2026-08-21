import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { parseTscErrors, runTsc } from './tsc';
import { detectPackageManager, InstallStrategy, resolveInstallCommand } from './packageManager';
import { format, getDateMonthsAgo, subDays } from '../data/date';
import * as JD from 'decoders';

export type AuditOptions = {
  pathStr: string;
  sequence: number;
  maxMonthAgo: number;
  nvmPath: string | null;
  install: InstallStrategy;
};

export type AuditData = {
  targetDate: Date;
  hash: string;
  commitDate: Date;
  errors: {
    [filePath: string]: number[]; // array of error codes per file
  };
};

const auditDataDecoder = JD.exact({
  targetDate: JD.string.transform((v) => new Date(v)),
  hash: JD.string,
  commitDate: JD.string.transform((v) => new Date(v)),
  errors: JD.record(JD.array(JD.number))
});

/** Everything needed to put the working tree back after a checkout. */
type Environment = {
  nvmPath: string | null;
  install: InstallStrategy;
};

export async function runAudit({
  pathStr,
  sequence,
  maxMonthAgo,
  nvmPath,
  install
}: AuditOptions): Promise<AuditData[]> {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('💀 Sequence must be a whole number of days >= 1');
  }
  if (!Number.isInteger(maxMonthAgo) || maxMonthAgo < 1) {
    throw new Error('💀 Max months must be a whole number >= 1');
  }

  throwIfUnCommittedChanges();
  logInstallStrategy(install);

  const environment: Environment = { nvmPath, install };
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: 'pipe' })
    .toString()
    .trim();
  const tmpDir = path.resolve(`${pathStr}/iron-golem-ts`);
  fs.mkdirSync(tmpDir, { recursive: true });

  // Catch will be mutated by the audit functions
  const cachePath = path.join(tmpDir, 'cache.json');
  const cache = loadCache(cachePath);

  const generateCommitOptions: GenerateCommitOptions = {
    currentBranch,
    now: new Date(),
    sequence,
    num: 0,
    maxDate: getDateMonthsAgo(maxMonthAgo),
    seenHashes: new Set<string>()
  };

  // The audit checks out historical commits, so every exit path -- including
  // Ctrl-C -- has to put the repository back on the original branch.
  const onInterrupt = (): void => {
    console.info('\n🧹 Interrupted, restoring your branch...');
    revertToOriginalBranch(environment, currentBranch);
    process.exit(130);
  };
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onInterrupt);

  try {
    const commits = generateCommits(generateCommitOptions, []);
    return generateAuditData(environment, cachePath, cache, commits);
  } finally {
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onInterrupt);
    revertToOriginalBranch(environment, currentBranch);
  }
}

function throwIfUnCommittedChanges() {
  const hasUncommittedChanges = execSync('git status --porcelain', { stdio: 'pipe' })
    .toString()
    .trim();

  if (hasUncommittedChanges) {
    throw new Error(
      '💀 Uncommitted changes detected. Please commit or stash them before running the audit.'
    );
  }
}

function logInstallStrategy(install: InstallStrategy): void {
  switch (install.type) {
    case 'auto':
      console.info(`📦 Installing dependencies with ${detectPackageManager(process.cwd())}`);
      break;
    case 'command':
      console.info(`📦 Installing dependencies with: ${install.command}`);
      break;
    case 'skip':
      console.info('📦 Skipping dependency install (reusing current node_modules)');
      break;
  }
}

function loadCache(cachePath: string): Record<string, AuditData> {
  return fs.existsSync(cachePath)
    ? JD.record(auditDataDecoder).verify(JSON.parse(fs.readFileSync(cachePath, 'utf-8')))
    : {};
}

type CommitData = { hash: string; commitDate: Date; targetDate: Date };
type GenerateCommitOptions = {
  currentBranch: string;
  now: Date;
  sequence: number;
  num: number;
  maxDate: Date;
  seenHashes: Set<string>;
};
function generateCommits(
  generateCommitOptions: GenerateCommitOptions,
  commits: CommitData[]
): CommitData[] {
  const { currentBranch, now, sequence, num, maxDate, seenHashes } = generateCommitOptions;
  const targetDate = subDays(now, num);

  if (targetDate < maxDate) {
    return commits;
  }

  const dateStr = format(targetDate, 'yyyy-MM-dd');
  const hash = execSync(`git rev-list -1 --before="${dateStr}" ${currentBranch}`, {
    stdio: 'pipe'
  })
    .toString()
    .trim();

  if (hash && !seenHashes.has(hash)) {
    seenHashes.add(hash);
    const commitDateStr = execSync(`git show -s --format=%cI ${hash}`, { stdio: 'pipe' })
      .toString()
      .trim();
    const commitDate = new Date(commitDateStr);
    commits.push({ hash, commitDate, targetDate });
  }

  return generateCommits({ ...generateCommitOptions, num: num + sequence, seenHashes }, commits);
}

function generateAuditData(
  environment: Environment,
  cachePath: string,
  cache: Record<string, AuditData>,
  commits: CommitData[]
): AuditData[] {
  const [commit, ...rest] = commits;
  if (commit === undefined) {
    return [];
  }

  const { hash, targetDate, commitDate } = commit;
  const auditData = processCommit(environment, hash, targetDate, commitDate, cache);

  // Keep mutating the cache and keep writing it to the file
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');

  return [auditData, ...generateAuditData(environment, cachePath, cache, rest)];
}

function processCommit(
  environment: Environment,
  hash: string,
  targetDate: Date,
  commitDate: Date,
  cache: Record<string, AuditData>
): AuditData {
  const cachedResult = cache[hash];

  if (cachedResult) {
    logAuditData(cachedResult);
    return cachedResult;
  }

  execSync(`git checkout ${hash}`, { stdio: 'ignore' });
  execSync('git reset --hard', { stdio: 'ignore' });
  prepareEnvironment(environment, hash.slice(0, 7));

  const result: AuditData = {
    hash: hash,
    commitDate,
    targetDate,
    errors: runTsc((s) => (s == null ? {} : parseTscErrors(s)))
  };
  logAuditData(result);
  cache[hash] = result;

  execSync('git reset --hard', { stdio: 'ignore' });
  return result;
}

/** Selects the Node version and installs dependencies for the checked-out tree. */
function prepareEnvironment({ nvmPath, install }: Environment, label: string): void {
  if (nvmPath) {
    useNvm(nvmPath);
  }

  // Resolved per commit: the lockfile (and so the package manager) can change
  // across history.
  const command = resolveInstallCommand(install, process.cwd());
  if (command === null) {
    return;
  }

  try {
    execSync(command, { stdio: 'ignore' });
  } catch {
    throw new Error(
      `💀 Installing dependencies failed at ${label} using \`${command}\`. ` +
        'Use --install-command to override it, or --skip-install to reuse the current node_modules.'
    );
  }
}

function useNvm(nvmPath: string): void {
  const nvmVersion = readNvmrc();
  execSync(`bash -c "source ${nvmPath} && nvm install ${nvmVersion}"`, { stdio: 'ignore' });
  execSync(`bash -c "source ${nvmPath} && nvm use ${nvmVersion}"`, { stdio: 'ignore' });
}

function readNvmrc(): string {
  const nvmrcPath = path.resolve('.nvmrc');
  if (!fs.existsSync(nvmrcPath)) {
    throw new Error('💀 .nvmrc file not found');
  }
  return fs.readFileSync(nvmrcPath, 'utf-8').trim();
}

export function countTotalErrors(errors: AuditData['errors']): number {
  return Object.values(errors).reduce((total, codes) => total + codes.length, 0);
}

export function flattenErrors(errors: AuditData['errors']): number[] {
  return Object.values(errors).reduce((acc, codes) => acc.concat(codes), []);
}

function logAuditData(auditData: AuditData): void {
  console.info(
    `Target date: ${format(auditData.targetDate, 'yyyy-MM-dd')} - ` +
      `Commit date: ${format(auditData.commitDate, 'yyyy-MM-dd')} - ` +
      `Commit hash: ${auditData.hash.slice(0, 7)} - Error: ${countTotalErrors(auditData.errors)}`
  );
}

function revertToOriginalBranch(environment: Environment, currentBranch: string): void {
  execSync(`git reset --hard && git checkout ${currentBranch}`, { stdio: 'ignore' });
  prepareEnvironment(environment, currentBranch);
}
