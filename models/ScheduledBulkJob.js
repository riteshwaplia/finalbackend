const mongoose = require('mongoose');

const ScheduledBulkJobSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  templateName: {
    type: String,
    required: true,
    trim: true
  },
  fileName: {
    type: String,
    trim: true,
    default: 'N/A'
  },
  totalContacts: {
    type: Number,
    default: 0
  },
   scheduledAt: {
    type: Date,
    required: true,
    index: true // For faster querying of pending jobs
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },

 
  lastRunAt: {
    type: Date
  },

  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ScheduledBulkJob', ScheduledBulkJobSchema);