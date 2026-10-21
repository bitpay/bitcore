// @ts-check
/* eslint-disable */
const builder = require('../../coverage-builder.js').default;

/**
 * @type {import('monocart-coverage-reports').CoverageReportOptions}
 */
const config = builder({
  bytes: 80,
  statements: 80,
  branches: 90,
  functions: 80,
  lines: 80
});

module.exports = config;
