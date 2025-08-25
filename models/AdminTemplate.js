const mongoose = require("mongoose");

const AdminTemplateSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    trim: true,
  },
  language: {
    type: String,
    required: true,
    trim: true,
  },
  components: {
    type: mongoose.Schema.Types.Mixed,
    default: [],
  },
  metaTemplateId: {
    type: String,
    unique: true,
    sparse: true,
  },
  tag: {
    type: String,
    trim: true,
    default: null,
  },
  metaCategory: {
    type: String,
    trim: true,
  },
  TemplateCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OccasionCategory",
  },
  type: {
    type: String,
    enum: ["STANDARD", "CAROUSEL"],
    default: "STANDARD",
  },
  otp_type: {
    type: String,
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

AdminTemplateSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("AdminTemplate", AdminTemplateSchema);
