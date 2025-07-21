const xlsx = require('xlsx');
const mongoose = require('mongoose');
const Contact = require("../models/Contact");
const Group = require("../models/Group");
const { statusCode, resMessage } = require("../config/constants");
const Project = require("../models/project");

const validateGroupIds = async (tenantId, userId, projectId, groupIds) => {
    if (!groupIds || groupIds.length === 0) {
        return { isValid: true, invalidGroups: [] };
    }
    const existingGroups = await Group.find({
        _id: { $in: groupIds },
        tenantId,
        userId,
        projectId
    });
    const foundGroupIds = new Set(existingGroups.map(group => group._id.toString()));
    const invalidGroups = groupIds.filter(id => !foundGroupIds.has(id.toString()));
    return { isValid: invalidGroups.length === 0, invalidGroups };
};

exports.create = async (req) => {
    const { name, email, mobileNumber, groupIds } = req.body;
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;

    if (!name || (!email && !mobileNumber)) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: "Name and either email or mobileNumber are required."
        };
    }

    try {
        if (mobileNumber) {
            const existingContact = await Contact.findOne({ tenantId, userId, projectId, mobileNumber });
            if (existingContact) {
                return {
                    status: statusCode.CONFLICT,
                    success: false,
                    message: resMessage.Contact_already_exists
                };
            }
        }

        const { isValid, invalidGroups } = await validateGroupIds(tenantId, userId, projectId, groupIds);
        if (!isValid) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: `Invalid group IDs provided: ${invalidGroups.join(', ')}`
            };
        }

        const contact = await Contact.create({ tenantId, userId, projectId, name, email,   mobileNumber: mobileNumber, groupIds });
        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.Contact_created_successfully,
            data: contact
        };
    } catch (error) {
        console.error("Error in create service:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.uploadContact = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;

    if (!req.file) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.No_file_uploaded
        };
    }

    const filePath = req.file.path;
    const importedContacts = [];
    const errors = [];

    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        console.log("data", data);
        for (const row of data) {
            const { Name, Email, mobileNumber, Groups } = row;
            let groupIds = [];
            if (Groups) {
                groupIds = Groups.split(',').map(id => id.trim()).filter(id => mongoose.Types.ObjectId.isValid(id));
            }

            try {
                const { isValid, invalidGroups } = await validateGroupIds(tenantId, userId, projectId, groupIds);
                if (!isValid) {
                    errors.push({ row, reason: `Invalid group IDs: ${invalidGroups.join(', ')}` });
                    continue;
                }

                let existingContact = null;
                if (mobileNumber) {
                    existingContact = await Contact.findOne({ tenantId, userId, projectId, mobileNumber: mobileNumber });
                }

                if (existingContact) {
                    errors.push({ row, reason: `Contact with mobileNumber ${mobileNumber} already exists.` });
                } else {
                    const newContact = await Contact.create({
                        tenantId,
                        userId,
                        projectId,
                        name: Name,
                        email: Email,
                        mobileNumber: mobileNumber,
                        groupIds
                    });
                    importedContacts.push(newContact);
                }
            } catch (contactError) {
                console.error("Error processing contact row:", row, contactError);
                errors.push({ row, reason: `Failed to create contact: ${contactError.message}` });
            }
        }

        // Clean up the uploaded file
        // fs.unlinkSync(filePath);

        if (errors.length > 0) {
            return {
                status: statusCode.OK,
                success: true,
                message: `File processed with ${importedContacts.length} contacts imported and ${errors.length} errors.`,
                data: { importedContacts, errors }
            };
        }

        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.File_upload_successful,
            data: { importedContacts }
        };

    } catch (error) {
        console.error("Error in uploadContact service:", error);
        // Clean up the file even if parsing fails
        // if (fs.existsSync(filePath)) {
        //     fs.unlinkSync(filePath);
        // }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.File_upload_failed,
            error: error.message
        };
    }
};

