const Joi = require("joi");

// Custom Joi ObjectId validator
const objectId = Joi.string().pattern(/^[0-9a-fA-F] {24}$/).message("Invalid ObjectId format");

// Create Group
exports.createGroupSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().required().messages({
      'string.base': `"title" must be a string`,
      'string.empty': `"title" cannot be empty`,
      'any.required': `"title" is required`
    }),
    description: Joi.string().allow('').optional().messages({
      'string.base': `"description" must be a string`
    })
  }),
  params: Joi.object({
    projectId: objectId.required().messages({
      'any.required': `"projectId" is required`,
      'string.pattern.base': `"projectId" must be a valid ObjectId`
    })
  }),
  query: Joi.object()
});

// Update Group
exports.updateGroupSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().optional().messages({
      'string.base': `"title" must be a string`
    }),
    description: Joi.string().allow('').optional().messages({
      'string.base': `"description" must be a string`
    })
  }),
  params: Joi.object({
    projectId: objectId.required().messages({
      'any.required': `"projectId" is required`,
      'string.pattern.base': `"projectId" must be a valid ObjectId`
    }),
    groupId: objectId.required().messages({
      'any.required': `"groupId" is required`,
      'string.pattern.base': `"groupId" must be a valid ObjectId`
    })
  }),
  query: Joi.object()
});

// Multi Delete Groups
exports.multiDeleteGroupSchema = Joi.object({
  body: Joi.object({
    ids: Joi.array().items(objectId).min(1).required().messages({
      'array.base': `"ids" must be an array`,
      'array.min': `"ids" must have at least one item`,
      'any.required': `"ids" is required`
    })
  }),
  params: Joi.object({
    projectId: objectId.required().messages({
      'any.required': `"projectId" is required`,
      'string.pattern.base': `"projectId" must be a valid ObjectId`
    })
  }),
  query: Joi.object()
});

// Unarchive Groups
exports.unarchiveGroupSchema = Joi.object({
  body: Joi.object({
    ids: Joi.array().items(objectId).min(1).required().messages({
      'array.base': `"ids" must be an array`,
      'array.min': `"ids" must contain at least one valid ID`,
      'any.required': `"ids" is required`
    })
  }),
  params: Joi.object({
    projectId: objectId.required().messages({
      'any.required': `"projectId" is required`,
      'string.pattern.base': `"projectId" must be a valid ObjectId`
    })
  }),
  query: Joi.object()
});

// Archive Group
exports.archiveGroupSchema = Joi.object({
  params: Joi.object({
    projectId: objectId.required().messages({
      'any.required': `"projectId" is required`,
      'string.pattern.base': `"projectId" must be a valid ObjectId`
    }),
    groupId: objectId.required().messages({
      'any.required': `"groupId" is required`,
      'string.pattern.base': `"groupId" must be a valid ObjectId`
    })
  }),
  query: Joi.object(),
  body: Joi.object()
});

// Get Groups
exports.getGroupSchema = Joi.object({
  params: Joi.object({
    projectId: objectId.required().messages({
      'any.required': `"projectId" is required`,
      'string.pattern.base': `"projectId" must be a valid ObjectId`
    })
  }),
  query: Joi.object()
});

// Edit Get Group
exports.editGetGroupSchema = Joi.object({
  params: Joi.object({
    groupId: objectId.required().messages({
      'any.required': `"groupId" is required`,
      'string.pattern.base': `"groupId" must be a valid ObjectId`
    })
  }),
  query: Joi.object()
});

// Delete Group
exports.deleteGroupSchema = Joi.object({
  params: Joi.object({
    groupId: objectId.required().messages({
      'any.required': `"groupId" is required`,
      'string.pattern.base': `"groupId" must be a valid ObjectId`
    })
  }),
  query: Joi.object()
});

// Bulk Delete
exports.bulkDeleteSchema = Joi.object({
  body: Joi.object({
    ids: Joi.array().items(objectId).min(1).required().messages({
      'array.base': `"ids" must be an array`,
      'array.min': `"ids" must contain at least one valid ID`,
      'any.required': `"ids" is required`
    })
  }),
  params: Joi.object(),
  query: Joi.object()
});

// Multi Archive
exports.multiArchiveSchema = Joi.object({
  body: Joi.object({
    ids: Joi.array().items(objectId).min(1).required().messages({
      'array.base': `"ids" must be an array`,
      'array.min': `"ids" must contain at least one valid ID`,
      'any.required': `"ids" is required`
    })
  }),
  params: Joi.object(),
  query: Joi.object()
});
// Multi Archive Groups
exports.multiUpdateSchema = Joi.object({
  body: Joi.object({
    ids: Joi.array().items(objectId).min(1).required().messages({
      'array.base': `"ids" must be an array`,
      'array.min': `"ids" must contain at least one valid ID`,
      'any.required': `"ids" is required`
    })
  }),
  params: Joi.object({
    projectId: objectId.required().messages({
      'any.required': `"projectId" is required`,
      'string.pattern.base': `"projectId" must be a valid ObjectId`
    })
  }),
  query: Joi.object()
});     