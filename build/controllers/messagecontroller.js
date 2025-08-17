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
exports.clearConversation = exports.deleteMessage = exports.getMessages = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const message_1 = require("../models/message");
// Remove the custom ExpressRequest interface since we're using global type extension
// The Request type is already properly extended in authmiddleware.ts
const getMessages = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Authentication check
        if (!req.user) {
            return res.status(401).json({
                status: 'fail',
                message: 'Authentication required'
            });
        }
        const { userId } = req.params;
        const { limit = 100, before } = req.query; // Add pagination params
        const ourUserId = req.user._id;
        // Validate IDs
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                status: 'fail',
                message: 'Invalid user ID format'
            });
        }
        // Base query
        const query = {
            $or: [
                { sender: ourUserId, recipient: userId }, // Consistent ID format
                { sender: userId, recipient: ourUserId }
            ],
            deleted: { $ne: true }
        };
        // Pagination support
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }
        const messages = yield message_1.Message.find(query)
            .sort({ createdAt: -1 }) // Newest first for pagination
            .limit(Number(limit))
            .lean()
            .exec();
        res.status(200).json({
            status: 'success',
            data: {
                messages: messages.reverse(), // Return in chronological order
                hasMore: messages.length === Number(limit)
            }
        });
    }
    catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch messages',
            data: { messages: [], hasMore: false }
        });
    }
});
exports.getMessages = getMessages;
const deleteMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. Authentication Check
        if (!req.user) {
            return res.status(401).json({
                status: 'fail',
                message: 'Authentication required'
            });
        }
        const { messageId } = req.params;
        // 2. ID Format Validation
        if (!mongoose_1.default.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({
                status: 'fail',
                message: 'Invalid message ID format'
            });
        }
        // 3. Message Existence Check
        const existingMessage = yield message_1.Message.findOne({
            _id: messageId,
            $or: [
                { sender: req.user._id }, // User must be sender or recipient
                { recipient: req.user._id }
            ],
            deleted: { $ne: true } // Not already deleted
        });
        if (!existingMessage) {
            return res.status(404).json({
                status: 'fail',
                message: 'Message not found or unauthorized'
            });
        }
        // 4. Soft Delete Operation
        const message = yield message_1.Message.findOneAndUpdate({ _id: messageId }, {
            $set: {
                deleted: true,
                deletedAt: new Date(),
                text: '[Message deleted]',
                status: 'deleted'
            }
        }, { new: true }).lean();
        if (!message)
            return null; // This should return a proper response
        // 5. WebSocket Notification Prep
        const wsData = {
            type: 'message_deleted',
            messageId: messageId,
            deletedAt: message.deletedAt,
            sender: existingMessage.sender,
            recipient: existingMessage.recipient
        };
        res.status(200).json({
            status: 'success',
            data: null,
            message: 'Message deleted successfully',
            wsData
        });
    }
    catch (error) {
        console.error('Error deleting message:', error);
        if (error instanceof mongoose_1.default.Error.CastError) {
            return res.status(400).json({
                status: 'fail',
                message: 'Invalid message ID'
            });
        }
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});
exports.deleteMessage = deleteMessage;
const clearConversation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({
                status: 'fail',
                message: 'Authentication required'
            });
        }
        const { userId } = req.params;
        // Validate userId format
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                status: 'fail',
                message: 'Invalid user ID format'
            });
        }
        // Soft delete by marking as deleted
        const result = yield message_1.Message.updateMany({
            $or: [
                { sender: req.user._id, recipient: userId },
                { sender: userId, recipient: req.user._id }
            ]
        }, { $set: { deleted: true } } // Using $set for explicit update
        );
        if (result.modifiedCount === 0) {
            return res.status(404).json({
                status: 'fail',
                message: 'No messages found to delete'
            });
        }
        res.status(200).json({
            status: 'success',
            data: null,
            message: 'Conversation cleared successfully'
        });
    }
    catch (error) {
        console.error('Error clearing conversation:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});
exports.clearConversation = clearConversation;
