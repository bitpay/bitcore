// @ts-check
/* eslint-disable */
const builder = require('../../coverage-builder.js').default;

/**
 * @type {import('monocart-coverage-reports').CoverageReportOptions}
 */
const config = builder({
  bytes: 60,
  statements: 60,
  branches: 40,
  functions: 60,
  lines: 60
});

module.exports = config;
