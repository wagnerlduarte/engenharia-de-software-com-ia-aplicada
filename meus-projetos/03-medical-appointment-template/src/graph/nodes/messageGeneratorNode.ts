import {
  getSystemPrompt,
  getUserPromptTemplate,
  MessageSchema,
} from "../../prompts/v1/messageGenerator.ts";
import { OpenRouterService } from "../../services/openRouterService.ts";
import type { GraphState } from "../graph.ts";
import { AIMessage } from "langchain";

export function createMessageGeneratorNode(llmClient: OpenRouterService) {
  return async (state: GraphState): Promise<GraphState> => {
    console.log(`💬 Generating response message...`);

    if (state.needsMoreInfo && state.followUpQuestion) {
      return {
        ...state,
        messages: [...state.messages, new AIMessage(state.followUpQuestion)],
      };
    }

    try {
      const hasSucceeded = state.actionSuccess ? "success" : "error";
      const scenario = `${state.intent || "unknown"}_${hasSucceeded}`;
      const details = {
        professionalName: state.professionalName,
        datetime: state.newDatetime ?? state.datetime,
        currentDatetime: state.currentDatetime,
        newDatetime: state.newDatetime,
        patientName: state.patientName,
        error: state.actionError ?? state.error,
      };

      const systemPrompt = getSystemPrompt();
      const userPrompt = getUserPromptTemplate({ scenario, details });

      const result = await llmClient.generateStructured(
        systemPrompt,
        userPrompt,
        MessageSchema,
      );

      console.log(
        `💬 Message generated:`,
        result.data?.message ?? result.data ?? result,
      );

      if (!result.success) {
        console.error(`❌ Failed to generate message:`, result.error);
        return {
          messages: [...state.messages, new AIMessage("Desculpe, errei!")],
        };
      }

      return {
        messages: [...state.messages, new AIMessage(result.data?.message)],
      };
    } catch (error) {
      console.error("❌ Error in messageGenerator node:", error);
      return {
        ...state,
        messages: [
          ...state.messages,
          new AIMessage("An error occurred while processing your request."),
        ],
      };
    }
  };
}
