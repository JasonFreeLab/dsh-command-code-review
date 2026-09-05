import test from "node:test";
import assert from "node:assert/strict";
import {
  LENSES,
  DEFAULT_LENS_IDS,
  resolveLenses,
  resolveAutoLenses,
  partitionLenses,
} from "../lib/lenses.js";

test("default lens set is the five designed lenses, all registered", () => {
  assert.deepEqual(DEFAULT_LENS_IDS, ["guidance", "bugs", "history", "security", "comments"]);
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
