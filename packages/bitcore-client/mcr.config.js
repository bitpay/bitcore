// @ts-check
/* eslint-disable */
const builder = require('../../coverage-builder.js').default;

/**
 * @type {import('monocart-coverage-reports').CoverageReportOptions}
 */
const config = builder({
  bytes: 60,
  statements: 50,
  branches: 40,
  functions: 50,
  lines: 50
});

module.exports = config;
