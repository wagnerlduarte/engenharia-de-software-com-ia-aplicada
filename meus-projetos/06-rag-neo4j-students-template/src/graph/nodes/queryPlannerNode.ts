import {
  getSystemPrompt,
  getUserPromptTemplate,
  type QueryAnalysisData,
  QueryAnalysisSchema,
} from "../../prompts/v1/queryAnalyzer.ts";
import { config } from "../../config.ts";
import { OpenRouterService } from "../../services/openrouterService.ts";
import type { GraphState } from "../graph.ts";
import { callStructuredWithTimeout } from "./llmCallWithTimeout.ts";

export function createQueryPlannerNode(llmClient: OpenRouterService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      const systemPrompt = getSystemPrompt();
      const userPrompt = getUserPromptTemplate(state.question!);

      const maxAttempts = 1 + (config.plannerRetryAttempts ?? 0);
      let data: QueryAnalysisData | undefined;
      let error: string | undefined;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const plannerResult = await callStructuredWithTimeout(
          llmClient.generateStructured(
            systemPrompt,
            userPrompt,
            QueryAnalysisSchema,
            { temperature: config.plannerTemperature },
          ),
          config.llmTimeoutMs,
          "Query planner timed out",
        );

        data = plannerResult.data;
        error = plannerResult.error;

        if (!error) {
          break;
        }

        if (attempt < maxAttempts) {
          console.log(`Retrying planner (${attempt}/${maxAttempts - 1})`);
        }
      }

      if (error) {
        console.log("❌ Failed to analyze query, assuming simple");
        return {
          ...state,
          isMultiStep: false,
        };
      }

      if (data?.requiresDecomposition && !!data.subQuestions?.length) {
        const subQuestionsFormatted = data.subQuestions
          .map((q, idx) => `${idx + 1}. ${q}`)
          .join(" ");

        console.log(
          `Complex query - ${data.subQuestions.length} steps: ${subQuestionsFormatted}`,
        );

        return {
          isMultiStep: true,
          // isMultiStep: false,
          subQuestions: data.subQuestions,
          currentStep: 0,
          subQueries: [],
          subResults: [],
        };
      }

      return {
        ...state,
      };
    } catch (error: any) {
      console.error("❌ Error analyzing query:", error.message);
      return {
        ...state,
        isMultiStep: false,
      };
    }
  };
}
