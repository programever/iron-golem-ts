#!/usr/bin/env node

import { Command } from 'commander';
import { runAudit } from './lib/audit';
import { runAuditChanges } from './lib/auditChanges';
import { runReport } from './lib/report';
import { generateHtmlReport } from './lib/htmlReport';
import { stringNumberDecoder } from './data/decoders';

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
  .action(async (opts) => {
    console.info('🚀 Iron Golem is running...');
    switch (opts.kind) {
      case 'report':
        const reportDepth = stringNumberDecoder.verify(opts.reportDepth);
        await runReport(reportDepth, opts.reportPath);
        break;
      case 'changes':
        await runAuditChanges();
        console.info('✅ No TypeScript Error for files changed in the latest commit.');
        break;
      default:
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
        break;
    }
  });

program.parse();
