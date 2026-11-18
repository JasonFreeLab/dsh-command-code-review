import test from "node:test";
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import CommandRuntime from "@deepseek-ai/dsh-commands";
import { apply, Config, name, inject } from "../lib/index.js";

/** Build the smallest loader-shaped context that records the registered command. */
function harness(config) {
  let definition;
  apply(
    {
      commands: {
        register(value) {
          definition = value;
          return () => {};
        },
      },
    },
    config,
  );
  return definition;
}

/** Invoke the registered handler with one raw input and capture the delivered message. */
function invoke(definition, rawInput) {
  let delivered;
  const result = definition.handler({
    rawInput,
    agent: {
      followup(message) {
        delivered = message;
      },
    },
  });
  return { result, delivered };
}

test("exports the dsh 0.2.x plugin surface", () => {
  assert.equal(name, "command-code-review");
  assert.deepEqual(inject, ["commands"]);
  assert.equal(typeof apply, "function");
  assert.equal(typeof Config, "function");
});

test("Config applies the documented defaults", () => {
  assert.deepEqual(Config({}), {
    threshold: 80,
    outputDir: "doc",
    lenses: [],
    autoLenses: true,
    postComment: false,
    inlineComments: true,
  });
});

test("Config rejects values outside the documented ranges", () => {
  assert.throws(() => Config({ threshold: 101 }), /threshold/);
  assert.throws(() => Config({ threshold: -1 }), /threshold/);
  assert.throws(() => Config({ outputDir: 5 }), /outputDir/);
});

test("registers one global /code-review command", () => {
  const definition = harness(Config({}));
  assert.equal(definition.name, "code-review");
  assert.equal(definition.description, "Code review a pull request or a local change/requirement");
  assert.equal(definition.input.hint, "[pr number/url | review request] [--comment] [--inline] [--out <dir>] [--no-validate] [--no-report]");
});

test("registration is accepted by the real dsh CommandRuntime", () => {
  const ctx = new Context();
  const runtime = new CommandRuntime(ctx);
  apply({ commands: runtime }, Config({}));
  const agent = { id: "test-agent" };
  const definition = runtime.find(agent, "code-review");
  assert.equal(definition?.name, "code-review");
  assert.deepEqual(runtime.list(agent).map((descriptor) => descriptor.name), ["code-review"]);
});

test("delivers a notice user message with this plugin's own source kind", () => {
  const definition = harness(Config({}));
  const { delivered } = invoke(definition, "123");
  // dsh 0.2 removed the shared `plugin` source kind and requires a producer kind.
  assert.equal(delivered.role, "user");
  assert.deepEqual(delivered.source, {
    kind: "command-code-review",
    form: "notice",
    summary: "Code review started",
  });
  assert.equal(typeof delivered.id, "string");
  assert.equal(delivered.content.length, 1);
  assert.equal(delivered.content[0].type, "text");
});

test("routes a pull-request target to the pull-request workflow", () => {
  const definition = harness(Config({}));
  const { result, delivered } = invoke(definition, "  https://github.com/owner/repo/pull/12 ");
  assert.deepEqual(result, { kind: "success", text: "Code review started." });
  const text = delivered.content[0].text;
  assert.ok(text.startsWith("Target pull request: https://github.com/owner/repo/pull/12"));
  assert.match(text, /Provide a code review for the given pull request/);
  assert.match(text, /gh pr view <number> --comments/);
});

test("routes empty input through the open-PR probe before the local workflow", () => {
  const definition = harness(Config({}));
  const { delivered } = invoke(definition, "   ");
  const text = delivered.content[0].text;
  assert.ok(text.startsWith("First check whether the current branch has an open pull request"));
  assert.match(text, /Review the code for the request below/);
  assert.match(text, /write the review report to a markdown document/i);
});

test("routes a named request to the local workflow with the configured output directory", () => {
  const definition = harness(Config({ outputDir: "reports" }));
  const { delivered } = invoke(definition, "review src/auth --out out-dir");
  const text = delivered.content[0].text;
  assert.ok(text.startsWith("Review request: review src/auth"));
  assert.match(text, /out-dir/);
  assert.doesNotMatch(text, /REPORT_OUTPUT_DIR/);
});

test("renders the configured confidence threshold into the workflow", () => {
  const definition = harness(Config({ threshold: 90 }));
  const { delivered } = invoke(definition, "review src/auth");
  const text = delivered.content[0].text;
  assert.match(text, /Confidence threshold\*\*: 90/);
  assert.match(text, /below 90/);
  assert.doesNotMatch(text, /CONFIDENCE_THRESHOLD/);
});

