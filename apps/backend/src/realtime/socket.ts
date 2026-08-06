import type { Server as HttpServer } from "node:http";

import { Server as SocketIOServer } from "socket.io";

import { env } from "../config/env";
import { logger } from "../logging/logger";

/**
 * Attaches Socket.IO to the HTTP server. No events are wired yet — that
 * starts once the Backend actually has something to push (recommendations,
 * notifications) in a later milestone. This just establishes the transport.
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

  return io;
}
