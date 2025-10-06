const MetaFlows = require('../models/MetaFlows.js');
const { statusCode, resMessage } = require('../config/constants.js');
const BusinessProfile = require('../models/BusinessProfile.js');
const { createMetaFlowsOnMeta, listMetaFlowsOnMeta } = require('../functions/functions.js');


exports.createMetaFlowsService = async (req) => {
    const {businessProfileId}=req.params
  const businessProfile = await BusinessProfile.findOne({
    _id: businessProfileId,
    userId: req.user._id,
    tenantId: req.tenant._id,
  });

  if (!businessProfile) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: resMessage.Business_profile_not_found,
    };
  }

  if (
    !req.body.name ||
    req.body.name.trim() === '' ||
    !Array.isArray(req.body.categories) ||
    req.body.categories.length === 0 ||
    !req.body.flowJson
  ) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: "Please provide all required fields (name, categories & flowJson)",
    };
  }

  // 3️⃣ Prepare payload for Meta API
  const payload = {
    version: "7.2",
    name: req.body.name,
    screens: [req.body.flowJson],
    flowName: req.body.flowName || req.body.name,
    categories: req.body.categories,
  };

  // 4️⃣ Call Meta API
  const response = await createMetaFlowsOnMeta(
    businessProfile.metaAccessToken,
    businessProfile.metaBusinessId,
    payload
  );
console.log("response",response)
  if (response?.error) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: response.details?.message || "Meta API error",
    };
  }

  // 5️⃣ Save flow in DB
  const metaFlow = new MetaFlows({
    userId: req.user._id,
    tenantId: req.tenant._id,
    businessProfileId: businessProfileId,
    metaFlowId: response.id,
    name: req.body.name,
    flowJson: req.body.flowJson,
    categories: req.body.categories,
    status: response.status || "DRAFT",
    version: response.json_version || "7.2",
    isSynced: true,
    lastSyncedAt: new Date(),
  });

  await metaFlow.save();

  return {
    status: statusCode.CREATED,
    success: true,
    message: resMessage.Meta_Flow_created_successfully,
    data: metaFlow,
  };
};

exports.syncMetaFlowsService = async (req) => {
    const {businessProfileId}=req.params;
  const businessProfile = await BusinessProfile.findOne({
    _id: businessProfileId,
    userId: req.user._id,
    tenantId: req.tenant._id,
  });

  if (!businessProfile) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: resMessage.Business_profile_not_found,
    };
  }

  // 2️⃣ Fetch flows from Meta
  const flowsFromMeta = await listMetaFlowsOnMeta(businessProfile.metaAccessToken, businessProfile.metaBusinessId);

  if (flowsFromMeta.error) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message: flowsFromMeta.details?.message || "Failed to fetch flows from Meta",
    };
  }

  const metaFlowIds = flowsFromMeta.map((f) => f.id);

  // 3️⃣ Sync each flow
  for (const flow of flowsFromMeta) {
    const existingFlow = await MetaFlows.findOne({
      metaFlowId: flow.id,
      tenantId: req.tenant._id,
      userId: req.user._id,
    });

    if (existingFlow) {
      // Update existing flow
      existingFlow.name = flow.name || existingFlow.name;
      existingFlow.status = flow.status || existingFlow.status;
      existingFlow.version = flow.json_version || existingFlow.version;
      existingFlow.categories = flow.categories || existingFlow.categories;
      existingFlow.flowJson = flow.screens?.[0] || existingFlow.flowJson;
      existingFlow.isSynced = true;
      existingFlow.lastSyncedAt = new Date();
      await existingFlow.save();
    } else {
      // Insert new flow
      const newFlow = new MetaFlows({
        userId: req.user._id,
        tenantId: req.tenant._id,
        businessProfileId: businessProfileId,
        metaFlowId: flow.id,
        name: flow.name,
        flowJson: flow.screens?.[0] || {},
        categories: flow.categories || ['OTHER'],
        status: flow.status || "DRAFT",
        version: flow.json_version || "7.2",
        isSynced: true,
        lastSyncedAt: new Date(),
      });
      await newFlow.save();
    }
  }

  // 4️⃣ Optionally delete local flows no longer on Meta
  await MetaFlows.deleteMany({
    businessProfileId: businessProfileId,
    tenantId: req.tenant._id,
    userId: req.user._id,
    metaFlowId: { $nin: metaFlowIds },
  });

  return {
    status: statusCode.OK,
    success: true,
    message: resMessage.Meta_Flow_sync_success,
    data: flowsFromMeta,
  };
};


exports.listMetaFlowsService = async (req) => {
    const {businessProfileId}=req.params;
  const flows = await MetaFlows.find({
    businessProfileId: businessProfileId,
    tenantId: req.tenant._id,
    userId: req.user._id,
  });

  return {
    status: statusCode.OK,
    success: true,
    data: flows,
  };
};