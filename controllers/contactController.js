const contactService = require("../services/contactService"); // Using the service layer

// The controller functions are now wrappers that call the service and return its result,
// which is then processed by the `responseHandler` middleware.

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
    // This controller might call the contact service's groupList,
    // or you could decide to directly call groupController.getController for consistency
    // if you already have a general group list endpoint.
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