exports.contactList = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const searchText = req.query.search || "";
    const groupId = req.query.groupId; 

    try {
        const searchCondition = {
            tenantId,
            userId,
            projectId,
            isBlocked: false
        };

        if (searchText) {
            searchCondition.$or = [
                { name: { $regex: searchText, $options: "i" } },
                { email: { $regex: searchText, $options: "i" } },
                { mobileNumber: { $regex: searchText, $options: "i" } }
            ];
        }

        if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
            searchCondition.groupIds = groupId;
        }

        const [data, total] = await Promise.all([
            Contact.find(searchCondition).sort({ name: 1 }).skip(skip).limit(limit).populate('groupIds', 'title'), // Populate group titles
            Contact.countDocuments(searchCondition)
        ]);

        if (!data || data.length === 0) {
            return {
                status: statusCode.OK,
                success: true,
                data: [],
                message: resMessage.No_contacts_found
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Contacts_fetch_successfully,
            data,
            pagination: {
                total,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
            }
        };
    } catch (error) {
        console.error("Error in contactList service:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.blockContact = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const contactId = req.params.contactId;

    try {
        const contact = await Contact.findOne({ _id: contactId, tenantId, userId, projectId });
        if (!contact) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Contact_not_found
            };
        }

        contact.isBlocked = true;
        await contact.save();

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Contact_blocked_successfully,
            data: contact
        };
    } catch (error) {
        console.error("Error in blockContact service:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid contact ID." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.groupList = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;

    try {
        const groups = await Group.find({ tenantId, userId, projectId, isActive: true }).select('title description');
        if (!groups || groups.length === 0) {
            return {
                status: statusCode.OK,
                success: true,
                data: [],
                message: resMessage.No_groups_found
            };
        }
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Groups_fetch_successfully,
            data: groups
        };
    } catch (error) {
        console.error("Error in groupList service (contactService):", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.contactById = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const contactId = req.params.contactId;

    try {
        const contact = await Contact.findOne({ _id: contactId, tenantId, userId, projectId }).populate('groupIds', 'title');
        if (!contact) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Contact_not_found
            };
        }
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Contacts_fetch_successfully,
            data: contact
        };
    } catch (error) {
        console.error("Error in contactById service:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid contact ID." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.updateContact = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const contactId = req.params.contactId;
    const { name, email, mobileNumber, groupIds } = req.body;

    try {
        const contact = await Contact.findOne({ _id: contactId, tenantId, userId, projectId });
        if (!contact) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Contact_not_found
            };
        }

        if (mobileNumber && mobileNumber !== contact.mobileNumber) {
            const existingPhoneContact = await Contact.findOne({
                tenantId,
                userId,
                projectId,
                mobileNumber,
                _id: { $ne: contactId }
            });
            if (existingPhoneContact) {
                return {
                    status: statusCode.CONFLICT,
                    success: false,
                    message: resMessage.Contact_already_exists
                };
            }
        }

        const { isValid, invalidGroups } = await validateGroupIds(tenantId, userId, projectId, groupIds);
        if (!isValid) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: `Invalid group IDs provided: ${invalidGroups.join(', ')}`
            };
        }

        contact.name = name || contact.name;
        contact.email = email !== undefined ? email : contact.email;
        contact.mobileNumber = mobileNumber !== undefined ? mobileNumber : contact.mobileNumber;
        contact.groupIds = groupIds !== undefined ? groupIds : contact.groupIds;

        await contact.save();

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Contact_updated_successfully,
            data: contact
        };
    } catch (error) {
        console.error("Error in updateContact service:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid contact ID." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.deleteContact = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const contactId = req.params.contactId;

    try {
        const contact = await Contact.findOneAndDelete({ _id: contactId, tenantId, userId, projectId });
        if (!contact) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Contact_not_found
            };
        }
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Contact_deleted_successfully
        };
    } catch (error) {
        console.error("Error in deleteContact service:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid contact ID." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.multiUpdate = async (req) => {
    const { ids, updateFields } = req.body; 
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;

    if (!Array.isArray(ids) || ids.length === 0) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.No_IDs_provided_for_updation
        };
    }
    if (!updateFields || Object.keys(updateFields).length === 0) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: "No update fields provided."
        };
    }

    try {
        if (updateFields.groupIds !== undefined) {
            const { isValid, invalidGroups } = await validateGroupIds(tenantId, userId, projectId, updateFields.groupIds);
            if (!isValid) {
                return {
                    status: statusCode.BAD_REQUEST,
                    success: false,
                    message: `Invalid group IDs provided for bulk update: ${invalidGroups.join(', ')}`
                };
            }
        }

        const result = await Contact.updateMany(
            { _id: { $in: ids }, tenantId, userId, projectId },
            { $set: updateFields }
        );

        if (result.modifiedCount === 0) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_contacts_found
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Bulk_update_successful,
            data: { modifiedCount: result.modifiedCount }
        };
    } catch (error) {
        console.error("Error in multiUpdate service:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.blackList = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const searchText = req.query.search || "";

    try {
        const searchCondition = {
            tenantId,
            userId,
            projectId,
            isBlocked: true
        };

        if (searchText) {
            searchCondition.$or = [
                { name: { $regex: searchText, $options: "i" } },
                { email: { $regex: searchText, $options: "i" } },
                { mobileNumber: { $regex: searchText, $options: "i" } }
            ];
        }

        const [data, total] = await Promise.all([
            Contact.find(searchCondition).sort({ name: 1 }).skip(skip).limit(limit).populate('groupIds', 'title'),
            Contact.countDocuments(searchCondition)
        ]);

        if (!data || data.length === 0) {
            return {
                status: statusCode.OK,
                success: true,
                data: [],
                message: resMessage.No_contacts_found
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Contacts_fetch_successfully,
            data,
            pagination: {
                total,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
            }
        };
    } catch (error) {
        console.error("Error in blackList service:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.removeBlackListContact = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const contactId = req.params.contactId;

    try {
        const contact = await Contact.findOne({ _id: contactId, tenantId, userId, projectId });
        if (!contact) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Contact_not_found
            };
        }

        contact.isBlocked = false;
        await contact.save();

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Contact_unblocked_successfully,
            data: contact
        };
    } catch (error) {
        console.error("Error in removeBlackListContact service:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid contact ID." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.removeBulkContact = async (req) => {
    const { ids } = req.body;
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;

    if (!Array.isArray(ids) || ids.length === 0) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.No_IDs_provided_for_deletion
        };
    }

    try {
        const result = await Contact.deleteMany({
            _id: { $in: ids },
            tenantId,
            userId,
            projectId
        });

        if (result.deletedCount === 0) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_contacts_found
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Bulk_delete_successful,
            data: { deletedCount: result.deletedCount }
        };
    } catch (error) {
        console.error("Error in removeBulkContact service:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};

exports.bulkBlockContact = async (req) => {
    const { ids } = req.body;
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;

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

    try {
        const result = await Contact.updateMany({
            _id: { $in: ids },
            tenantId,
            userId,
            projectId
        }, { $set: { isBlocked: true } });

        if (result.matchedCount === 0) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage?.No_contacts_found,
                statusCode: statusCode.NOT_FOUND
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Bulk_update_successful,
            statusCode: statusCode.OK
        };
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.Server_error,
            error: error.message
        };
    }
};