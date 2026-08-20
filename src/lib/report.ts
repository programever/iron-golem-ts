import { buildNodeFromErrors, NodeTS, parseTscErrors, runTsc } from './tsc';

export async function runReport(maxDepth: number = Infinity, startPath: string): Promise<void> {
  const tscOutput = runTsc((s) => s);
  if (tscOutput == null) {
    console.info('💫 No error! Woohooo!!!');
    return;
  }

  const errors = parseTscErrors(tscOutput);
  const nodes = buildNodeFromErrors(errors);
  const startingNode = findStartingNode(nodes, startPath.split('/').filter(Boolean));

  if (startingNode === null) {
    console.error(`💀 Specified start path does not exist in the tree: ${startPath}`);
    process.exit(1);
  }

  console.info('Legend: 🔴 ≥75% | 🟠 50–74% | 🟢 25–49% | ⚪ <25% (relative to parent folder)');
  console.info(`Run for: ${startPath} with ${maxDepth} max level depth`);
  console.info(printErrorTree(startingNode, maxDepth));
}

function printErrorTree(startingNode: NodeTS, maxDepth: number = Infinity): string {
  return calculateAndPrintTree(
    startingNode,
    startingNode.errorCount,
    startingNode.errorCount,
    0,
    true,
    maxDepth
  );
}

function findStartingNode(root: NodeTS, startPath: string[]): NodeTS | null {
  const [current, ...rest] = startPath;
  if (current === undefined) {
    return root;
  }

  const child = root.children.get(current);
  if (!child) {
    return null; // If the path is invalid or does not exist
  }

  return findStartingNode(child, rest);
}

function calculateAndPrintTree(
  node: NodeTS,
  totalErrors: number,
  parentErrors: number,
  depth: number = 0,
  isLastChild: boolean = true,
  maxDepth: number = Infinity
): string {
  if (depth > maxDepth) {
    return '';
  }

  const percentage = parentErrors > 0 ? (node.errorCount / parentErrors) * 100 : 0;

  let legend: string;
  if (percentage >= 75) legend = '🔴';
  else if (percentage >= 50) legend = '🟠';
  else if (percentage >= 25) legend = '🟢';
  else legend = '⚪';

  const indentation =
    (depth > 0 ? '  '.repeat(depth - 1) : '') +
    (depth > 0 ? (isLastChild ? '  └── ' : '  ├── ') : '');
  const line = `${indentation}${legend} ${node.name || '(root)'}: ${node.errorCount} - ${percentage.toFixed(0)}%\n`;

  const children = Array.from(node.children.values());
  let childrenLines = '';
  children.forEach((child, index) => {
    const isLast = index === children.length - 1;
    childrenLines += calculateAndPrintTree(
      child,
      totalErrors,
      node.errorCount,
      depth + 1,
      isLast,
      maxDepth
    );
  });

  return line + childrenLines;
}
