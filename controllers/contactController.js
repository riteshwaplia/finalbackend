const contactService = require("../services/contactService");
const { statusCode } = require("../config/constants");

exports.createController = async (req) => {
    return await contactService.create(req);
};

exports.uploadContactController = async (req) => {
    return await contactService.uploadContact(req);
};

exports.contactListController = async (req) => {
    return await contactService.contactList(req);
};

exports.blockContactController = async (req) => {
    return await contactService.blockContact(req);
};

exports.groupListController = async (req) => {
    return await contactService.groupList(req);
};

exports.contactByIdController = async (req) => {
    return await contactService.contactById(req);
};

exports.updateContactController = async (req) => {
    return await contactService.updateContact(req);
};

exports.deleteContactController = async (req) => {
    return await contactService.deleteContact(req);
};

exports.multiContactUpdateController = async (req) => {
    return await contactService.multiUpdate(req);
};

exports.blackListController = async (req) => {
    return await contactService.blackList(req);
};

exports.removeBlockContactController = async (req) => {
    return await contactService.removeBlackListContact(req);
};

exports.removeBulkController = async (req) => {
    return await contactService.removeBulkContact(req);
};

exports.addCustomFieldToContactsController = async (req) => {
    return await contactService.addCustomFieldToContacts(req);
};
exports.bulkBlockContactController = async (req) => {
    try {
        return await contactService.bulkBlockContact(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        }
    }
}
