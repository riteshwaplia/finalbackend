const Contact = require("../models/Contact");
const Group = require("../models/Group"); // Needed to validate groupIds
const { statusCode, resMessage } = require("../config/constants");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const mongoose = require('mongoose');
const Project = require("../models/Project");

// Utility function to validate Group IDs
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


// @desc    Create a new contact
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
        // Check for existing contact by mobileNumber number (if provided)
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

        // Validate groupIds
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

// @desc    Upload contacts from an Excel/CSV file
exports.uploadContact = async (req) => {
    try {
    const userId = req.user._id;
        const tenantId = req.tenant._id;
        const projectId = req.params.projectId;
    
        const checkProject = await Project.findOne({ _id: projectId, userId });
        if (!checkProject) {
            console.warn("❌ Project not found or does not belong to user");
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.ProjectId_dont_exists,
                statusCode: statusCode.NOT_FOUND,
            };mapping
        }

        const mapping = JSON.parse(req.body.mapping).map(key => key.toLowerCase());
        

        let groupNames = [];
        try {
            groupNames = JSON.parse(req.body.groupName);
        } catch (e) {
            groupNames = req.body.groupName ? [req.body.groupName] : [];
        }

        // File processing
        const uploadDir = path.join(__dirname, '..', 'uploads');
        const filePath = req.file.path;


        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet);

        // Normalize keys to lowercase
        const normalizedData = rawData.map(row => {
            const lowerRow = {};
            for (let key in row) {
                lowerRow[key.toLowerCase()] = row[key];
            }
            return lowerRow;
        });

        const seenMobileNumbers = new Set();
        const filteredData = [];
        const errors = [];
       for (const [index, row] of normalizedData.entries()) {
        console.log(`\n🔄 Processing row ${index + 2}:`, row);

        const newRow = {
            tenantId,
            userId,
            projectId,
            groupName: groupNames
        };

        for (const key of mapping) {
            newRow[key] = row[key];
        }

        // Mobile number extraction
        let mobileNumber = newRow["mobileNumber"] || newRow["mobilenumber"] || newRow["phone"];

        if (!mobileNumber) {
            errors.push({ rowNumber: index + 2, reason: "Missing mobile number" });
            continue;
        }

        if (typeof mobileNumber === 'string') {
            mobileNumber = mobileNumber.trim();
        }

        const normalizedMobile = mobileNumber.replace(/\D/g, '');

        if (seenMobileNumbers.has(normalizedMobile)) {
            errors.push({ rowNumber: index + 2, reason: `Duplicate in file: ${mobileNumber}` });
            continue;
        }

        seenMobileNumbers.add(normalizedMobile);
        newRow.mobileNumber = mobileNumber;

        const exists = await Contact.findOne({ tenantId, userId, projectId, mobileNumber });

        if (exists) {
            errors.push({ rowNumber: index + 2, reason: `Duplicate in DB: ${mobileNumber}` });
            continue;
        }
        filteredData.push(newRow);
    }

        // Insert valid contacts
        if (filteredData.length > 0) {
            await Contact.insertMany(filteredData);
        } else {
            console.warn("⚠️ No valid contacts to insert");
        }

        // Delete uploaded file
        fs.unlinkSync(filePath);

        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.File_upload_successful,
            data: {
                importedContacts: filteredData.length,
                failedContacts: errors.length,
                errors
            }
        };

    } catch (error) {
        console.error("🔥 Error in uploadContact service:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: resMessage.File_upload_failed,
            error: error.message
        };
    }
};

// @desc    Get contact list
exports.contactList = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const projectId = req.params.projectId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const searchText = req.query.search || "";
    const groupId = req.query.groupId; // Filter by group

    try {
        const searchCondition = {
            tenantId,
            userId,
            projectId,
            isBlocked: false // Only active contacts by default
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

// @desc    Block a contact (set isBlocked to true)
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

// @desc    Get list of groups (for dropdowns, etc.) - This might be redundant if groupListController in groups already exists
//          Re-using groupController.getController for fetching groups within a project
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


// @desc    Get contact by ID
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

// @desc    Update a contact
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

        // Check if new mobileNumber number conflicts with another contact (excluding itself)
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

        // Validate groupIds
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

// @desc    Delete a contact
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

// @desc    Bulk update contacts (e.g., assign to group, block/unblock, etc.)
exports.multiUpdate = async (req) => {
    const { ids, updateFields } = req.body; // updateFields could be { groupIds: [...], isBlocked: true, etc. }
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
        // Validate groupIds if they are being updated
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
                message: resMessage.No_contacts_found // Or a more specific message
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

// @desc    Get blacklisted contacts
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
            isBlocked: true // Only blacklisted contacts
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

// @desc    Remove a contact from blacklist (set isBlocked to false)
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

// @desc    Remove contacts in bulk (delete many)
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
