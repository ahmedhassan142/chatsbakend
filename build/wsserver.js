"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSServer = void 0;
const ws_1 = require("ws");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const message_1 = require("./models/message");
const usermodel_1 = require("./models/usermodel");
class WSServer {
    constructor(server) {
        this.clients = new Map();
        this.wss = new ws_1.WebSocketServer({ noServer: true });
        server.on('upgrade', (req, socket, head) => {
            this.handleUpgrade(req, socket, head);
        });
    }
    handleUpgrade(req, socket, head) {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        if (!token) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
        try {
            //@ts-ignore
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWTPRIVATEKEY);
            this.wss.handleUpgrade(req, socket, head, (ws) => {
                const authWs = ws;
                authWs.userId = decoded._id;
                authWs.isAuthenticated = true;
                this.handleConnection(authWs);
            });
        }
        catch (error) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
        }
    }
    handleConnection(ws) {
        console.log(`User ${ws.userId} connected`);
        this.clients.set(ws.userId, ws);
        // Send authentication success message
        ws.send(JSON.stringify({
            type: 'auth_success',
            userId: ws.userId,
            timestamp: new Date().toISOString()
        }));
        // Send initial online users list
        this.sendOnlineUsersList();
        // Setup message handlers
        ws.on('message', (data) => this.handleMessage(ws, data));
        ws.on('close', () => this.handleClose(ws));
        ws.on('error', (error) => this.handleError(ws, error));
    }
    sendOnlineUsersList() {
        return __awaiter(this, void 0, void 0, function* () {
            const onlineUserIds = Array.from(this.clients.keys());
            const users = yield usermodel_1.User.find({
                _id: { $in: onlineUserIds }
            }).select('_id firstName lastName avatarLink');
            const onlineUsers = users.map((user) => ({
                _id: user._id.toString(),
                fullname: `${user.firstName} ${user.lastName}`.trim(),
                firstName: user.firstName,
                lastName: user.lastName,
                avatarLink: user.avatarLink,
                isOnline: true
            }));
            this.clients.forEach(client => {
                if (client.readyState === ws_1.WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'online_users',
                        users: onlineUsers,
                        timestamp: new Date().toISOString()
                    }));
                }
            });
        });
    }
    handleMessage(senderWs, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const message = JSON.parse(data);
                switch (message.type) {
                    case 'message':
                        yield this.handleChatMessage(senderWs, message);
                        break;
                    case 'status_update':
                        yield this.handleStatusUpdate(senderWs, message);
                        break;
                    case 'typing':
                        this.handleTypingIndicator(senderWs, message);
                        break;
                    case 'message_deleted':
                        this.handleMessageDeleted(senderWs, message);
                        break;
                    case 'conversation_cleared':
                        this.handleConversationCleared(senderWs, message);
                        break;
                    case 'mark_read':
                        //@ts-ignore
                        yield this.handleMessageRead(senderWs, message);
                        break;
                    default:
                        console.warn('Unknown message type:', message.type);
                }
            }
            catch (error) {
                console.error('Message handling error:', error);
            }
        });
    }
    handleChatMessage(senderWs, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!message.recipientId || !message.content) {
                    throw new Error('Missing required fields');
                }
                // Immediate sending status
                senderWs.send(JSON.stringify({
                    type: 'status_update',
                    tempId: message.clientTempId,
                    status: 'sending',
                    timestamp: new Date().toISOString()
                }));
                // Create new message in database
                const newMessage = new message_1.Message({
                    sender: senderWs.userId,
                    recipient: message.recipientId,
                    text: message.content,
                    status: 'sent'
                });
                const savedMessage = yield newMessage.save();
                // Sent status with actual ID
                senderWs.send(JSON.stringify({
                    type: 'status_update',
                    tempId: message.clientTempId,
                    messageId: savedMessage._id.toString(),
                    status: 'sent',
                    createdAt: savedMessage.createdAt,
                    timestamp: new Date().toISOString()
                }));
                // Deliver to recipient if online
                const recipientWs = this.clients.get(message.recipientId);
                if ((recipientWs === null || recipientWs === void 0 ? void 0 : recipientWs.readyState) === ws_1.WebSocket.OPEN) {
                    // Immediate delivery to recipient
                    recipientWs.send(JSON.stringify({
                        type: 'message',
                        messageId: savedMessage._id.toString(),
                        senderId: senderWs.userId,
                        content: message.content,
                        createdAt: savedMessage.createdAt,
                        status: 'delivered'
                    }));
                    // Update DB status to delivered
                    yield message_1.Message.updateOne({ _id: savedMessage._id }, { $set: { status: 'delivered' } });
                    // Delivery confirmation to sender
                    senderWs.send(JSON.stringify({
                        type: 'status_update',
                        messageId: savedMessage._id.toString(),
                        status: 'delivered',
                        timestamp: new Date().toISOString()
                    }));
                }
            }
            catch (error) {
                console.error('Message handling failed:', error);
                senderWs.send(JSON.stringify({
                    type: 'status_update',
                    tempId: message.clientTempId,
                    status: 'failed',
                    error: 'Message delivery failed',
                    timestamp: new Date().toISOString()
                }));
            }
        });
    }
    handleMessageRead(senderWs, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Update message status to 'read' in database
                const updated = yield message_1.Message.updateOne({ _id: message.messageId, recipient: senderWs.userId }, { status: 'read' });
                if (updated.modifiedCount > 0) {
                    // Notify original sender that their message was read
                    const msg = yield message_1.Message.findById(message.messageId);
                    if (msg && msg.sender) {
                        const originalSenderWs = this.clients.get(msg.sender.toString());
                        originalSenderWs === null || originalSenderWs === void 0 ? void 0 : originalSenderWs.send(JSON.stringify({
                            type: 'status_update',
                            messageId: message.messageId,
                            status: 'read',
                            timestamp: new Date().toISOString()
                        }));
                    }
                }
            }
            catch (error) {
                console.error('Error marking message as read:', error);
            }
        });
    }
    handleStatusUpdate(senderWs, message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!message.messageId || !message.status)
                return;
            try {
                const updated = yield message_1.Message.updateOne({ _id: message.messageId, recipient: senderWs.userId }, { status: message.status });
                if (updated.modifiedCount > 0) {
                    const msg = yield message_1.Message.findById(message.messageId);
                    if (msg && msg.sender) {
                        const senderWs = this.clients.get(msg.sender.toString());
                        senderWs === null || senderWs === void 0 ? void 0 : senderWs.send(JSON.stringify({
                            type: 'status_update',
                            messageId: message.messageId,
                            status: message.status,
                            timestamp: new Date().toISOString()
                        }));
                    }
                }
            }
            catch (error) {
                console.error('Status update failed:', error);
            }
        });
    }
    handleTypingIndicator(senderWs, message) {
        const recipientWs = this.clients.get(message.recipientId);
        if ((recipientWs === null || recipientWs === void 0 ? void 0 : recipientWs.readyState) === ws_1.WebSocket.OPEN) {
            recipientWs.send(JSON.stringify({
                type: 'typing',
                senderId: senderWs.userId,
                isTyping: message.content === 'true',
                timestamp: new Date().toISOString()
            }));
        }
    }
    handleMessageDeleted(senderWs, message) {
        const recipientWs = this.clients.get(message.recipientId);
        if ((recipientWs === null || recipientWs === void 0 ? void 0 : recipientWs.readyState) === ws_1.WebSocket.OPEN) {
            recipientWs.send(JSON.stringify({
                type: 'message_deleted',
                messageId: message.messageId,
                deletedAt: message.deletedAt,
                timestamp: new Date().toISOString()
            }));
        }
    }
    handleConversationCleared(senderWs, message) {
        const recipientWs = this.clients.get(message.recipientId);
        if ((recipientWs === null || recipientWs === void 0 ? void 0 : recipientWs.readyState) === ws_1.WebSocket.OPEN) {
            recipientWs.send(JSON.stringify({
                type: 'conversation_cleared',
                senderId: senderWs.userId,
                timestamp: new Date().toISOString()
            }));
        }
    }
    handleClose(ws) {
        if (ws.userId) {
            this.clients.delete(ws.userId);
            console.log(`User ${ws.userId} disconnected`);
            this.sendOnlineUsersList();
        }
    }
    handleError(ws, error) {
        console.error(`WebSocket error for user ${ws.userId}:`, error);
        ws.close();
    }
}
exports.WSServer = WSServer;
