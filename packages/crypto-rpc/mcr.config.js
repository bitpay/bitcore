// @ts-check
import builder from './coverage-builder.js';


/**
 * @type {import('monocart-coverage-reports').CoverageReportOptions}
*/
const config = builder({
  bytes: 80,
  statements: 80,
  branches: 60,
  functions: 80,
  lines: 70
});

export default config;
