const express = require("express");
const { protect } = require("../middleware/auth");
const { responseHandler } = require("../middleware/responseHandler");
const feedController = require("../controllers/feedController");

const router = express.Router({ mergeParams: true });

router.post("/feed", protect, responseHandler(feedController.createFeedController));
router.post(
  "/feed/:catalogId/sync",
  protect,
  responseHandler(feedController.syncFeedController)
);
router.put(
  "/feed/:catalogId/:feedId",
  protect,
  responseHandler(feedController.updateFeedController)
);
router.get("/feed/:feedId", protect, responseHandler(feedController.getFeedController));

router.get(
  "/:catalogId/feeds",
  protect,
  responseHandler(feedController.listFeedsController)
);
router.delete(
  "/feed/:catalogId/:feedId",
  protect,
  responseHandler(feedController.deleteFeedController)
);

module.exports = router;
