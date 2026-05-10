/**
 * Test Suite - Backward-compatible entry point
 *
 * All tests are now split into dedicated modules:
 *   - tests/ValidationTests.js — ValidationUtils unit tests
 *   - tests/DateParserTests.js — DateUtils/DateInputHelper unit tests
 *   - tests/FlowTests.js — Cancel/change flow integration tests + templates
 *   - tests/TestRunner.js — runAllTests() orchestrator + helpers
 *
 * GAS global scope: all functions from the above files are automatically available.
 */
