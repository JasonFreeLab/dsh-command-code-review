import test from "node:test";
import assert from "node:assert/strict";
import { parseInvocation } from "../lib/parse.js";

/** The parser's default options when no flag is present. */
const DEFAULTS = { comment: false, inline: false, validate: true, report: true };

test("parseInvocation returns the default dir when there is no --out flag", () => {
  assert.deepEqual(parseInvocation("review src/auth", "doc"), {
    request: "review src/auth",
    outDir: "doc",
    ...DEFAULTS,
  });
  assert.deepEqual(parseInvocation("", "doc"), { request: "", outDir: "doc", ...DEFAULTS });
});

test("parseInvocation extracts --out at the start", () => {
  assert.deepEqual(parseInvocation("--out docs review src/auth", "doc"), {
    request: "review src/auth",
    outDir: "docs",
    ...DEFAULTS,
  });
});

test("parseInvocation extracts --out at the end", () => {
  assert.deepEqual(parseInvocation("review src/auth --out docs", "doc"), {
    request: "review src/auth",
    outDir: "docs",
    ...DEFAULTS,
  });
});

test("parseInvocation supports --output and the = form", () => {
  assert.deepEqual(parseInvocation("--output docs x", "doc"), { request: "x", outDir: "docs", ...DEFAULTS });
  assert.deepEqual(parseInvocation("--out=docs x", "doc"), { request: "x", outDir: "docs", ...DEFAULTS });
  assert.deepEqual(parseInvocation("--output=docs x", "doc"), { request: "x", outDir: "docs", ...DEFAULTS });
});

test("parseInvocation trims surrounding whitespace", () => {
  assert.deepEqual(parseInvocation("   --out   docs   review x   ", "doc"), {
    request: "review x",
    outDir: "docs",
    ...DEFAULTS,
  });
});

test("parseInvocation defaults: no flags means terminal output, with validation and report on", () => {
  assert.deepEqual(parseInvocation("review src/auth", "doc"), {
    request: "review src/auth",
    outDir: "doc",
    ...DEFAULTS,
  });
});

test("parseInvocation recognizes --comment and --inline", () => {
  assert.deepEqual(parseInvocation("123 --comment", "doc"), {
    request: "123",
    outDir: "doc",
    ...DEFAULTS,
    comment: true,
  });
  assert.deepEqual(parseInvocation("--comment --inline 123", "doc"), {
    request: "123",
    outDir: "doc",
    ...DEFAULTS,
    comment: true,
    inline: true,
  });
  // The parser reports --inline independently; the workflow makes it imply --comment.
  assert.equal(parseInvocation("--inline 123", "doc").inline, true);
  assert.equal(parseInvocation("--inline 123", "doc").comment, false);
});

test("parseInvocation recognizes --no-validate and --no-report", () => {
  assert.deepEqual(parseInvocation("review x --no-validate --no-report", "doc"), {
    request: "review x",
    outDir: "doc",
    ...DEFAULTS,
    validate: false,
    report: false,
  });
  // A later explicit --validate wins over an earlier --no-validate.
  assert.equal(parseInvocation("--no-validate --validate review x", "doc").validate, true);
  // Flags combine with --out.
  assert.deepEqual(parseInvocation("--out docs --comment 12", "doc"), {
    request: "12",
    outDir: "docs",
    ...DEFAULTS,
    comment: true,
  });
});

test("parseInvocation rewrites a word that matches a flag", () => {
  const { request, comment } = parseInvocation("review the --comment parsing path", "doc");
  assert.equal(request, "review the parsing path");
  assert.equal(comment, true);
});

test("parseInvocation is case-insensitive for boolean flags", () => {
  assert.equal(parseInvocation("123 --COMMENT", "doc").comment, true);
  assert.equal(parseInvocation("123 --No-Report", "doc").report, false);
  // --out keeps accepting the --OUT spelling.
  assert.equal(parseInvocation("x --OUT docs", "doc").outDir, "docs");
});
