import type { Runtime } from "@langchain/langgraph";
import { OpenRouterService } from "../../services/openrouterService.ts";
import type { GraphState } from "../graph.ts";
import {
  ChatResponseSchema,
  getSystemPrompt,
  getUserPromptTemplate,
} from "../../prompts/v1/chatResponse.ts";
import { AIMessage, HumanMessage } from "langchain";
import { PreferencesService } from "../../services/preferencesService.ts";
import { config } from "../../config.ts";

export function createChatNode(
  llmClient: OpenRouterService,
  preferencesService: PreferencesService,
) {
  return async (
    state: GraphState,
    runtime?: Runtime,
  ): Promise<Partial<GraphState>> => {
    const userId = String(
      runtime?.context?.userId || state.userId || "unknown",
    );
    const userContext =
      state.userContext ?? (await preferencesService.getBasicInfo(userId));
    const systemPrompt = getSystemPrompt(userContext);

    const conversationHistory = state.messages
      .map(
        (msg) =>
          `${HumanMessage.isInstance(msg) ? "User" : "AI"}: ${msg.content}`,
      )
      .join("\n");

    const userMessage = state.messages[state.messages.length - 1]
      ?.text as string;

    const userPrompt = getUserPromptTemplate(userMessage, conversationHistory);

    const result = await llmClient.generateStructured(
      systemPrompt,
      userPrompt,
      ChatResponseSchema,
    );

    if (!result.success || !result.data) {
      console.error("LLM generation failed");
      return {
        messages: [
          new AIMessage(
            "Sorry, I encountered an error while generating a response. Please try again.",
          ),
        ],
      };
    }

    const response = result.data;

    const totalMessages = state.messages.length;
    const needsSummarization = totalMessages >= config.maxMessagesToSummary;

    return {
      messages: [new AIMessage(response.message)],
      extractedPreferences: response.shouldSavePreferences
        ? response.preferences
        : undefined,
      needsSummarization,
    };
  };
}
