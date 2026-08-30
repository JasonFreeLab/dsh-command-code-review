import test from "node:test";
import assert from "node:assert/strict";
import { parseInvocation } from "../lib/parse.js";

test("parseInvocation returns the default dir when there is no --out flag", () => {
  assert.deepEqual(parseInvocation("review src/auth", "doc"), {
    request: "review src/auth",
    outDir: "doc",
  });
  assert.deepEqual(parseInvocation("", "doc"), { request: "", outDir: "doc" });
});

test("parseInvocation extracts --out at the start", () => {
  assert.deepEqual(parseInvocation("--out docs review src/auth", "doc"), {
    request: "review src/auth",
    outDir: "docs",
  });
});

test("parseInvocation extracts --out at the end", () => {
  assert.deepEqual(parseInvocation("review src/auth --out docs", "doc"), {
    request: "review src/auth",
    outDir: "docs",
  });
});

test("parseInvocation supports --output and the = form", () => {
  assert.deepEqual(parseInvocation("--output docs x", "doc"), { request: "x", outDir: "docs" });
  assert.deepEqual(parseInvocation("--out=docs x", "doc"), { request: "x", outDir: "docs" });
  assert.deepEqual(parseInvocation("--output=docs x", "doc"), { request: "x", outDir: "docs" });
});

test("parseInvocation trims surrounding whitespace", () => {
  assert.deepEqual(parseInvocation("   --out   docs   review x   ", "doc"), {
    request: "review x",
    outDir: "docs",
  });
});
