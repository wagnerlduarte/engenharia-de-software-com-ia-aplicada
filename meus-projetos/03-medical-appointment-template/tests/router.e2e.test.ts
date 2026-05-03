import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.ts";
import { professionals } from "../src/services/appointmentService.ts";

const app = createServer();

async function makeARequest(question: string, sessionId?: string) {
  return await app.inject({
    method: "POST",
    url: "/chat",
    payload: {
      question,
      sessionId,
    },
  });
}

describe.skip("Medical Appointment System - E2E Tests", async () => {
  it("Schedule appointment - Success", async () => {
    const response = await makeARequest(
      `Olá, sou Maria Santos e quero agendar uma consulta com ${professionals.at(0)?.name} Dr. Alicio da Silva para amanhã às 16h para um check-up regular`,
    );

    console.log("Schedule Success Response:", response.body);

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.intent, "schedule");
    assert.equal(body.actionSuccess, true);
  });

  it("Cancel appointment - Success", async () => {
    await makeARequest(
      `Sou Joao da Silva e quero agendar uma consulta com ${professionals.at(1)?.name} para hoje às 14h`,
    );

    const response = await makeARequest(
      `Cancele minha consulta com ${professionals.at(1)?.name} que tenho hoje às 14h, me chamo Joao da Silva`,
    );

    console.log("Cancel Success Response:", response.body);

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.intent, "cancel");
    assert.equal(body.actionSuccess, true);
  });

  it("Schedule appointment - Conflict when same time slot", async () => {
    const sameTimeRequest = `Sou Pedro Silva e quero agendar uma consulta com ${professionals.at(0)?.name} para hoje às 11h para um check-up`;

    const firstResponse = await makeARequest(sameTimeRequest);
    console.log("First Schedule Response:", firstResponse.body);
    assert.equal(firstResponse.statusCode, 200);

    const secondResponse = await makeARequest(sameTimeRequest);
    console.log("Conflict Schedule Response:", secondResponse.body);
    assert.equal(secondResponse.statusCode, 200);
    const body = JSON.parse(secondResponse.body);
    assert.equal(body.intent, "schedule");
    assert.equal(body.actionSuccess, false);
    assert.match(body.actionError, /Horário indisponível/);
  });

  it("Cancel appointment - Error when no time slot provided", async () => {
    const response = await makeARequest(
      `Cancele minha consulta com ${professionals.at(0)?.name}, me chamo Joao da Silva`,
    );

    console.log("Cancel Without Time Response:", response.body);
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.intent, "cancel");
    assert.equal(body.actionSuccess, false);
    assert.match(body.actionError, /required|necessário/i);
  });

  it("Reschedule appointment - Success", async () => {
    const scheduleResponse = await makeARequest(
      `Sou Carla Mendes e quero agendar uma consulta com ${professionals.at(2)?.name} para amanhã às 15h para retorno`,
    );

    assert.equal(scheduleResponse.statusCode, 200);

    const response = await makeARequest(
      `Marquei uma consulta com ${professionals.at(2)?.name} para amanhã às 15h, mas não conseguirei comparecer. Quero alterar para amanhã às 16h. Meu nome é Carla Mendes`,
    );

    console.log("Reschedule Success Response:", response.body);

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.intent, "reschedule");
    assert.equal(body.actionSuccess, true);
  });

  it("Reschedule appointment - Error when original time is missing", async () => {
    const response = await makeARequest(
      `Preciso alterar minha consulta com ${professionals.at(2)?.name} para amanhã às 17h, me chamo Carla Mendes`,
    );

    console.log("Reschedule Missing Original Time Response:", response.body);

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.intent, "reschedule");
    assert.equal(body.actionSuccess, false);
    assert.match(body.actionError, /currentDatetime|required|necessário/i);
  });

  it.skip("Schedule appointment - Should ask for missing fields when intent is incomplete", async () => {
    const response = await makeARequest("Quero marcar uma consulta");

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);

    assert.equal(body.intent, "schedule");
    assert.equal(body.actionSuccess, false);
    assert.equal(body.needsMoreInfo, true);
    assert.ok(Array.isArray(body.missingFields));
    assert.ok(body.missingFields.includes("patientName"));
    assert.match(
      body.followUpQuestion,
      /profissional|médico|data|horário|nome/i,
    );
  });

  it.skip("Schedule appointment - Should complete booking after user provides missing fields", async () => {
    const firstResponse = await makeARequest("Quero marcar uma consulta");
    assert.equal(firstResponse.statusCode, 200);

    const secondResponse = await makeARequest(
      `Com a ${professionals.at(2)?.name}, amanhã às 15h. Meu nome é Carla Mendes`,
    );

    assert.equal(secondResponse.statusCode, 200);
    const body = JSON.parse(secondResponse.body);

    assert.equal(body.intent, "schedule");
    assert.equal(body.actionSuccess, true);
  });
});

describe("Missing Fields Handling", async () => {
  it("Schedule appointment - Should ask for missing fields when intent is incomplete", async () => {
    const sessionId = "missing-fields-ask-1";
    const response = await makeARequest("Quero marcar uma consulta", sessionId);

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);

    assert.equal(body.intent, "schedule");
    assert.equal(body.actionSuccess, false);
    assert.equal(body.needsMoreInfo, true);
    assert.ok(Array.isArray(body.missingFields));
    assert.ok(body.missingFields.includes("patientName"));
    assert.match(
      body.followUpQuestion,
      /profissional|médico|data|horário|nome/i,
    );
  });

  it("Schedule appointment - Should complete booking after user provides missing fields", async () => {
    const sessionId = "missing-fields-complete-1";
    const firstResponse = await makeARequest(
      "Quero marcar uma consulta",
      sessionId,
    );
    assert.equal(firstResponse.statusCode, 200);
    const firstBody = JSON.parse(firstResponse.body);
    assert.equal(firstBody.intent, "schedule");
    assert.equal(firstBody.needsMoreInfo, true);

    const secondResponse = await makeARequest(
      `Com a ${professionals.at(2)?.name}, amanhã às 15h. Meu nome é Carla Mendes`,
      sessionId,
    );

    assert.equal(secondResponse.statusCode, 200);
    const body = JSON.parse(secondResponse.body);

    assert.equal(body.intent, "schedule");
    assert.equal(body.actionSuccess, true);
  });
});
