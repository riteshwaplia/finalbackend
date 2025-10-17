// const express = require("express");
// const router = express.Router();
// const orderController = require("../controllers/orderController");
// const { protect } = require("../middleware/auth");
// const { responseHandler } = require("../middleware/responseHandler");

// router.post("/", protect, responseHandler(orderController.createController));

// router.get("/:orderId", protect, responseHandler(orderController.getByIdController));

// router.put("/:orderId/status", protect, responseHandler(orderController.updateStatusController));


// router.post("/:orderId/payment-success", responseHandler(orderController.paymentSuccessController));

// router.delete("/:orderId", protect, responseHandler(orderController.deleteController));

// module.exports = router;

const express = require("express");
const router = express.Router({ mergeParams: true });
const orderController = require("../controllers/orderController");
const { protect } = require("../middleware/auth");
const { responseHandler } = require("../middleware/responseHandler");

// Admin routes (specific first)
router.get("/admin", protect, responseHandler(orderController.getOrdersListController));
router.get("/admin/:orderId", protect, responseHandler(orderController.getOrderDetailController));
// Core CRUD
router.post("/", protect, responseHandler(orderController.createController));
router.get("/:orderId", responseHandler(orderController.getByIdController));
router.put("/:orderId/status", protect, responseHandler(orderController.updateStatusController));
router.delete("/:orderId", protect, responseHandler(orderController.deleteController));

// Address Update
router.put("/:orderId/address", responseHandler(orderController.updateAddressController));

// Payment Flow
router.post("/:orderId/pay", responseHandler(orderController.generatePaymentLinkController));
router.get("/callback/:orderId", orderController.paymentCallbackController); // redirect → cannot use responseHandler
router.post("/:orderId/payment-success", responseHandler(orderController.paymentSuccessController));
router.post("/:orderId/verify", responseHandler(orderController.verifyPaymentController));


module.exports = router;
