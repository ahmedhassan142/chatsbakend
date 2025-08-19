import dotenv from "dotenv";
import express from "express";
import { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from 'http';
import { WSServer } from "./wsserver.js";
import userroute from "./routes/userroute.js";
import avatarroute from "./routes/avatarroute.js";
import verifyroute from "./routes/verifyroute.js";
import connectDB from "./db/connect.js";
import contactroute from './routes/contactroute.js'
dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize WebSocket server
new WSServer(server);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.NEXT_PUBLIC_BASE_URL || 'https://chatingfrontend-git-main-ahmed-hassans-projects-96c42d63.vercel.app',
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE","PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization","withCredentials","X-Requested-With"]
}));

// Routes
app.use("/api/user", userroute);
app.use("/api/avatar", avatarroute);
app.use("/api/contact", contactroute);
app.use("/api/verify", verifyroute);

// Error handling
connectDB();
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

server.listen(4001, () => {
  console.log(`Server running on port 4001`);
});