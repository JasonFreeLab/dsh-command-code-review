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
  assert.ok(pkg.peerDependencies["@deepseek-ai/schemastery"]);
});

test("package.json targets the dsh 0.2.x runtime", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  // The dsh loader rejects a bundle whose engines.dsh (or dsh peer range) does
  // not admit the running runtime.
  assert.equal(pkg.engines.dsh, "^0.2.1-rc.2");
  for (const [dependency, range] of Object.entries(pkg.peerDependencies)) {
    if (dependency === "@deepseek-ai/cordis" || dependency === "@deepseek-ai/schemastery") continue;
    assert.match(range, /^\^0\.2\.1-rc\.2$/, `${dependency} should target dsh 0.2.1`);
  }
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
  assert.match(src, /function buildPrWorkflow/);
  assert.match(src, /Target pull request: /);
  // local mode + routing
  assert.match(src, /function buildLocalWorkflow/);
  assert.match(src, /function isPrTarget/);
  assert.match(src, /Review request: /);
  assert.match(src, /DEFAULT_THRESHOLD = 80/);
  assert.match(src, /config\.threshold/);
  assert.match(src, /renderWorkflow/);
  assert.doesNotMatch(src, /anthropic/i);
});

test("lib/index.js adapts to the dsh 0.2.x message and subagent contracts", () => {
  const src = readFileSync(join(root, "lib/index.js"), "utf8");
  // dsh 0.2 removed the shared `plugin` message source kind.
  assert.match(src, /kind: "command-code-review"/);
  assert.doesNotMatch(src, /kind: "plugin"/);
  // dsh 0.2 subagent calls always run asynchronously; there is no such flag.
  assert.doesNotMatch(src, /run_in_background/);
  assert.match(src, /export const Config = Schema\.object/);
  assert.match(src, /notifies you automatically/);
});

test("lib/index.js defines a report template and document output", () => {
  const src = readFileSync(join(root, "lib/index.js"), "utf8");
  assert.match(src, /const REPORT_TEMPLATE = /);
  assert.match(src, /REPORT_OUTPUT_DIR/);
  assert.match(src, /config\.outputDir/);
  assert.match(src, /git rev-parse --short HEAD/);
  assert.match(src, /code-review-<sha7>-<slug>\.md/);
  assert.match(src, /code-review-<slug>\.md/);
  assert.match(src, /mkdir -p/);
  assert.match(src, /Write the review report to a markdown document in English/);
  assert.match(src, /parseInvocation/);
  assert.match(src, /--out/);
});

test("lib/index.js drives lenses, severity, dedup, batch scoring, and JSON output", () => {
  const src = readFileSync(join(root, "lib/index.js"), "utf8");
  assert.match(src, /from "\.\/lenses\.js"/);
  assert.match(src, /resolveLenses/);
  assert.match(src, /resolveAutoLenses/);
  assert.match(src, /renderLensList/);
  assert.match(src, /SEVERITY_RUBRIC/);
  assert.match(src, /blocker/);
  assert.match(src, /Deduplicate/);
  assert.match(src, /ONE scoring subagent/);
  assert.match(src, /machine-readable/);
  assert.match(src, /\.json/);
});

test("every file listed in package.json files exists", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const f of pkg.files) {
    assert.ok(existsSync(join(root, f)), `${f} should exist`);
  }
});
