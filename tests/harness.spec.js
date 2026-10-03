// Runs test/vpl-harness.html in a real browser and fails on any FAIL line.
const { test, expect } = require("@playwright/test");

async function harnessResults(page, query) {
  await page.goto("/test/vpl-harness.html" + query);
  const handle = await page.waitForFunction(function () { return window.testResults; });
  return handle.jsonValue();
}

test("with the fix, every harness test passes", async function ({ page }) {
  const results = await harnessResults(page, "");
  expect(results.length).toBeGreaterThan(1);
  expect(results.filter(function (r) { return !r.ok; })).toEqual([]);
});

test("without the fix, the harness reproduces VPL's paste block", async function ({ page }) {
  const results = await harnessResults(page, "?fix=0");
  expect(results.length).toBeGreaterThan(0);
  expect(results.filter(function (r) { return !r.ok; })).toEqual([]);
});
