// @ts-check
/* eslint-disable */
const builder = require('../../coverage-builder.js').default;

/**
 * @type {import('monocart-coverage-reports').CoverageReportOptions}
 */
const config = builder({
  bytes: 80,
  statements: 70,
  branches: 30,
  functions: 80,
  lines: 70,
});

module.exports = config;
