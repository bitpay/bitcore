import { run } from 'node:test';
// import path from 'path';
import { execSync } from 'child_process';

const files = execSync(`find ${__dirname} -name *.spec.js`).toString().split('\n').filter(f => !!f);
console.log(files);
const runStream = run({
  files: ['./services/storage.spec.js']
});

runStream.on('test:start', function(test) {
  console.log(test);
});
runStream.on('test:summary', function(summary) {
  console.log('here i am');
  console.log(summary);
});