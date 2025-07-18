const Project = require('../models/project');
const Group = require('../models/Group');
const { statusCode, resMessage } = require("../config/constants");

exports.multiDelete = async (req) => {
    try {
        const { ids } = req.body;

        const checkProject = await Project.findOne({ _id: req.params.projectId, userId: req.user._id, tenantId: req.tenant._id });
        if (!checkProject) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.ProjectId_dont_exists,
                statusCode: statusCode.NOT_FOUND,
            }
        }

        if (!Array.isArray(ids) || ids.length === 0) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.No_IDs_provided_for_updation,
                statusCode: statusCode.BAD_REQUEST
            };
        }

        const result = await Group.deleteMany({
            _id: { $in: ids },
            userId: req.user._id,
            projectId: req.params.projectId,
            tenantId: req.tenant._id
        });

        if (result.deletedCount === 0) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_groups_found,
                statusCode: statusCode.NOT_FOUND
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Group_deleted_successfully,
            statusCode: statusCode.OK
        };
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        };
    }
};