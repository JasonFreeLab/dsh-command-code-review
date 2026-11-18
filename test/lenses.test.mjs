import test from "node:test";
import assert from "node:assert/strict";
import {
  LENSES,
  DEFAULT_LENS_IDS,
  resolveLenses,
  resolveAutoLenses,
  partitionLenses,
} from "../lib/lenses.js";

test("default lens set is every non-optional lens, all registered", () => {
  assert.deepEqual(DEFAULT_LENS_IDS, ["guidance", "bugs", "security", "history", "comments"]);
  for (const id of DEFAULT_LENS_IDS) {
    assert.ok(LENSES[id], `${id} should be registered`);
    assert.ok(LENSES[id].instruction, `${id} should have an instruction`);
  }
  assert.match(LENSES.guidance.instruction, /AGENTS\.md/);
  assert.match(LENSES.guidance.instruction, /CLAUDE\.md/);
});

test("resolveLenses returns defaults when not configured", () => {
  assert.deepEqual(resolveLenses({}), DEFAULT_LENS_IDS);
  assert.deepEqual(resolveLenses({ lenses: [] }), DEFAULT_LENS_IDS);
  assert.deepEqual(resolveLenses(undefined), DEFAULT_LENS_IDS);
});

test("resolveLenses honors a configured subset, preserving order and dropping unknowns", () => {
  assert.deepEqual(resolveLenses({ lenses: ["bugs", "security"] }), ["bugs", "security"]);
  assert.deepEqual(resolveLenses({ lenses: ["bugs", "nope", "bugs", "guidance"] }), ["bugs", "guidance"]);
});

test("resolveAutoLenses defaults to true", () => {
  assert.equal(resolveAutoLenses({}), true);
  assert.equal(resolveAutoLenses({ autoLenses: true }), true);
  assert.equal(resolveAutoLenses({ autoLenses: false }), false);
});

test("partitionLenses splits core from contextual, preserving order", () => {
  const { core, contextual } = partitionLenses(["guidance", "bugs", "history", "security", "comments"]);
  assert.deepEqual(core, ["guidance", "bugs", "security"]);
  assert.deepEqual(contextual, ["history", "comments"]);
});

test("security and perf lenses expose trigger patterns for adaptive enablement", () => {
  assert.ok(Array.isArray(LENSES.security.triggers) && LENSES.security.triggers.length > 0);
  assert.ok(Array.isArray(LENSES.perf.triggers) && LENSES.perf.triggers.length > 0);
  assert.ok(LENSES.perf.optional === true);
});

test("lenses declare their validation phase and optional membership", () => {
  assert.deepEqual(
    Object.entries(LENSES).filter(([, lens]) => lens.validate).map(([id]) => id),
    ["guidance", "bugs", "security"],
  );
  for (const id of DEFAULT_LENS_IDS) {
    assert.ok(!LENSES[id].optional, `${id} should not be optional`);
  }
  assert.equal(LENSES.tests.optional, true);
  assert.ok(Array.isArray(LENSES.tests.triggers) && LENSES.tests.triggers.includes("test"));
});

test("resolveLenses accepts optional lenses explicitly", () => {
  assert.deepEqual(resolveLenses({ lenses: ["bugs", "tests", "perf"] }), ["bugs", "tests", "perf"]);
});
