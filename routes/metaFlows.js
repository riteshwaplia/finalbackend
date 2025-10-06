const express = require('express');
const { protect } = require('../middleware/auth');
const {responseHandler} = require('../middleware/responseHandler');
const metaFlowsController = require('../controllers/metaFlowsController'); 

const router = express.Router({ mergeParams: true });

router.post("/:businessProfileId", protect, responseHandler(metaFlowsController.createMetaFlows));
router.get("/:businessProfileId", protect,responseHandler(metaFlowsController.listMetaFlows));
router.post(
  "/:businessProfileId/sync",
  protect,
  responseHandler(metaFlowsController.syncMetaFlows)
);

module.exports = router;