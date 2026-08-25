import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test("package.json declares a dsh bundle", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.name, "dsh-command-code-review");
  assert.equal(pkg.dsh.bundle.patch, "./cordis.patch.yml");
  assert.ok(pkg.files.includes("cordis.patch.yml"));
  assert.ok(pkg.files.includes("lib"));
  assert.ok(pkg.peerDependencies["@deepseek-ai/dsh-commands"]);
  assert.ok(pkg.peerDependencies["@deepseek-ai/dsh-llm"]);
});

test("cordis.patch.yml mounts the command", () => {
  const patch = readFileSync(join(root, "cordis.patch.yml"), "utf8");
  assert.match(patch, /id: command-code-review/);
  assert.match(patch, /name: ['"]dsh-command-code-review['"]/);
});

test("lib/index.js registers /code-review with two modes", () => {
  const src = readFileSync(join(root, "lib/index.js"), "utf8");
  assert.match(src, /export const name = "command-code-review"/);
  assert.match(src, /export const inject = \["commands"\]/);
  assert.match(src, /name: "code-review"/);
  assert.match(src, /ctx\.commands\.register/);
  // PR mode
  assert.match(src, /const WORKFLOW_PR = /);
  assert.match(src, /Target pull request: /);
  // local mode + routing
  assert.match(src, /const WORKFLOW_LOCAL = /);
  assert.match(src, /function isPrTarget/);
  assert.match(src, /Review request: /);
  assert.doesNotMatch(src, /anthropic|claude/i);
});

test("every file listed in package.json files exists", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const f of pkg.files) {
    assert.ok(existsSync(join(root, f)), `${f} should exist`);
  }
});
