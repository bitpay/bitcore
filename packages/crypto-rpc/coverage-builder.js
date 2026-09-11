import fs from 'fs';
import path from 'path';
import EC from 'eight-colors';

/**
 * Create a coverage config from threshold information.
 * 
 * @param params.bytes minimum number of bytes to pass
 * @param params.statements minimum number of statements to pass
 * @param params.branches minimum number of branches to pass
 * @param params.functions minimum number of functions to pass
 * @param params.lines minimum number of lines to pass
 * @return config for coverage
 */
const coverageBuilder = (thresholds) => {
  const allDirs = ['src', 'lib', 'build/src', 'ts_build/src', 'ecdsa', 'ecies'];
  const dirs = allDirs.filter(dir => fs.existsSync(dir));

  return {
    reports: ['console-summary', 'v8', 'v8-json'],
    outputDir: 'coverage',
    entryFilter: (entry) => {
      const fileName = entry.url.slice('file://'.length);
      for (const dir of dirs) {
        if (fileName.startsWith(path.join(process.cwd(), dir))
          && fileName.endsWith('.js')) return true;
      }
      return false;
    },
    onEnd: (coverageResults) => {
      const errors = [];
      const { summary } = coverageResults;

      for (const k of Object.keys(thresholds)) {
        const pct = summary[k].pct;
        if (pct < thresholds[k]) {
          errors.push(`${k[0].toUpperCase() + k.slice(1)} ${pct}% less than ${thresholds[k]}%`);
        }
      }
      console.log(`See ${process.cwd()}/coverage/index.html for details on each file`);
      console.log('Thresholds: ' + Object.keys(thresholds).map(key => `${key[0].toUpperCase() + key.slice(1)}: ${thresholds[key]}%`).join(' '));
      if (errors.length) {
        const errMsg = errors.join('\n');
        console.log(EC.red(errMsg));
        process.exit(1);
      }
      console.log(EC.green('Sufficient Coverage'));
    }
  };
};

export default coverageBuilder;
