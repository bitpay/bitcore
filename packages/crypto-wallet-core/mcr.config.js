// @ts-check
/* eslint-disable */
const builder = require('../../coverage-builder.js').default;


/**
 * @type {import('monocart-coverage-reports').CoverageReportOptions}
*/
const config = builder({
  bytes: 70,
  statements: 60,
  branches: 60,
  functions: 60,
  lines: 70
});

module.exports = config;
