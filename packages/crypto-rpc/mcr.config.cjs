// @ts-check
/* eslint-disable */
const builder = require('./coverage-builder.js').default;


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

module.exports = config;
