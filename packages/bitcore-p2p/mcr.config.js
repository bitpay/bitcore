// @ts-check
/* eslint-disable */
const builder = require('../../coverage-builder.js').default;

/**
 * @type {import('monocart-coverage-reports').CoverageReportOptions}
 */
const config = builder({
  bytes: 90,
  statements: 90,
  branches: 90,
  functions: 90,
  lines: 90
});

module.exports = config;
