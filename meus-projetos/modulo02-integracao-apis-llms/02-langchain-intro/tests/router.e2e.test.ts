import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.ts";

test("command upper transforms message into UPPERCASE", async () => {
  const app = createServer();

  const msg = "make a this message UPPER please!";

  const expected = msg.toUpperCase();

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: {
      question: msg,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, expected);
});

test("command lower transforms message into LOWERCASE", async () => {
  const app = createServer();

  const msg = "MAKE THIS MESSAGE LOWER PLEASE!";

  const expected = msg.toLowerCase();

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: {
      question: msg,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, expected);
});

test("command unknown transforms message into UNKNOWN", async () => {
  const app = createServer();

  const msg = "HEY THERE!";

  const expected = "Sorry, I didn't understand that. Can you please rephrase?";

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: {
      question: msg,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, expected);
});
