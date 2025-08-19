"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const http_1 = __importDefault(require("http"));
const wsserver_js_1 = require("./wsserver.js");
const userroute_js_1 = __importDefault(require("./routes/userroute.js"));
const avatarroute_js_1 = __importDefault(require("./routes/avatarroute.js"));
const verifyroute_js_1 = __importDefault(require("./routes/verifyroute.js"));
const connect_js_1 = __importDefault(require("./db/connect.js"));
const contactroute_js_1 = __importDefault(require("./routes/contactroute.js"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Initialize WebSocket server
new wsserver_js_1.WSServer(server);
// Middleware
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.NEXT_PUBLIC_BASE_URL || 'https://chatingfrontend-git-main-ahmed-hassans-projects-96c42d63.vercel.app',
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "withCredentials", "X-Requested-With"]
}));
// Routes
app.use("/api/user", userroute_js_1.default);
app.use("/api/avatar", avatarroute_js_1.default);
app.use("/api/contact", contactroute_js_1.default);
app.use("/api/verify", verifyroute_js_1.default);
// Error handling
(0, connect_js_1.default)();
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
});
server.listen(4001, () => {
    console.log(`Server running on port 4001`);
});
