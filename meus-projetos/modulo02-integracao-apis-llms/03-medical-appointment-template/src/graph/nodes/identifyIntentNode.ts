import {
  getSystemPrompt,
  getUserPromptTemplate,
  IntentSchema,
} from "../../prompts/v1/identifyIntent.ts";
import { professionals } from "../../services/appointmentService.ts";
import { OpenRouterService } from "../../services/openRouterService.ts";
import type { GraphState } from "../graph.ts";

export function createIdentifyIntentNode(llmClient: OpenRouterService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    // console.log(`🔍 Identifying intent...`, llmClient);
    const input = state.messages.at(-1)!.text;

    try {
      const systemPrompt = getSystemPrompt(professionals);
      const userPrompt = getUserPromptTemplate(input);
      const result = await llmClient.generateStructured(
        systemPrompt,
        userPrompt,
        IntentSchema,
      );

      if (!result.success) {
        console.error("❌ Failed to identify intent:", result.error);
        return {
          intent: "unknown",
          error: result.error,
        };
      }

      const intentData = result.data!;
      console.log(`✅ Intent identified: ${intentData.intent}`);

      return {
        ...state,
        ...intentData,
        intent:
          intentData.intent === "unknown"
            ? state.pendingIntent ?? intentData.intent
            : intentData.intent,
        professionalId: intentData.professionalId ?? state.professionalId,
        professionalName: intentData.professionalName ?? state.professionalName,
        datetime: intentData.datetime ?? state.datetime,
        currentDatetime: intentData.currentDatetime ?? state.currentDatetime,
        newDatetime: intentData.newDatetime ?? state.newDatetime,
        patientName: intentData.patientName ?? state.patientName,
        reason: intentData.reason ?? state.reason,
      };
    } catch (error) {
      console.error("❌ Error in identifyIntent node:", error);
      return {
        ...state,
        intent: "unknown",
        error:
          error instanceof Error
            ? error.message
            : "Intent identification failed",
      };
    }
  };
}
