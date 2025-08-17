import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { IUser } from "./usermodel.js";

export interface IMessage extends Document {
  _id: Types.ObjectId;
  sender: Types.ObjectId | IUser;
  recipient: Types.ObjectId | IUser;
  text: string;
  status: string;
  createdAt: Date;
  deleted?: boolean;
  deletedAt?: Date;
}
const MessageSchema = new Schema<IMessage>(
  {
    sender: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: [true, 'Sender is required'],
      validate: {
        validator: (v: Types.ObjectId) => mongoose.isValidObjectId(v),
        message: 'Invalid sender ID'
      }
    },
    recipient: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: [true, 'Recipient is required'],
      validate: {
        validator: (v: Types.ObjectId) => mongoose.isValidObjectId(v),
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
  },
  { 
    timestamps: true,
    autoCreate: true,
    autoIndex: true 
  }
);
export const Message: Model<IMessage> = mongoose.model<IMessage>("Message", MessageSchema);