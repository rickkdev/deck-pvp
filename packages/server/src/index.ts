import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { GAME_CONFIG } from "@deck-pvp/shared";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const PORT = 3001;

app.get("/health", (_req, res) => {
  res.json({ status: "ok", config: GAME_CONFIG });
});

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`DeckPVP server running on http://localhost:${PORT}`);
});
