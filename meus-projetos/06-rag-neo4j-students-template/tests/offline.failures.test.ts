import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HumanMessage } from "@langchain/core/messages";

import { createExtractQuestionNode } from "../src/graph/nodes/extractQuestionNode.ts";
import { createQueryPlannerNode } from "../src/graph/nodes/queryPlannerNode.ts";
import { createCypherGeneratorNode } from "../src/graph/nodes/cypherGeneratorNode.ts";
import { createCypherCorrectionNode } from "../src/graph/nodes/cypherCorrectionNode.ts";
import { createCypherExecutorNode } from "../src/graph/nodes/cypherExecutorNode.ts";
import { createAnalyticalResponseNode } from "../src/graph/nodes/analyticalResponseNode.ts";

import {
  MockOpenRouterService,
  createMockNeo4jService,
} from "./mocks.ts";

describe("Offline failure-mode tests", () => {
  describe("extractQuestion node", () => {
    it("returns error when messages are missing", async () => {
      const node = createExtractQuestionNode();
      const result = await node({} as any);

      assert.equal(result.error, "No messages provided");
    });

    it("returns extracted question for valid message", async () => {
      const node = createExtractQuestionNode();
      const result = await node({
        messages: [new HumanMessage("List all courses")],
      } as any);

      assert.equal(result.question, "List all courses");
      assert.equal(result.error, undefined);
    });
  });

  describe("queryPlanner node", () => {
    it("falls back to simple mode when planner LLM fails", async () => {
      const llm = new MockOpenRouterService([{ error: "planner unavailable" }]);
      const node = createQueryPlannerNode(llm as any);

      const result = await node({ question: "Show revenue by course" } as any);

      assert.equal(result.isMultiStep, false);
      assert.equal(result.error, undefined);
    });

    it("builds decomposition fields when planner returns sub-questions", async () => {
      const llm = new MockOpenRouterService([
        {
          data: {
            complexity: "complex",
            requiresDecomposition: true,
            subQuestions: ["Q1", "Q2"],
            reasoning: "needs split",
          },
        },
      ]);
      const node = createQueryPlannerNode(llm as any);

      const result = await node({ question: "Complex question" } as any);

      assert.equal(result.isMultiStep, true);
      assert.deepEqual(result.subQuestions, ["Q1", "Q2"]);
      assert.equal(result.currentStep, 0);
      assert.deepEqual(result.subQueries, []);
      assert.deepEqual(result.subResults, []);
    });

    it("retries once and succeeds when second planner attempt is valid", async () => {
      const llm = new MockOpenRouterService([
        { error: "temporary planner failure" },
        {
          data: {
            complexity: "complex",
            requiresDecomposition: true,
            subQuestions: ["Q1", "Q2"],
            reasoning: "needs split",
          },
        },
      ]);
      const node = createQueryPlannerNode(llm as any);

      const result = await node({ question: "Complex question" } as any);

      assert.equal(result.isMultiStep, true);
      assert.deepEqual(result.subQuestions, ["Q1", "Q2"]);
    });
  });

  describe("cypherGenerator node", () => {
    it("returns explicit error when structured response is empty", async () => {
      const llm = new MockOpenRouterService([{ data: undefined }]);
      const neo4j = createMockNeo4jService({ schema: "schema" });
      const node = createCypherGeneratorNode(llm as any, neo4j as any);

      const result = await node({ question: "List all courses" } as any);

      assert.match(String(result.error), /Failed to generate Cypher query/);
    });

    it("returns explicit error when query is whitespace", async () => {
      const llm = new MockOpenRouterService([{ data: { query: "   " } }]);
      const neo4j = createMockNeo4jService({ schema: "schema" });
      const node = createCypherGeneratorNode(llm as any, neo4j as any);

      const result = await node({ question: "List all courses" } as any);

      assert.equal(
        result.error,
        "Failed to generate Cypher query: model returned empty query",
      );
    });

    it("returns trimmed query on valid output", async () => {
      const llm = new MockOpenRouterService([
        { data: { query: "  MATCH (c:Course) RETURN c.name AS courseName  " } },
      ]);
      const neo4j = createMockNeo4jService({ schema: "schema" });
      const node = createCypherGeneratorNode(llm as any, neo4j as any);

      const result = await node({ question: "List all courses" } as any);

      assert.equal(result.query, "MATCH (c:Course) RETURN c.name AS courseName");
    });
  });

  describe("cypherCorrection node", () => {
    it("stops correction path and increments attempts on LLM error", async () => {
      const llm = new MockOpenRouterService([{ error: "bad correction response" }]);
      const neo4j = createMockNeo4jService({ schema: "schema" });
      const node = createCypherCorrectionNode(llm as any, neo4j as any);

      const result = await node({
        question: "Q",
        query: "MATCH (n) RETURN n",
        validationError: "syntax error",
        correctionAttempts: 0,
        needsCorrection: true,
      } as any);

      assert.equal(result.correctionAttempts, 1);
      assert.equal(result.needsCorrection, false);
      assert.match(String(result.error), /Query correction failed/);
    });

    it("fails when corrected query is empty", async () => {
      const llm = new MockOpenRouterService([
        { data: { correctedQuery: "   ", explanation: "none" } },
      ]);
      const neo4j = createMockNeo4jService({ schema: "schema" });
      const node = createCypherCorrectionNode(llm as any, neo4j as any);

      const result = await node({
        question: "Q",
        query: "MATCH (n) RETURN n",
        validationError: "syntax error",
        correctionAttempts: 0,
        needsCorrection: true,
      } as any);

      assert.equal(result.correctionAttempts, 1);
      assert.equal(result.needsCorrection, false);
      assert.equal(
        result.error,
        "Query correction failed: model returned empty corrected query",
      );
    });

    it("returns corrected query and clears validation flags", async () => {
      const llm = new MockOpenRouterService([
        {
          data: {
            correctedQuery: " MATCH (c:Course) RETURN c.name AS courseName ",
            explanation: "fixed alias",
          },
        },
      ]);
      const neo4j = createMockNeo4jService({ schema: "schema" });
      const node = createCypherCorrectionNode(llm as any, neo4j as any);

      const result = await node({
        question: "Q",
        query: "MATCH c RETURN c",
        validationError: "invalid query",
        correctionAttempts: 0,
        needsCorrection: true,
      } as any);

      assert.equal(result.query, "MATCH (c:Course) RETURN c.name AS courseName");
      assert.equal(result.correctionAttempts, 1);
      assert.equal(result.validationError, undefined);
      assert.equal(result.needsCorrection, false);
    });
  });

  describe("cypherExecutor node", () => {
    it("triggers correction on invalid query before attempts are exhausted", async () => {
      const neo4j = createMockNeo4jService({ validateResult: false });
      const node = createCypherExecutorNode(neo4j as any);

      const result = await node({
        query: "MATCH bad",
        correctionAttempts: 0,
      } as any);

      assert.equal(result.needsCorrection, true);
      assert.equal(result.validationError, "Invalid Cypher query");
    });

    it("returns terminal error when correction attempts are exhausted", async () => {
      const neo4j = createMockNeo4jService({ validateResult: false });
      const node = createCypherExecutorNode(neo4j as any);

      const result = await node({
        query: "MATCH bad",
        correctionAttempts: 1,
      } as any);

      assert.equal(result.error, "Failed to execute Cypher query");
    });

    it("returns no-results error when query is valid but empty", async () => {
      const neo4j = createMockNeo4jService({
        validateResult: true,
        queryResult: [],
      });
      const node = createCypherExecutorNode(neo4j as any);

      const result = await node({
        query: "MATCH (c:Course) RETURN c",
        correctionAttempts: 0,
      } as any);

      assert.equal(
        result.error,
        "Query executed successfully but returned no results",
      );
      assert.deepEqual(result.dbResults, []);
    });

    it("returns dbResults when execution succeeds", async () => {
      const neo4j = createMockNeo4jService({
        validateResult: true,
        queryResult: [{ courseName: "JS Expert" }],
      });
      const node = createCypherExecutorNode(neo4j as any);

      const result = await node({
        query: "MATCH (c:Course) RETURN c.name AS courseName",
      } as any);

      assert.deepEqual(result.dbResults, [{ courseName: "JS Expert" }]);
      assert.equal(result.needsCorrection, false);
    });
  });

  describe("analyticalResponse node", () => {
    it("returns synthetic error response when LLM fails in error branch", async () => {
      const llm = new MockOpenRouterService([{ error: "response error" }]);
      const node = createAnalyticalResponseNode(llm as any);

      const result = await node({
        error: "Failed to execute Cypher query",
        question: "Q",
        messages: [new HumanMessage("Q")],
      } as any);

      assert.match(String(result.answer), /Error response generation failed/);
      assert.ok(Array.isArray(result.followUpQuestions));
    });

    it("returns no-results fallback payload when no db results and LLM has data", async () => {
      const llm = new MockOpenRouterService([
        {
          data: {
            answer: "No matches found, try filtering by status paid",
            followUpQuestions: ["Try another filter?"],
          },
        },
      ]);
      const node = createAnalyticalResponseNode(llm as any);

      const result = await node({
        question: "Q",
        query: "MATCH ...",
        dbResults: [],
        messages: [new HumanMessage("Q")],
      } as any);

      assert.equal(result.answer, "No matches found, try filtering by status paid");
      assert.deepEqual(result.followUpQuestions, ["Try another filter?"]);
    });

    it("returns response generation failure in success path", async () => {
      const llm = new MockOpenRouterService([{ error: "generation failed" }]);
      const node = createAnalyticalResponseNode(llm as any);

      const result = await node({
        question: "Q",
        query: "MATCH ...",
        dbResults: [{ x: 1 }],
        messages: [new HumanMessage("Q")],
      } as any);

      assert.equal(result.error, "Response generation failed: generation failed");
    });
  });
});
