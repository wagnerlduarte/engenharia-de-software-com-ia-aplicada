import { OpenRouterService } from "../../services/openrouterService.ts";
import { Neo4jService } from "../../services/neo4jService.ts";
import { config } from "../../config.ts";
import type { GraphState } from "../graph.ts";
import {
  CypherCorrectionSchema,
  getSystemPrompt,
  getUserPromptTemplate,
} from "../../prompts/v1/cypherCorrection.ts";
import { callStructuredWithTimeout } from "./llmCallWithTimeout.ts";

export function createCypherCorrectionNode(
  llmClient: OpenRouterService,
  neo4jService: Neo4jService,
) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      console.log("Autocorrecting Cypher query...");

      const schema = await neo4jService.getSchema();

      const systemPrompt = getSystemPrompt(schema);

      const userPrompt = getUserPromptTemplate(
        state.query!,
        state.validationError!,
        state.question,
      );

      const { data, error } = await callStructuredWithTimeout(
        llmClient.generateStructured(
          systemPrompt,
          userPrompt,
          CypherCorrectionSchema,
        ),
        config.llmTimeoutMs,
        "Cypher correction timed out",
      );

      if (error) {
        console.log("❌ Failed to correct query");
        return {
          ...state,
          correctionAttempts: (state.correctionAttempts ?? 0) + 1,
          needsCorrection: false,
          error: `Query correction failed: ${error ?? "Unknown error"}`,
        };
      }

      const rawCorrectedQuery = data?.correctedQuery;

      if (typeof rawCorrectedQuery !== "string") {
        console.log("❌ Correction returned invalid query type");
        return {
          ...state,
          correctionAttempts: (state.correctionAttempts ?? 0) + 1,
          needsCorrection: false,
          error: "Query correction failed: model returned invalid corrected query type",
        };
      }

      const correctedQuery = rawCorrectedQuery.trim();

      if (!correctedQuery) {
        console.log("❌ Correction returned empty query");
        return {
          ...state,
          correctionAttempts: (state.correctionAttempts ?? 0) + 1,
          needsCorrection: false,
          error: "Query correction failed: model returned empty corrected query",
        };
      }

      console.log("Corrected Cypher query:", data?.explanation);

      return {
        ...state,
        query: correctedQuery,
        originalQuery: state.originalQuery ?? state.query,
        correctionAttempts: (state.correctionAttempts ?? 0) + 1,
        validationError: undefined,
        needsCorrection: false,
      };
    } catch (error: any) {
      console.error("Error correcting query:", error.message);
      return {
        ...state,
        correctionAttempts: (state.correctionAttempts ?? 0) + 1,
        needsCorrection: false,
        error: `Query correction failed: ${error.message}`,
      };
    }
  };
}