test("configures the enabled review lenses", () => {
  const definition = harness(Config({ lenses: ["bugs"] }));
  const { delivered } = invoke(definition, "review src/auth");
  const text = delivered.content[0].text;
  assert.match(text, /bug & correctness scan/);
  assert.doesNotMatch(text, /historical context/);
});

test("lenses workflow uses the dsh 0.2.x async subagent contract", () => {
  const definition = harness(Config({}));
  const text = invoke(definition, "review src/auth").delivered.content[0].text;
  // dsh 0.2.x subagent calls always return immediately; there is no background flag.
  assert.doesNotMatch(text, /run_in_background/);
  assert.match(text, /Each launch returns immediately/);
  assert.match(text, /notifies you automatically/);
});

/** The numbered workflow steps, in order, before the output-format examples. */
function workflowSteps(text) {
  const end = Math.max(text.indexOf("For the findings section"), text.indexOf("For your final report"));
  return text
    .slice(0, end === -1 ? text.length : end)
    .split("\n")
    .filter((line) => /^(\s*- )?\d+\. /.test(line))
    .map((line) => Number(line.trim().split(".")[0].replace("- ", "")));
}

test("every workflow variant numbers its steps in ascending order", () => {
  const definition = harness(Config({}));
  for (const input of [
    "123",
    "123 --comment",
    "123 --comment --inline",
    "review src/auth",
    "--no-validate review src/auth",
    "review src/auth --no-report",
    "review src/auth --comment",
  ]) {
    const steps = workflowSteps(invoke(definition, input).delivered.content[0].text);
    assert.ok(steps.length >= 10, `${input}: expected explicit steps, got ${steps}`);
    for (let i = 1; i < steps.length; i++) {
      assert.ok(steps[i] >= steps[i - 1], `${input}: step ${steps[i]} follows ${steps[i - 1]}`);
    }
  }
});

test("pull-request review reports in chat unless --comment is passed", () => {
  const definition = harness(Config({}));
  const plain = invoke(definition, "123").delivered.content[0].text;
  assert.match(plain, /did not pass `--comment`/);
  assert.match(plain, /Do not post any GitHub comment/);
  assert.doesNotMatch(plain, /gh api/);

  const commented = invoke(definition, "123 --comment").delivered.content[0].text;
  assert.match(commented, /After reporting the findings in your reply, post them back to the pull request/);
  assert.match(commented, /did not pass `--inline`/);
});

test("--comment --inline posts one inline comment per confirmed issue through gh api", () => {
  const definition = harness(Config({}));
  const text = invoke(definition, "https://github.com/o/r/pull/9 --comment --inline").delivered.content[0].text;
  assert.match(text, /Post one inline review comment per confirmed issue with `gh api`/);
  assert.match(text, /POST \/repos\/<owner>\/<repo>\/pulls\/<number>\/comments/);
  assert.match(text, /never post more than one comment per unique issue/);
  assert.match(text, /GitHub suggestion block/);
});

test("config.postComment and config.inlineComments drive the defaults", () => {
  const posting = harness(Config({ postComment: true }));
  assert.match(invoke(posting, "123").delivered.content[0].text, /After reporting the findings in your reply, post them back/);

  const noInline = harness(Config({ inlineComments: false }));
  const text = invoke(noInline, "123 --comment --inline").delivered.content[0].text;
  assert.match(text, /did not pass `--inline`/);
  assert.doesNotMatch(text, /POST \/repos/);
});

test("findings are validated before deduplication and scoring", () => {
  const definition = harness(Config({}));
  const text = invoke(definition, "123").delivered.content[0].text;
  const validation = text.indexOf("Launch one validation subagent per issue");
  const dedupe = text.indexOf("Deduplicate the findings across lenses");
  const scoring = text.indexOf("Launch ONE scoring subagent");
  assert.ok(validation > 0 && validation < dedupe && dedupe < scoring, "validation → dedupe → scoring");
  assert.match(text, /HIGH-SIGNAL/);
});

test("--no-validate skips the validation pass", () => {
  const definition = harness(Config({}));
  const text = invoke(definition, "123 --no-validate").delivered.content[0].text;
  assert.match(text, /Skip the validation pass for this run/);
  assert.doesNotMatch(text, /Launch one validation subagent/);
});

test("--no-report keeps the local review in chat only", () => {
  const definition = harness(Config({}));
  const without = invoke(definition, "review src/auth --no-report").delivered.content[0].text;
  assert.match(without, /do not write any report document or JSON sidecar/);
  assert.doesNotMatch(without, /code-review-<sha7>-<slug>\.md/);
  const withReport = invoke(definition, "review src/auth").delivered.content[0].text;
  assert.match(withReport, /code-review-<sha7>-<slug>\.md/);
});
