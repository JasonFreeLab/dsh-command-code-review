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
  assert.deepEqual(definition.input, { hint: "[pr number/url | review request] [--out <dir>]" });
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
  assert.match(text, /gh command/);
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
