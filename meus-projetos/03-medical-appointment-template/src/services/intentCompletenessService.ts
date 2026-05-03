export type SupportedIntent = "schedule" | "cancel" | "reschedule";

type IntentFields = Record<SupportedIntent, string[]>;

const requiredFieldsByIntent: IntentFields = {
  schedule: ["professionalId", "datetime", "patientName"],
  cancel: ["professionalId", "datetime", "patientName"],
  reschedule: ["professionalId", "currentDatetime", "newDatetime", "patientName"],
};

const fieldQuestionLabel: Record<string, string> = {
  professionalId: "o profissional",
  datetime: "a data e horário da consulta",
  currentDatetime: "a data e horário atuais da consulta",
  newDatetime: "a nova data e horário desejados",
  patientName: "seu nome completo",
};

export function getMissingFields(
  intent: SupportedIntent,
  data: Record<string, unknown>,
): string[] {
  const requiredFields = requiredFieldsByIntent[intent];

  return requiredFields.filter((field) => {
    const value = data[field];
    if (typeof value === "string") {
      return value.trim().length === 0;
    }

    return value === undefined || value === null;
  });
}

export function buildFollowUpQuestion(intent: SupportedIntent, missingFields: string[]) {
  const requirements = missingFields
    .map((field) => fieldQuestionLabel[field] ?? field)
    .join(", ");

  const introByIntent: Record<SupportedIntent, string> = {
    schedule: "Perfeito! Para agendar sua consulta, preciso de",
    cancel: "Entendi! Para cancelar sua consulta, preciso de",
    reschedule: "Sem problemas! Para remarcar sua consulta, preciso de",
  };

  return `${introByIntent[intent]} ${requirements}.`;
}

export function inferIntentFromQuestion(question: string): SupportedIntent | undefined {
  const normalizedQuestion = question.toLowerCase();

  if (/remar|alterar\s+hor[aá]rio|mudar\s+hor[aá]rio|reagendar/.test(normalizedQuestion)) {
    return "reschedule";
  }

  if (/cancel|desmarcar|desistir/.test(normalizedQuestion)) {
    return "cancel";
  }

  if (/agendar|marcar\s+uma\s+consulta|consulta/.test(normalizedQuestion)) {
    return "schedule";
  }

  return undefined;
}
