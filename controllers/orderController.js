const orderService = require("../services/orderService");
const paymentService = require("../services/paymentService");

// CRUD
exports.createController = async (req) => await orderService.createOrderFromApi(req);
exports.getByIdController = async (req) => await orderService.getOrderDetails(req);
exports.updateStatusController = async (req) => await orderService.updateOrderStatus(req);
exports.deleteController = async (req) => await orderService.deleteOrder(req);

// Payment Success (manual webhook → not Razorpay callback)
exports.paymentSuccessController = async (req) => await orderService.processPaymentSuccess(req);

// Address
exports.updateAddressController = async (req) => await orderService.updateOrderAddress(req);

exports.getOrdersListController = async (req) => await orderService.getOrdersList(req);
exports.getOrderDetailController = async (req) => await orderService.getOrderDetail(req);

// Payment
// exports.generatePaymentLinkController = async (req) => await paymentService.generatePaymentLinkForOrder(req);

// Razorpay Callback → needs redirect (cannot be wrapped)
exports.paymentCallbackController = async (req, res) => await paymentService.paymentCallback(req, res);
exports.generatePaymentLinkController = async (req) => await paymentService.generatePaymentLinkForOrder(req);
exports.verifyPaymentController = async (req) => await paymentService.verifyPayment(req);

