import type { Server as HttpServer } from "node:http";

import { Server as SocketIOServer } from "socket.io";

import { env } from "../config/env";
import { logger } from "../logging/logger";
import { registerSocketServer } from "./events";

/**
 * Attaches Socket.IO to the HTTP server and registers it as the broadcast
 * target for `realtime/events.ts`, which is where all outbound messages are
 * actually sent from.
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN },
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "[socket] client connected");

    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, reason }, "[socket] client disconnected");
    });
  });

  registerSocketServer(io);
  return io;
}
