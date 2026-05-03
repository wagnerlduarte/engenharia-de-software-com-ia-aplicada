export type SupportedIntent = "schedule" | "cancel" | "reschedule";

export type ConversationKnownData = {
  professionalId?: number;
  professionalName?: string;
  datetime?: string;
  currentDatetime?: string;
  newDatetime?: string;
  patientName?: string;
  reason?: string;
};

export type ConversationSession = {
  pendingIntent?: SupportedIntent;
  missingFields?: string[];
  knownData: ConversationKnownData;
};

export class ConversationSessionService {
  private readonly sessions = new Map<string, ConversationSession>();

  get(sessionId: string): ConversationSession | undefined {
    return this.sessions.get(sessionId);
  }

  save(sessionId: string, session: ConversationSession) {
    this.sessions.set(sessionId, session);
  }

  clear(sessionId: string) {
    this.sessions.delete(sessionId);
  }
}
