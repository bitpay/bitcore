// @ts-check
/* eslint-disable */
const builder = require('../../coverage-builder.js').default;

/**
 * @type {import('monocart-coverage-reports').CoverageReportOptions}
 */
const config = builder({
  bytes: 60,
  statements: 70,
  branches: 50,
  functions: 70,
  lines: 70
});

module.exports = config;
