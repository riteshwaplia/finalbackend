// cron/scheduledJobs.js
const cron = require('node-cron');
const ScheduledBulkJob = require('../models/ScheduledBulkJob');
const fs = require('fs');
const { sendBulkMessageService } = require('../services/messageService');

const executePendingJobs = async () => {
  const now = new Date();
  console.log(`[${now.toISOString()}] Checking for scheduled jobs...`);

  try {
    const pendingJobs = await ScheduledBulkJob.find({
      status: 'pending',
      scheduledAt: { $lte: now }
    }).lean();

    if (pendingJobs.length === 0) {
      console.log('No pending jobs found.');
      return;
    }

    console.log(`Found ${pendingJobs.length} pending jobs to execute`);

    for (const job of pendingJobs) {
      try {
        console.log(`Processing job ${job._id}...`);
        
        // Mark job as in progress
        await ScheduledBulkJob.updateOne(
          { _id: job._id },
          { $set: { status: 'in_progress', startedAt: new Date() } }
        );

        // Prepare request object
        const req = {
          body: {
            templateName: job.templateName,
            message: job.meta.message || {}
          },
          params: { projectId: job.projectId },
          user: { _id: job.userId },
          tenant: { _id: job.tenantId },
          file: { path: job.meta.filePath }
        };

        // Execute the bulk send
        const result = await sendBulkMessageService(req);

        // Update job status
        await ScheduledBulkJob.updateOne(
          { _id: job._id },
          { 
            $set: { 
              status: result.success ? 'completed' : 'failed',
              completedAt: new Date(),
              result: result
            } 
          }
        );

        // Clean up the uploaded file after processing
        if (job.meta.filePath && fs.existsSync(job.meta.filePath)) {
          fs.unlinkSync(job.meta.filePath);
        }

        console.log(`Job ${job._id} processed successfully`);
      } catch (error) {
        console.error(`Error processing job ${job._id}:`, error);
        await ScheduledBulkJob.updateOne(
          { _id: job._id },
          { 
            $set: { 
              status: 'failed',
              completedAt: new Date(),
              error: error.message 
            } 
          }
        );
      }
    }
  } catch (error) {
    console.error('Error in scheduled job execution:', error);
  }
};

// Initialize the scheduler
const initScheduler = () => {
  cron.schedule('* * * * *', executePendingJobs);
  console.log('Scheduled job executor initialized');
};

module.exports = { initScheduler };