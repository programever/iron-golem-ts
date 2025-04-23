import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { parseTscErrors, runTsc } from './tsc';
import { format, getDateMonthsAgo, subDays } from '../data/date';
import * as JD from 'decoders';

export type AuditOptions = {
  pathStr: string;
  sequence: number;
  maxMonthAgo: number;
  nvmPath: string;
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

export async function runAudit({
  pathStr,
  sequence,
  maxMonthAgo,
  nvmPath
}: AuditOptions): Promise<AuditData[]> {
  throwIfUnCommittedChanges();

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
  const commits = generateCommits(generateCommitOptions, []);
  const auditData = generateAuditData(nvmPath, cachePath, cache, commits);

  revertToOriginalBranch(nvmPath, currentBranch);

  return auditData;
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
  const hash = execSync(`git rev-list -1 --before="${dateStr}" origin/${currentBranch}`, {
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
  nvmPath: string | null,
  cachePath: string,
  cache: Record<string, AuditData>,
  commits: CommitData[]
): AuditData[] {
  if (commits.length === 0) {
    return [];
  }

  const [commit, ...rest] = commits;
  const { hash, targetDate, commitDate } = commit;
  const auditData = processCommit(nvmPath, hash, targetDate, commitDate, cache);

  // Keep mutating the cache and keep writing it to the file
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');

  return [auditData, ...generateAuditData(nvmPath, cachePath, cache, rest)];
}

function processCommit(
  nvmPath: string | null,
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
  if (nvmPath) {
    useNvm(nvmPath);
  }
  execSync('npm ci --silent', { stdio: 'ignore' });

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

function useNvm(nvmPath: string): void {
  const nvmVersion = readNvmrc();
  execSync(`bash -c "source ${nvmPath} && nvm install ${nvmVersion}"`, { stdio: 'ignore' });
  execSync(`bash -c "source ${nvmPath} && nvm use ${nvmVersion}"`, { stdio: 'ignore' });
}

function readNvmrc(): string | null {
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

function revertToOriginalBranch(nvmPath: string | null, currentBranch: string): void {
  execSync(`git reset --hard && git checkout ${currentBranch}`, { stdio: 'ignore' });
  if (nvmPath) {
    useNvm(nvmPath);
  }
  execSync('npm ci --silent', { stdio: 'ignore' });
}
