#!/usr/bin/env node

import * as path from 'path';
import { Command } from 'commander';
import * as JD from 'decoders';
import { runAudit } from './lib/audit';
import { runAuditChanges } from './lib/auditChanges';
import { runReport } from './lib/report';
import { generateHtmlReport } from './lib/htmlReport';
import { countDecoder, nonNegativeCountDecoder } from './data/decoders';

const optionsDecoder = JD.object({
  kind: JD.oneOf(['audit', 'changes', 'report'] as const),
  sequence: countDecoder,
  maxMonths: countDecoder,
  path: JD.string,
  nvmPath: JD.string,
  reportPath: JD.string,
  reportDepth: nonNegativeCountDecoder
});

const program = new Command();

program
  .name('iron-golem-ts')
  .description('Track and visualize TypeScript TSC errors historically with strict mode enabled.')
  .option('-k, --kind <kind>', 'Kind is either `audit` | `changes` | `report`', 'audit')
  .option('-s, --sequence <days>', 'Day interval for git history audit', '7')
  .option('-m, --max-months <months>', 'Maximum age for git history audit in months', '3')
  .option('-p, --path <path>', 'Path to generated file', 'tmp')
  .option('-n, --nvm-path <path>', 'Determine if should use nvm, Eg: ~/.nvm/nvm.sh', '')
  .option('-rp, --report-path <path>', 'Path to run report', '/')
  .option('-rd, --report-depth <number>', 'How deep the report should go down?', '999')
  .action(async (rawOpts: unknown) => {
    console.info('🚀 Iron Golem is running...');

    const opts = optionsDecoder.verify(rawOpts);
    switch (opts.kind) {
      case 'report': {
        await runReport(opts.reportDepth, opts.reportPath);
        break;
      }
      case 'changes': {
        await runAuditChanges();
        console.info('✅ No TypeScript Error for files changed in the latest commit.');
        break;
      }
      case 'audit': {
        const results = await runAudit({
          sequence: opts.sequence,
          maxMonthAgo: opts.maxMonths,
          pathStr: opts.path,
          nvmPath: opts.nvmPath === '' ? null : opts.nvmPath
        });
        await generateHtmlReport(opts.path, results);
        console.info(
          `✅ Report generated in ${path.join(opts.path, 'iron-golem-ts', 'report.html')}`
        );
        break;
      }
    }
  });

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.startsWith('💀') ? message : `💀 ${message}`);
  process.exit(1);
});
