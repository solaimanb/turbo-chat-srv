import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import config from "./config";
import cors = require("cors");

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Enable CORS for Express
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"],
  })
);

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
});

// Handle Socket.IO connection errors
io.engine.on("connection_error", (err) => {
  console.error("Socket.IO connection error:", err);
});

// Connect to MongoDB
async function connectToDB() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.database_url as string);
    console.log("🛢 Database connected successfully!");

    // Start the server after connecting to the database
    server.listen(config.port, () => {
      console.log(`🚀 Server is running on port ${config.port}`);
    });

    // Initialize Socket.IO logic
    initializeSocket(io);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

// Initialize Socket.IO logic
function initializeSocket(io: Server) {
  const activeUsers: { [userId: string]: string } = {};

  io.on("connection", (socket) => {
    console.log(`⚡ A user connected: ${socket.id}`);

    // Handle joining a room
    socket.on("join-room", ({ userId, role }) => {
      if (!userId || !role) {
        console.error("Invalid join-room data");
        return;
      }

      socket.join(userId);
      activeUsers[userId] = role;
      console.log(`👤 User ${userId} (${role}) joined room`);

      // Notify all users in the room
      if (role === "mentee") {
        console.log(`📣 Broadcasting mentee-joined event for user: ${userId}`);
        io.emit("mentee-joined", { userId });
      }
    });

    // Handle chat messages
    socket.on("send-message", ({ toUserId, message }) => {
      if (!toUserId || !message) {
        console.error("Invalid send-message data");
        return;
      }

      console.log(`💬 Message received in room - ${message}`);
      io.to(toUserId).emit("receive-message", { sender: socket.id, message });
    });

    // Handle voice call requests
    socket.on("initiate-call", ({ callerId, calleeId }) => {
      if (!callerId || !calleeId) {
        console.error("Invalid initiate-call data");
        return;
      }

      console.log(`📞 Call initiated from ${callerId} to ${calleeId}`);
      io.to(calleeId).emit("incoming-call", { callerId });
    });

    // Handle WebRTC signaling
    socket.on("call-signal", ({ toUserId, signal }) => {
      if (!toUserId || !signal) {
        console.error("Invalid call-signal data");
        return;
      }

      console.log(`📡 Call Signal from ${socket.id} to ${toUserId}`);
      io.to(toUserId).emit("call-signal", { fromUserId: socket.id, signal });
    });

    // Handle WebRTC answer
    socket.on("call-answer", ({ toUserId, answer }) => {
      if (!toUserId || !answer) {
        console.error("Invalid call-answer data");
        return;
      }

      console.log(`📞 Call Answer from ${socket.id} to ${toUserId}`);
      io.to(toUserId).emit("call-answer", { answer });
    });

    // Handle ICE candidates
    socket.on("ice-candidate", ({ toUserId, candidate }) => {
      if (!toUserId || !candidate) {
        console.error("Invalid ice-candidate data");
        return;
      }

      console.log(`🧊 ICE Candidate from ${socket.id} to ${toUserId}`);
      io.to(toUserId).emit("ice-candidate", { candidate });
    });

    // Handle call end
    socket.on("call-end", ({ roomId }) => {
      if (!roomId) {
        console.error("Invalid call-end data");
        return;
      }

      console.log(`⏹ Call ended in room: ${roomId}`);
      io.to(roomId).emit("call-end", { roomId });
    });

    // Handle user disconnection
    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.id}`);
      const userId = Object.keys(activeUsers).find(
        (key) => activeUsers[key] === socket.id
      );

      if (userId) {
        delete activeUsers[userId];
        console.log(`👤 User ${userId} left`);
        // Notify other users in the room
        io.emit("user-left", { userId });
      }
    });
  });
}

// Start the server and connect to the database
connectToDB();
