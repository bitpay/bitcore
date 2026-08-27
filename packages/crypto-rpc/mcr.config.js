// @ts-check
import builder from './coverage-builder.js';


/**
 * @type {import('monocart-coverage-reports').CoverageReportOptions}
*/
const config = builder({
  bytes: 80,
  statements: 70,
  branches: 60,
  functions: 70,
  lines: 70
});

export default config;
