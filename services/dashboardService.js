// server/services/dashboardService.js
const Contact = require('../models/Contact');
const Group = require('../models/Group'); // Assuming you have a Group model
const Template = require('../models/Template');
const BulkSendJob = require('../models/BulkSendJob');
const Message = require('../models/Message');
const User = require('../models/User'); // Assuming User model for team members
const { statusCode, resMessage } = require('../config/constants');

/**
 * Calculates the number of items created in the last N days compared to the N days before that.
 * @param {mongoose.Model} Model - The Mongoose model to query.
 * @param {Object} query - Base query to filter documents (e.g., { tenantId, userId }).
 * @param {string} dateField - The name of the date field to use (e.g., 'createdAt').
 * @param {number} days - The number of days for the current period (e.g., 7 for this week).
 * @returns {Object} { currentPeriodCount, previousPeriodCount, percentageChange }
 */
const calculateWeeklyChange = async (Model, query, dateField, days = 7) => {
    const now = new Date();
    const currentPeriodStart = new Date(now.setDate(now.getDate() - days));
    const previousPeriodStart = new Date(new Date().setDate(new Date().getDate() - (2 * days)));

    const currentPeriodCount = await Model.countDocuments({
        ...query,
        [dateField]: { $gte: currentPeriodStart }
    });

    const previousPeriodCount = await Model.countDocuments({
        ...query,
        [dateField]: { $gte: previousPeriodStart, $lt: currentPeriodStart }
    });

    let percentageChange = 0;
    if (previousPeriodCount > 0) {
        percentageChange = ((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100;
    } else if (currentPeriodCount > 0) {
        percentageChange = 100; // If previous was 0 and current is > 0, it's a 100% increase
    }

    return { currentPeriodCount, previousPeriodCount, percentageChange };
};


/**
 * @desc    Fetches aggregated dashboard statistics for a given user and tenant.
 * @param {Object} options - Options for fetching stats.
 * @param {string} options.userId - The ID of the authenticated user.
 * @param {string} options.tenantId - The ID of the tenant.
 * @returns {Object} Success status and dashboard data.
 */
exports.getDashboardStats = async ({ userId, tenantId }) => {
    try {
        // Base query for tenant and user specific data
        const baseQuery = { tenantId, userId };

        // --- Contacts Statistics ---
        const totalContacts = await Contact.countDocuments(baseQuery);
        const { currentPeriodCount: newContactsThisWeek, percentageChange: newContactsPercentageChange } =
            await calculateWeeklyChange(Contact, baseQuery, 'createdAt', 7);


        // --- Groups Statistics ---
        // Assuming 'Group' model exists. If not, these will be placeholders or skipped.
        const totalGroups = await Group.countDocuments(baseQuery);
        // Define 'active' groups - e.g., groups with messages in last 30 days
        const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
        const activeGroupsCount = await Group.countDocuments({
            ...baseQuery,
            lastActivityAt: { $gte: thirtyDaysAgo } // Requires a 'lastActivityAt' field in Group model
        });
        const inactiveGroupsCount = totalGroups - activeGroupsCount;


        // --- Templates Statistics ---
        const totalTemplates = await Template.countDocuments(baseQuery);
        const approvedTemplates = await Template.countDocuments({ ...baseQuery, metaStatus: 'APPROVED' });
        const pendingTemplates = await Template.countDocuments({
            ...baseQuery,
            metaStatus: { $in: ['PENDING', 'LOCAL_DRAFT', 'PENDING_UPDATE'] }
        });


        // --- Broadcasting Statistics (BulkSendJob) ---
        const totalBroadcasts = await BulkSendJob.countDocuments(baseQuery);
        const successfulBroadcasts = await BulkSendJob.aggregate([
            { $match: baseQuery },
            { $group: { _id: null, totalSent: { $sum: '$totalSent' } } }
        ]);
        const failedBroadcasts = await BulkSendJob.aggregate([
            { $match: baseQuery },
            { $group: { _id: null, totalFailed: { $sum: '$totalFailed' } } }
        ]);
        const scheduledBroadcasts = await BulkSendJob.countDocuments({ ...baseQuery, status: 'pending' });

        const totalSentMessages = successfulBroadcasts.length > 0 ? successfulBroadcasts[0].totalSent : 0;
        const totalFailedMessages = failedBroadcasts.length > 0 ? failedBroadcasts[0].totalFailed : 0;


        // --- Team Members Statistics (Users) ---
        const totalTeamMembers = await User.countDocuments({ tenantId }); // All users in the tenant
        const adminMembers = await User.countDocuments({ tenantId, role: 'admin' }); // Assuming 'admin' role
        const regularMembers = totalTeamMembers - adminMembers; // Assuming others are 'members'


        // --- Live Chat Statistics (Messages) ---
        // For unread messages: inbound messages with status 'delivered' (not yet 'read' by agent)
        const unreadMessages = await Message.countDocuments({
            ...baseQuery,
            direction: 'inbound',
            status: 'delivered', // Changed from isRead: false
            // Optionally, filter by recent messages if 'live chat' implies recent activity
            // createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) }
        });

        // Response Rate: This is complex. For a simple dashboard, we can approximate.
        // A more robust solution would involve a dedicated Conversation model.
        // For now, let's calculate based on recent inbound vs. outbound messages.
        const twentyFourHoursAgo = new Date(new Date().setHours(new Date().getHours() - 24));
        const recentInboundMessages = await Message.countDocuments({
            ...baseQuery,
            direction: 'inbound',
            createdAt: { $gte: twentyFourHoursAgo }
        });
        const recentOutboundMessages = await Message.countDocuments({
            ...baseQuery,
            direction: 'outbound',
            createdAt: { $gte: twentyFourHoursAgo }
        });

        let responseRate = 0;
        if (recentInboundMessages > 0) {
            // Simple approximation: (outbound messages that are responses / inbound messages)
            // This is not perfect, as outbound messages might not always be direct responses.
            responseRate = (recentOutboundMessages / recentInboundMessages) * 100;
            if (responseRate > 100) responseRate = 100; // Cap at 100%
        }
        // Calculate response rate change vs last week (more complex, placeholder for now)
        // This would require fetching recentInbound/Outbound for previous week too.
        const responseRateChangeVsLastWeek = 0; // Placeholder


        // --- Assemble Dashboard Data ---
        const dashboardData = {
            contacts: {
                total: totalContacts,
                newThisWeek: newContactsThisWeek,
                changeVsLastWeek: parseFloat(newContactsPercentageChange.toFixed(1)),
            },
            groups: {
                total: totalGroups,
                active: activeGroupsCount,
                inactive: inactiveGroupsCount,
            },
            templates: {
                total: totalTemplates,
                approved: approvedTemplates,
                pending: pendingTemplates,
            },
            broadcasting: {
                totalJobs: totalBroadcasts,
                success: totalSentMessages,
                failed: totalFailedMessages,
                scheduled: scheduledBroadcasts,
            },
            teamMembers: {
                total: totalTeamMembers,
                admins: adminMembers,
                members: regularMembers,
            },
            liveChat: {
                unread: unreadMessages,
                responseRate: parseFloat(responseRate.toFixed(1)),
                responseRateChangeVsLastWeek: parseFloat(responseRateChangeVsLastWeek.toFixed(1)),
            },
        };

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Dashboard_stats_fetched_successfully,
            data: dashboardData,
        };

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error,
        };
    }
};
