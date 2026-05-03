import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HumanMessage } from "@langchain/core/messages";
import { config } from "../src/config.ts";

import { buildSalesGraph } from "../src/graph/graph.ts";
import { createCypherGeneratorNode } from "../src/graph/nodes/cypherGeneratorNode.ts";
import { createCypherCorrectionNode } from "../src/graph/nodes/cypherCorrectionNode.ts";

import {
  MockOpenRouterService,
  createMockNeo4jService,
} from "./mocks.ts";

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
    timeoutHandle = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
  });

  const result = await Promise.race([
    promise.then((value) => ({ timedOut: false as const, value })),
    timeoutPromise,
  ]);

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  return result;
}

describe("Offline stress tests for anomaly flows", () => {
  it("handles planner+generator anomalies without infinite correction loop", async () => {
    const llm = new MockOpenRouterService([
      { error: "planner unavailable" },
      { error: "planner still unavailable" },
      { data: { query: "   " } },
      { error: "correction failed" },
      {
        data: {
          answer: "Falha controlada ao processar consulta.",
          followUpQuestions: ["Tente reformular a pergunta?"],
        },
      },
    ]);

    const neo4j = createMockNeo4jService({
      validateResult: false,
    });

    const graph = buildSalesGraph(llm as any, neo4j as any);

    const run = graph.invoke({
      messages: [new HumanMessage("List all available courses")],
    });

    const result = await withTimeout(run, 300);

    assert.equal(result.timedOut, false);
    if (!result.timedOut) {
      assert.ok(result.value.error);
      assert.ok(result.value.answer);
    }
  });

  it("handles empty correctedQuery anomaly and exits with terminal error", async () => {
    const llm = new MockOpenRouterService([
      { error: "planner unavailable" },
      { error: "planner still unavailable" },
      { data: { query: "MATCH bad RETURN x" } },
      { data: { correctedQuery: "   ", explanation: "empty" } },
      {
        data: {
          answer: "Não foi possível corrigir a consulta automaticamente.",
          followUpQuestions: ["Deseja tentar uma pergunta mais específica?"],
        },
      },
    ]);

    const neo4j = createMockNeo4jService({
      validateResult: false,
    });

    const graph = buildSalesGraph(llm as any, neo4j as any);
    const run = graph.invoke({
      messages: [new HumanMessage("Show me revenue")],
    });

    const result = await withTimeout(run, 300);

    assert.equal(result.timedOut, false);
    if (!result.timedOut) {
      assert.ok(String(result.value.error).includes("Failed to execute Cypher query"));
      assert.ok(result.value.answer);
    }
  });

  it("stress-tests malformed generator payloads", async () => {
    const malformedPayloads = [
      undefined,
      null,
      {},
      { query: "" },
      { query: "   " },
      { query: 123 },
      { query: false },
      { foo: "bar" },
    ];

    for (const payload of malformedPayloads) {
      const llm = new MockOpenRouterService([{ data: payload }]);
      const neo4j = createMockNeo4jService();
      const node = createCypherGeneratorNode(llm as any, neo4j as any);

      const result = await node({ question: "Q" } as any);

      assert.ok(result.error, `Expected error for payload: ${JSON.stringify(payload)}`);
      assert.equal(result.query, undefined);
    }
  });

  it("stress-tests malformed correction payloads that should be gracefully handled", async () => {
    const malformedPayloads = [
      undefined,
      null,
      {},
      { correctedQuery: "" },
      { correctedQuery: "   " },
      { explanation: "missing query" },
    ];

    for (const payload of malformedPayloads) {
      const llm = new MockOpenRouterService([{ data: payload }]);
      const neo4j = createMockNeo4jService();
      const node = createCypherCorrectionNode(llm as any, neo4j as any);

      const result = await node({
        question: "Q",
        query: "MATCH bad",
        validationError: "syntax error",
        correctionAttempts: 0,
        needsCorrection: true,
      } as any);

      assert.ok(result.error, `Expected correction error for payload: ${JSON.stringify(payload)}`);
      assert.equal(result.needsCorrection, false);
      assert.equal(result.correctionAttempts, 1);
    }
  });

  it("handles invalid non-string correctedQuery type as terminal correction failure", async () => {
    const llm = new MockOpenRouterService([{ data: { correctedQuery: 999 } }]);
    const neo4j = createMockNeo4jService();
    const node = createCypherCorrectionNode(llm as any, neo4j as any);

    const result = await node({
      question: "Q",
      query: "MATCH bad",
      validationError: "syntax error",
      correctionAttempts: 0,
      needsCorrection: true,
    } as any);

    assert.equal(
      result.error,
      "Query correction failed: model returned invalid corrected query type",
    );
    assert.equal(result.needsCorrection, false);
    assert.equal(result.correctionAttempts, 1);
  });

  it("prevents client hang when upstream LLM never resolves", async () => {
    const llm = new MockOpenRouterService([
      { error: "planner unavailable" },
      { error: "planner still unavailable" },
      { data: { query: "MATCH bad RETURN x" } },
      { hang: true },
    ]);

    const neo4j = createMockNeo4jService({
      validateResult: false,
    });

    const graph = buildSalesGraph(llm as any, neo4j as any);
    const run = graph.invoke({
      messages: [new HumanMessage("Cause correction hang")],
    });

    const result = await withTimeout(run, config.llmTimeoutMs + 300);

    assert.equal(result.timedOut, false);
    if (!result.timedOut) {
      assert.ok(result.value.error);
      assert.ok(result.value.answer);
    }
  });
});
