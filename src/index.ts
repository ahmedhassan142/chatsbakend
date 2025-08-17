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
  origin: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001',
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization","withCredentials"]
}));

// Routes
app.use("/api/user", userroute);
app.use("/api/avatar", avatarroute);
app.use("/api/contact", contactroute);
app.use("/api/user", verifyroute);

// Error handling
connectDB();
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT =  4001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});