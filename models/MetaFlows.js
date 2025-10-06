const mongoose = require("mongoose");

const MetaFlowsSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  businessProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BusinessProfile",
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  metaFlowId: {
    type: String,
    unique: true,
    sparse: true,
  },
  status: {
    type: String,
    enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
    default: "DRAFT",
  },
  categories: {
    emum: [
      "SIGN_UP",
      "SIGN_IN",
      "APPOINTMENT_BOOKING",
      "LEAD_GENERATION",
      "CONTACT_US",
      "CUSTOMER_SUPPORT",
      "SURVEY",
      "OTHER",
    ],
    type: [String],
    default: ["OTHER"],
    required: true,
  },
  metaErrors: {
    type: Array,
    default: [],
  },
  flowJson: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  version: {
    type: String,
  },

  isSynced: {
    type: Boolean,
    default: false,
  },
  lastSyncedAt: {
    type: Date,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

MetaFlowsSchema.index(
  { metaFlowId: 1, businessProfileId: 1 },
  {
    unique: true,
    partialFilterExpression: { metaFlowId: { $type: "string" } },
  }
);

MetaFlowsSchema.index({ businessProfileId: 1, name: 1 }, { unique: true });

MetaFlowsSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("MetaFlows", MetaFlowsSchema);
