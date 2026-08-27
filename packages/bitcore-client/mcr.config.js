// @ts-check
/* eslint-disable */
const builder = require('../../coverage-builder.js').default;

/**
 * @type {import('monocart-coverage-reports').CoverageReportOptions}
 */
const config = builder({
  bytes: 50,
  statements: 50,
  branches: 50,
  functions: 50,
  lines: 50
});

module.exports = config;
