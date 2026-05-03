import { HumanMessage } from 'langchain';
import { buildGraph } from './graph/factory.ts';
import { ConversationSessionService, type SupportedIntent } from './services/conversationSessionService.ts';

import Fastify from 'fastify';

const graph = buildGraph();
const conversationSessionService = new ConversationSessionService();

function toConversationKnownData(state: Record<string, unknown>) {
    return {
        professionalId: typeof state.professionalId === 'number' ? state.professionalId : undefined,
        professionalName: typeof state.professionalName === 'string' ? state.professionalName : undefined,
        datetime: typeof state.datetime === 'string' ? state.datetime : undefined,
        currentDatetime: typeof state.currentDatetime === 'string' ? state.currentDatetime : undefined,
        newDatetime: typeof state.newDatetime === 'string' ? state.newDatetime : undefined,
        patientName: typeof state.patientName === 'string' ? state.patientName : undefined,
        reason: typeof state.reason === 'string' ? state.reason : undefined,
    };
}

function toSupportedIntent(intent: unknown): SupportedIntent | undefined {
    if (intent === 'schedule' || intent === 'cancel' || intent === 'reschedule') {
        return intent;
    }

    return undefined;
}

export const createServer = () => {
    const app = Fastify();

    app.post('/chat', {
        schema: {
            body: {
                type: 'object',
                required: ['question'],
                properties: {
                    question: { type: 'string', minLength: 10 },
                    sessionId: { type: 'string', minLength: 3 },
                },
            }
        }
    }, async function (request, reply) {
        try {
            const { question } = request.body as {
                question: string;
                sessionId?: string;
            };

            const sessionId =
                (request.body as { sessionId?: string }).sessionId ??
                (typeof request.headers['x-session-id'] === 'string' ? request.headers['x-session-id'] : undefined);

            const currentSession = sessionId
                ? conversationSessionService.get(sessionId)
                : undefined;

            const response = await graph.invoke({
                messages: [new HumanMessage(question)],
                ...(currentSession?.knownData ?? {}),
                pendingIntent: currentSession?.pendingIntent,
                sessionId,
            });

            if (sessionId) {
                if (response.needsMoreInfo) {
                    conversationSessionService.save(sessionId, {
                        pendingIntent: toSupportedIntent(response.pendingIntent ?? response.intent),
                        missingFields: response.missingFields ?? [],
                        knownData: toConversationKnownData(response),
                    });
                } else {
                    conversationSessionService.clear(sessionId);
                }
            }

            return response

        } catch (error) {
            console.error('❌ Error processing request:', error);
            return reply.status(500).send({
                error: 'An error occurred while processing your request.',
            });
        }
    });

    app.get('/health', async (request, reply) => {
        return { status: 'ok' };
    });

    return app;
};
