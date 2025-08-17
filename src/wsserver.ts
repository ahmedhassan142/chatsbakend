import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { Message } from './models/message';
import { User } from './models/usermodel';

interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  isAuthenticated: boolean;
}

interface ChatMessage {
  type: 'message' | 'status_update' | 'typing' | 'message_deleted' | 'conversation_cleared' | 'mark_read';
  content: string;
  recipientId: string;
  clientTempId?: string;
  messageId?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  deletedAt?: string;
}

export class WSServer {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();

  constructor(server: any) {
    this.wss = new WebSocketServer({ noServer: true });
    
    server.on('upgrade', (req: IncomingMessage, socket: any, head: any) => {
      this.handleUpgrade(req, socket, head);
    });
  }

  private handleUpgrade(req: IncomingMessage, socket: any, head: any) {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      //@ts-ignore
      const decoded = jwt.verify(token, process.env.JWTPRIVATEKEY) as { _id: string };
      
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        const authWs = ws as AuthenticatedWebSocket;
        authWs.userId = decoded._id;
        authWs.isAuthenticated = true;
        this.handleConnection(authWs);
      });
    } catch (error) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  }

  private handleConnection(ws: AuthenticatedWebSocket) {
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
    ws.on('message', (data: string) => this.handleMessage(ws, data));
    ws.on('close', () => this.handleClose(ws));
    ws.on('error', (error) => this.handleError(ws, error));
  }

  private async sendOnlineUsersList() {
    const onlineUserIds = Array.from(this.clients.keys());
    const users = await User.find({ 
      _id: { $in: onlineUserIds } 
    }).select('_id firstName lastName avatarLink');

    const onlineUsers = users.map((user: any) => ({
      _id: user._id.toString(),
      fullname: `${user.firstName} ${user.lastName}`.trim(),
      firstName: user.firstName,
      lastName: user.lastName,
      avatarLink: user.avatarLink,
      isOnline: true
    }));

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'online_users',
          users: onlineUsers,
          timestamp: new Date().toISOString()
        }));
      }
    });
  }

  private async handleMessage(senderWs: AuthenticatedWebSocket, data: string) {
    try {
      const message = JSON.parse(data) as ChatMessage;
      
      switch (message.type) {
        case 'message':
          await this.handleChatMessage(senderWs, message);
          break;
        case 'status_update':
          await this.handleStatusUpdate(senderWs, message);
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
          await this.handleMessageRead(senderWs, message);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Message handling error:', error);
    }
  }

  private async handleChatMessage(senderWs: AuthenticatedWebSocket, message: any) {
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
      const newMessage = new Message({
        sender: senderWs.userId,
        recipient: message.recipientId,
        text: message.content,
        status: 'sent'
      });

      const savedMessage = await newMessage.save();

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
      if (recipientWs?.readyState === WebSocket.OPEN) {
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
        await Message.updateOne(
          { _id: savedMessage._id },
          { $set: { status: 'delivered' } }
        );

        // Delivery confirmation to sender
        senderWs.send(JSON.stringify({
          type: 'status_update',
          messageId: savedMessage._id.toString(),
          status: 'delivered',
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('Message handling failed:', error);
      senderWs.send(JSON.stringify({
        type: 'status_update',
        tempId: message.clientTempId,
        status: 'failed',
        error: 'Message delivery failed',
        timestamp: new Date().toISOString()
      }));
    }
  }

  private async handleMessageRead(senderWs: AuthenticatedWebSocket, message: { messageId: string }) {
    try {
      // Update message status to 'read' in database
      const updated = await Message.updateOne(
        { _id: message.messageId, recipient: senderWs.userId },
        { status: 'read' }
      );

      if (updated.modifiedCount > 0) {
        // Notify original sender that their message was read
        const msg = await Message.findById(message.messageId);
        if (msg && msg.sender) {
          const originalSenderWs = this.clients.get(msg.sender.toString());
          originalSenderWs?.send(JSON.stringify({
            type: 'status_update',
            messageId: message.messageId,
            status: 'read',
            timestamp: new Date().toISOString()
          }));
        }
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  private async handleStatusUpdate(senderWs: AuthenticatedWebSocket, message: ChatMessage) {
    if (!message.messageId || !message.status) return;

    try {
      const updated = await Message.updateOne(
        { _id: message.messageId, recipient: senderWs.userId },
        { status: message.status }
      );

      if (updated.modifiedCount > 0) {
        const msg = await Message.findById(message.messageId);
        if (msg && msg.sender) {
          const senderWs = this.clients.get(msg.sender.toString());
          senderWs?.send(JSON.stringify({
            type: 'status_update',
            messageId: message.messageId,
            status: message.status,
            timestamp: new Date().toISOString()
          }));
        }
      }
    } catch (error) {
      console.error('Status update failed:', error);
    }
  }

  private handleTypingIndicator(senderWs: AuthenticatedWebSocket, message: ChatMessage) {
    const recipientWs = this.clients.get(message.recipientId);
    if (recipientWs?.readyState === WebSocket.OPEN) {
      recipientWs.send(JSON.stringify({
        type: 'typing',
        senderId: senderWs.userId,
        isTyping: message.content === 'true',
        timestamp: new Date().toISOString()
      }));
    }
  }

  private handleMessageDeleted(senderWs: AuthenticatedWebSocket, message: any) {
    const recipientWs = this.clients.get(message.recipientId);
    if (recipientWs?.readyState === WebSocket.OPEN) {
      recipientWs.send(JSON.stringify({
        type: 'message_deleted',
        messageId: message.messageId,
        deletedAt: message.deletedAt,
        timestamp: new Date().toISOString()
      }));
    }
  }

  private handleConversationCleared(senderWs: AuthenticatedWebSocket, message: any) {
    const recipientWs = this.clients.get(message.recipientId);
    if (recipientWs?.readyState === WebSocket.OPEN) {
      recipientWs.send(JSON.stringify({
        type: 'conversation_cleared',
        senderId: senderWs.userId,
        timestamp: new Date().toISOString()
      }));
    }
  }

  private handleClose(ws: AuthenticatedWebSocket) {
    if (ws.userId) {
      this.clients.delete(ws.userId);
      console.log(`User ${ws.userId} disconnected`);
      this.sendOnlineUsersList();
    }
  }

  private handleError(ws: AuthenticatedWebSocket, error: Error) {
    console.error(`WebSocket error for user ${ws.userId}:`, error);
    ws.close();
  }
}