const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, '..', 'server', 'test');
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts'));

console.log(`Found ${files.length} server test suites to run individually.`);
let passed = 0;
let failed = 0;
const results = [];

for (const file of files) {
  const filePath = path.join(testDir, file);
  process.stdout.write(`Running server/test/${file}... `);
  try {
    const out = execSync(`npx tsx "${filePath}"`, {
      cwd: path.join(__dirname, '..', 'server'),
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 60000,
      encoding: 'utf8'
    });
    console.log('PASSED');
    passed++;
    results.push({ file, status: 'PASSED' });
  } catch (err) {
    console.log('FAILED');
    console.error(err.stdout || err.message);
    failed++;
    results.push({ file, status: 'FAILED', error: err.message });
  }
}

console.log(`\nServer Test Summary: ${passed} passed, ${failed} failed out of ${files.length} suites.`);
if (failed > 0) {
  process.exit(1);
}
