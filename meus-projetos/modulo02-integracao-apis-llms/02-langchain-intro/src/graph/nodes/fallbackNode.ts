import { AIMessage } from "langchain";
import { type GraphState } from "../graph.ts";

export function fallbackNode(state: GraphState): GraphState {
  const message = "Sorry, I didn't understand that. Can you please rephrase?";
  const fallbackMessage = new AIMessage(message).content.toString();

  return {
    ...state,
    output: fallbackMessage,
  };
}
