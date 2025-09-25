const mongoose = require("mongoose");

const feedSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    catalogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "catalog",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    file_name: { type: String, trim: true },
    schedule: {
      id: { type: String },
      interval: {
        type: String,
        enum: ["DAILY", "WEEKLY", "HOURLY"],
        default: "DAILY",
      },
      interval_count: { type: Number, default: 1 },
      hour: { type: Number, min: 0, max: 23 },
      minute: { type: Number, default: 0 },
      timezone: { type: String, default: "UTC" },
      url: { type: String, trim: true },
    },
    latest_upload: {
      id: { type: String },
      start_time: { type: Date },
      end_time: { type: Date },
    },
    product_count: { type: Number, default: 0 },
    meta_feed_id: { type: String },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Feed", feedSchema);
