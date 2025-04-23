#!/usr/bin/env node

import { Command } from 'commander';
import { runAudit } from './lib/audit';
import { generateHtmlReport } from './lib/report';
import { stringNumberDecoder } from './data/decoders';
import { runAuditChanges } from './lib/auditChanges';

const program = new Command();

program
  .name('iron-golem-ts')
  .description('Track and visualize TypeScript TSC errors historically with strict mode enabled.')
  .option('-k, --kind <kind>', 'Kind is either `none` or `changes`', 'none')
  .option('-s, --sequence <days>', 'Day interval for git history audit', '7')
  .option('-m, --max-months <months>', 'Maximum age for git history audit in months', '3')
  .option('-p, --path <path>', 'Path to generated file', 'tmp')
  .option('-n, --nvm-path <path>', 'Determine if should use nvm, Eg: ~/.nvm/nvm.sh', '')
  .action(async (opts) => {
    console.info('🚀 Iron Golem is running...');
    if (opts.kind === 'changes') {
      await runAuditChanges();
      console.info('✅ No TypeScript Error for files changed in the latest commit.');
    } else {
      const sequence = stringNumberDecoder.verify(opts.sequence);
      const maxMonthAgo = stringNumberDecoder.verify(opts.maxMonths);
      const results = await runAudit({
        sequence,
        maxMonthAgo,
        pathStr: opts.path,
        nvmPath: opts.nvmPath === '' ? null : opts.nvmPath
      });
      await generateHtmlReport(opts.path, results);
      console.info('✅ Report generated in tmp/tsc-history/report.html');
    }
  });

program.parse();
