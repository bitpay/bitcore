// Enforces a line coverage threshold on the lcov.info produced by `hardhat test --coverage`.
// monocart-coverage-reports can't ingest lcov (and only sees the JS test process, not
// the Solidity coverage EDR collects), so we check the lcov totals directly.
// Hardhat 3's coverage only emits line data (DA/LH/LF), so lines are all we can enforce.
import fs from 'fs';
import path from 'path';

const LCOV_PATH = path.join(import.meta.dirname, '../coverage/lcov.info');
const LINE_THRESHOLD = 100;

// Test-only contracts don't count toward coverage
const EXCLUDE = [/^contracts\/mocks\//];

if (!fs.existsSync(LCOV_PATH)) {
  console.error(`Coverage file not found: ${LCOV_PATH}`);
  process.exit(1);
}

const files = [];
let current = null;
for (const line of fs.readFileSync(LCOV_PATH, 'utf8').split('\n')) {
  const [tag, value] = line.split(/:(.*)/);
  if (tag === 'SF') {
    current = EXCLUDE.some(re => re.test(value)) ? null : { name: value, found: 0, hit: 0 };
  } else if (tag === 'LF' && current) {
    current.found = Number(value);
  } else if (tag === 'LH' && current) {
    current.hit = Number(value);
  } else if (tag === 'end_of_record') {
    if (current) files.push(current);
    current = null;
  }
}

const pct = ({ found, hit }) => (found === 0 ? 100 : (hit / found) * 100);

let found = 0;
let hit = 0;
for (const f of files) {
  found += f.found;
  hit += f.hit;
  console.log(`  ${pct(f).toFixed(2).padStart(6)}%  ${f.name}`);
}

if (found === 0) {
  console.error('ERROR: No line coverage data found in lcov.info');
  process.exit(1);
}

const total = pct({ found, hit });
console.log(`Lines: ${total.toFixed(2)}% (${hit}/${found}), threshold ${LINE_THRESHOLD}%`);
if (total < LINE_THRESHOLD) {
  console.error(`ERROR: Line coverage ${total.toFixed(2)}% is below threshold ${LINE_THRESHOLD}%`);
  process.exit(1);
}
