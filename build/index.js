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
    origin: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001',
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "withCredentials"]
}));
// Routes
app.use("/api/user", userroute_js_1.default);
app.use("/api/avatar", avatarroute_js_1.default);
app.use("/api/contact", contactroute_js_1.default);
app.use("/api/user", verifyroute_js_1.default);
// Error handling
(0, connect_js_1.default)();
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
});
const PORT = 4001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
