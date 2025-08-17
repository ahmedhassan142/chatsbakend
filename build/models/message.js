"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const MessageSchema = new mongoose_1.Schema({
    sender: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: [true, 'Sender is required'],
        validate: {
            validator: (v) => mongoose_1.default.isValidObjectId(v),
            message: 'Invalid sender ID'
        }
    },
    recipient: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: [true, 'Recipient is required'],
        validate: {
            validator: (v) => mongoose_1.default.isValidObjectId(v),
            message: 'Invalid recipient ID'
        }
    },
    text: {
        type: String,
        required: [true, 'Message text is required'],
        minlength: [1, 'Message cannot be empty'],
        maxlength: [1000, 'Message too long']
    },
    status: {
        type: String,
        default: 'sent',
        enum: {
            values: ['sending', 'sent', 'delivered', 'read', 'failed'],
            message: 'Invalid status value'
        }
    },
    createdAt: { type: Date, default: Date.now },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date }
}, {
    timestamps: true,
    autoCreate: true,
    autoIndex: true
});
exports.Message = mongoose_1.default.model("Message", MessageSchema);
