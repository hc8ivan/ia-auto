import OpenAI from "openai";
import { config } from "../config/env.js";
import { AppError } from "../lib/AppError.js";
import {
  OPENAI_CHAT_MODEL,
  RESTAURANT_SYSTEM_PROMPT,
} from "../constants/prompts.js";
import { ASSISTANT_TOOLS } from "../constants/assistantTools.js";
import * as reservationService from "./reservationService.js";
import { logger } from "../lib/logger.js";

const client = new OpenAI({ apiKey: config.openaiApiKey });

/**
 * @param {{ role: 'user' | 'assistant', content: string }[]} chatMessages
 * @param {string} scheduleContext
 * @param {string | undefined} sessionId
 * @returns {Promise<string>}
 */
export async function runChatWithTools(
  chatMessages,
  scheduleContext,
  sessionId,
) {
  const systemContent = `${RESTAURANT_SYSTEM_PROMPT}\n\n${scheduleContext}`;

  /** @type {OpenAI.Chat.ChatCompletionMessageParam[]} */
  const messages = [
    { role: "system", content: systemContent },
    ...chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const maxRounds = config.assistantToolMaxRounds;

  try {
    for (let round = 0; round < maxRounds; round++) {
      const completion = await client.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages,
        tools: ASSISTANT_TOOLS,
        tool_choice: "auto",
      });

      const choice = completion.choices[0]?.message;
      if (!choice) {
        throw new AppError(502, "Respuesta vacía del modelo.");
      }

      messages.push(choice);

      const calls = choice.tool_calls;
      if (!calls?.length) {
        const text = choice.content?.trim();
        if (!text) {
          throw new AppError(502, "Respuesta vacía del modelo.");
        }
        return text;
      }

      for (const call of calls) {
        if (call.type !== "function") continue;
        const fn = call.function;
        let args = {};
        try {
          args = JSON.parse(fn.arguments || "{}");
        } catch {
          args = {};
        }
        const result = await reservationService.executeAssistantTool(
          fn.name,
          args,
          sessionId,
        );
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    throw new AppError(502, "Demasiadas llamadas a herramientas; reintenta.");
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    const apiStatus = /** @type {{ status?: number }} */ (err).status;
    if (apiStatus === 401) {
      throw new AppError(
        401,
        "API key de OpenAI inválida o sin permisos.",
      );
    }

    logger.error("openai_request_failed", {
      status: apiStatus ?? null,
      message: err instanceof Error ? err.message : String(err),
    });
    const msg =
      typeof err === "object" &&
      err !== null &&
      "message" in err &&
      typeof err.message === "string"
        ? err.message
        : "Error al contactar con el servicio de IA.";
    throw new AppError(502, msg);
  }
}
