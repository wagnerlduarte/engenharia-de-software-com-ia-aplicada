import { AIMessage } from "langchain";
import { config } from "../../config.ts";
import { OpenRouterService } from "../../services/openrouterService.ts";
import type { GraphState } from "../graph.ts";
import {
  AnalyticalResponseSchema,
  getErrorResponsePrompt,
  getMultiStepSynthesisPrompt,
  getNoResultsPrompt,
  getSystemPrompt,
  getUserPromptTemplate,
} from "../../prompts/v1/analyticalResponse.ts";
import { callStructuredWithTimeout } from "./llmCallWithTimeout.ts";

async function handleErrorReposponse(
  state: GraphState,
  llmClient: OpenRouterService,
): Promise<Partial<GraphState>> {
  const systemPrompt = getSystemPrompt();
  const userPrompt = getErrorResponsePrompt(state.error!, state.question);

  const { data, error } = await callStructuredWithTimeout(
    llmClient.generateStructured(
      systemPrompt,
      userPrompt,
      AnalyticalResponseSchema,
    ),
    config.llmTimeoutMs,
    "Analytical error response timed out",
  );

  if (error) {
    return {
      messages: [new AIMessage(`Error response generation failed: ${error}`)],
      error,
      answer: `Error response generation failed: ${error}`,
      followUpQuestions: [],
    };
  }

  return {
    messages: [new AIMessage(data?.answer!)],
    answer: data?.answer,
    followUpQuestions: data?.followUpQuestions || [],
  };
}

async function handleSuccessResponse(
  state: GraphState,
  llmClient: OpenRouterService,
): Promise<Partial<GraphState>> {
  const systemPrompt = getSystemPrompt();
  let _userPrompt: string;
  if (
    Boolean(state.isMultiStep) &&
    state.subResults?.length &&
    state.subQuestions?.length &&
    state.subQueries?.length
  ) {
    const stepsData = state.subResults.map((results, index) => ({
      stepNumber: index + 1,
      question: state.subQuestions![index],
      query: state.subQueries![index],
      results: JSON.stringify(results),
    }));

    _userPrompt = getMultiStepSynthesisPrompt(state.question!, stepsData);
  } else {
    _userPrompt = getUserPromptTemplate(
      state.question!,
      state.query!,
      JSON.stringify(state.dbResults),
    );
  }

  const { data, error } = await callStructuredWithTimeout(
    llmClient.generateStructured(
      systemPrompt,
      _userPrompt,
      AnalyticalResponseSchema,
    ),
    config.llmTimeoutMs,
    "Analytical response timed out",
  );

  if (error) {
    console.log("Error generating analytical response:", error);

    return {
      error: `Response generation failed: ${error ?? "Unknown error"}`,
    };
  }

  console.log("Generated analytical response");

  return {
    messages: [new AIMessage(data?.answer!)],
    answer: data?.answer,
    followUpQuestions: data?.followUpQuestions || [],
  };
}

async function handleNoResultsResponse(
  state: GraphState,
  llmClient: OpenRouterService,
): Promise<Partial<GraphState>> {
  const systemPrompt = getSystemPrompt();
  const userPrompt = getNoResultsPrompt(
    state.question ?? "your query",
    state.query ?? "N/A",
  );

  const { data, error } = await callStructuredWithTimeout(
    llmClient.generateStructured(
      systemPrompt,
      userPrompt,
      AnalyticalResponseSchema,
    ),
    config.llmTimeoutMs,
    "No-results response timed out",
  );

  if (data) {
    return {
      ...state,
      messages: [...state.messages, new AIMessage(data.answer)],
      answer: data.answer,
      followUpQuestions: data.followUpQuestions ?? [],
    };
  }

  const noResultsMessage = "No data found for the query.";

  return {
    ...state,
    messages: [...state.messages, new AIMessage(noResultsMessage)],
    error,
    answer: noResultsMessage,
    followUpQuestions: [],
  };
}

export function createAnalyticalResponseNode(llmClient: OpenRouterService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      if (state.error) {
        return await handleErrorReposponse(state, llmClient);
      }

      if(!state.dbResults?.length){
        return await handleNoResultsResponse(state, llmClient);
      }

      return await handleSuccessResponse(state, llmClient);
    } catch (error: any) {
      console.error("Error generating analytical response:", error.message);
      return {
        ...state,
        error: `Response generation failed: ${error.message}`,
      };
    }
  };
}
