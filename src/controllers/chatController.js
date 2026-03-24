import { AppError } from "../lib/AppError.js";
import * as chatService from "../services/chatService.js";

export async function postChat(req, res) {
  const { message, sessionId } = req.body;
  const result = await chatService.handleChatMessage({ message, sessionId });
  res.json(result);
}

export async function getSessionMessages(req, res) {
  const data = chatService.getSessionForClient(req.params.sessionId);
  if (!data) {
    throw new AppError(404, "Sesión no encontrada.");
  }
  res.json(data);
}
