import { REALTIME_CHANNELS, type RealtimeEventMap } from "@ai-env/contracts";
import type { Server as SocketIOServer } from "socket.io";

import { logger } from "../logging/logger";

/**
 * The Backend owns all realtime communication. Everything that broadcasts
 * goes through here so channel names come from the shared contract constants
 * rather than being retyped as string literals at each call site.
 *
 * The Socket.IO server is registered at startup; broadcasting before that is
 * a no-op warning rather than a crash, since a missing socket server must
 * never take down the reasoning pipeline.
 */
let io: SocketIOServer | undefined;

export function registerSocketServer(server: SocketIOServer): void {
  io = server;
}

export function broadcast<C extends keyof RealtimeEventMap>(
  channel: C,
  payload: RealtimeEventMap[C],
): void {
  if (!io) {
    logger.warn({ channel }, "[realtime] broadcast before socket server was registered");
    return;
  }
  io.emit(channel, payload);
  logger.debug({ channel }, "[realtime] broadcast");
}

export { REALTIME_CHANNELS };
