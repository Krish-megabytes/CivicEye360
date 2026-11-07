import { Schema, model } from 'mongoose';

export interface CounterAttrs {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterAttrs>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const Counter = model<CounterAttrs>('Counter', counterSchema);
