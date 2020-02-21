import path from 'path';

import glob from 'glob';
import Mocha from 'mocha';
import { Modules } from "../../src/modules";

const TIMEOUT = 5000;
const TEST_DIR = path.join(__dirname, '../unit');

function handleError(err) {
  console.error(err);
  console.log(err.stack);
  process.exit(1);
}

function runTests() {
  return new Promise(function(resolve, reject) {
    const testRunner = new Mocha();
    testRunner.timeout(TIMEOUT);
    testRunner.reporter('spec');
    Modules.loadConfigured();

    const files = glob.sync(`${TEST_DIR}/**/**.js`);
    files.forEach(function(file) {
      testRunner.addFile(file);
    });
    try {
      testRunner.run(function(failures) {
        process.exit(failures);
        resolve();
      });
    } catch (err) {
      return reject(err);
    }
  });
}

runTests()
  .then(function() {
    process.exit(0);
  })
  .catch(function(err) {
    handleError(err);
  });
