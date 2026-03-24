import { config } from "../config/env.js";
import * as chatRepository from "../repositories/chatRepository.js";
import * as openaiService from "./openaiService.js";
import * as scheduleService from "./scheduleService.js";

/**
 * @param {{ message: string, sessionId?: string }} input
 * @returns {Promise<{ reply: string, sessionId: string }>}
 */
export async function handleChatMessage(input) {
  const sessionId = chatRepository.ensureSession(input.sessionId);
  const priorLimit = Math.max(0, config.chatHistoryMaxMessages - 1);
  const history = chatRepository.getRecentMessages(sessionId, priorLimit);
  chatRepository.insertMessage(sessionId, "user", input.message);

  const messagesForModel = [
    ...history,
    { role: "user", content: input.message },
  ];

  const scheduleContext = scheduleService.buildSchedulePromptBlock();
  const reply = await openaiService.runChatWithTools(
    messagesForModel,
    scheduleContext,
    sessionId,
  );
  chatRepository.insertMessage(sessionId, "assistant", reply);

  return { reply, sessionId };
}

/**
 * @param {string} sessionId
 * @returns {{ sessionId: string, messages: { role: string, content: string }[] } | null}
 */
export function getSessionForClient(sessionId) {
  const messages = chatRepository.getAllMessages(sessionId);
  if (!messages) {
    return null;
  }
  return { sessionId, messages };
}
