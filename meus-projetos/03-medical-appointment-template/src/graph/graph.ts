import {
  StateGraph,
  START,
  END,
  MessagesZodMeta,
} from "@langchain/langgraph";
import { withLangGraph } from "@langchain/langgraph/zod";
import type { BaseMessage } from '@langchain/core/messages';

import { createSchedulerNode } from './nodes/schedulerNode.ts';
import { createCancellerNode } from './nodes/cancellerNode.ts';
import { createReschedulerNode } from './nodes/reschedulerNode.ts';
import { createIdentifyIntentNode} from "./nodes/identifyIntentNode.ts";
import { createValidateRequiredFieldsNode } from "./nodes/validateRequiredFieldsNode.ts";
import { createMessageGeneratorNode } from "./nodes/messageGeneratorNode.ts";

import { z } from "zod/v3";
import { OpenRouterService } from "../services/openRouterService.ts";
import { AppointmentService } from "../services/appointmentService.ts";

const AppointmentStateAnnotation = z.object({
  messages: withLangGraph(
    z.custom<BaseMessage[]>(),
    MessagesZodMeta),

  patientName: z.string().optional(),
  sessionId: z.string().optional(),

  intent: z.enum(['schedule', 'cancel', 'reschedule', 'unknown']).optional(),
  pendingIntent: z.enum(['schedule', 'cancel', 'reschedule']).optional(),
  professionalId: z.number().optional(),
  professionalName: z.string().optional(),
  datetime: z.string().optional(),
  currentDatetime: z.string().optional(),
  newDatetime: z.string().optional(),
  reason: z.string().optional(),

  needsMoreInfo: z.boolean().optional(),
  missingFields: z.array(z.string()).optional(),
  followUpQuestion: z.string().optional(),

  actionSuccess: z.boolean().optional(),
  actionError: z.string().optional(),
  appointmentData: z.any().optional(),

  error: z.string().optional(),
});

export type GraphState = z.infer<typeof AppointmentStateAnnotation>;

export function buildAppointmentGraph(llmClient: OpenRouterService, appointmentService: AppointmentService) {


  // Build workflow graph
  const workflow = new StateGraph({
    stateSchema: AppointmentStateAnnotation,
  })
    .addNode('identifyIntent', createIdentifyIntentNode(llmClient))
    .addNode('validateRequiredFields', createValidateRequiredFieldsNode())
    .addNode('schedule', createSchedulerNode(appointmentService))
    .addNode('cancel', createCancellerNode(appointmentService))
    .addNode('reschedule', createReschedulerNode(appointmentService))
    .addNode('message', createMessageGeneratorNode(llmClient))

    // Flow
    .addEdge(START, 'identifyIntent')
    .addEdge('identifyIntent', 'validateRequiredFields')

    // Route based on intent
    .addConditionalEdges(
      'validateRequiredFields',
      (state: GraphState): string => {
        if (
          state.error ||
          state.needsMoreInfo ||
          !state.intent ||
          state.intent === 'unknown'
        ) {
          return 'message';
        }

        console.log(`➡️  Routing based on intent: ${state.intent}`);
        return state.intent
      },
      {
        schedule: 'schedule',
        cancel: 'cancel',
        reschedule: 'reschedule',
        message: 'message',
      }
    )

    .addEdge('schedule', 'message')
    .addEdge('cancel', 'message')
    .addEdge('reschedule', 'message')
    .addEdge('message', END);

  return workflow.compile();
}
