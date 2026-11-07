import { Schema, model, type Types } from 'mongoose';

export interface RoutingRuleAttrs {
  category: string;
  departmentId: Types.ObjectId;
  active: boolean;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const routingRuleSchema = new Schema<RoutingRuleAttrs>(
  {
    category: { type: String, required: true, unique: true, lowercase: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    active: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

export const RoutingRule = model<RoutingRuleAttrs>('RoutingRule', routingRuleSchema);
