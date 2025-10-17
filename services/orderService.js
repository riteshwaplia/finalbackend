// // services/orderService.js
// const Order = require("../models/OrderSchema");
// const Transaction = require("../models/Transaction");
// const { sendWhatsAppMessages } = require("./messageService");

// const generateOrderNumber = () => {
//   const timestamp = Date.now().toString();
//   const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
//   return `ORD${timestamp}${random}`;
// };

// // Create Order
// exports.createOrderFromWebhook = async (inboundMessage, project, contact, conversationId) => {
//     console.log("order webhook payload:", inboundMessage);
//   try {
//     const orderData = inboundMessage.order; // Meta order payload
//     const items = (orderData.product_items || []).map(item => ({
//       productRetailerId: item.product_retailer_id,
//       quantity: item.quantity,
//       itemPrice: item.item_price,
//       currency: item.currency,
//     }));

//     const order = await Order.create({
//       tenantId: project.tenantId,
//       userId: project.userId,
//       projectId: project._id,
//       contactId: contact._id,
//       conversationId,      
//       orderNumber: generateOrderNumber(), // ✅ generate before saving

//       items,
//       subtotal: items.reduce((sum, i) => sum + i.itemPrice * i.quantity, 0),
//       total: items.reduce((sum, i) => sum + i.itemPrice * i.quantity, 0),
//       currency: items[0]?.currency || "INR",
//       status: "pending",
//       paymentStatus: "pending",
//       metaOrderId: inboundMessage.id,   // Store WhatsApp order ID
//       catalogId: orderData.catalog_id,
//     });

//     return { success: true, order };
//   } catch (err) {
//     console.error("[OrderService] Failed to create order from webhook:", err);
//     return { success: false, error: err.message };
//   }
// };

// /**
//  * 2️⃣ Create order via REST API (Admin panel)
//  */
// exports.createOrderFromApi = async (req) => {
//   const { items, subtotal, total, currency } = req.body;
//   const tenantId = req.user.tenantId;
//   const userId = req.user._id;

//   const order = await Order.create({
//     tenantId,
//     userId,
//     projectId: req.body.projectId,
//     contactId: req.body.contactId,
//     items,
//     subtotal,
//     total,
//     currency: currency || "INR",
//     status: "pending",
//     paymentStatus: "pending",
//   });

//   return { success: true, order };
// };

// // Get Order Details
// exports.getOrderDetails = async (req) => {
//   const { orderId } = req.params;
//   const tenantId = req.user.tenantId;

//   const order = await Order.findOne({ _id: orderId, tenantId })
//     .populate("contactId")
//     .populate("projectId");

//   if (!order) throw new Error("Order not found");

//   return { success: true, message: "Order fetched successfully", data: order };
// };

// // Update Order Status
// exports.updateOrderStatus = async (req) => {
//   const { orderId } = req.params;
//   const { status } = req.body;
//   const tenantId = req.user.tenantId;

//   const order = await Order.findOneAndUpdate(
//     { _id: orderId, tenantId },
//     { status, updatedAt: Date.now() },
//     { new: true }
//   );

//   if (!order) throw new Error("Order not found");

//   return { success: true, message: "Order status updated successfully", data: order };
// };

// // Process Payment Success
// exports.processPaymentSuccess = async (req) => {
//   const { orderId } = req.params;
//   const paymentData = req.body;

//   const order = await Order.findById(orderId);
//   if (!order) throw new Error("Order not found");

//   const transaction = await Transaction.create({
//     tenantId: order.tenantId,
//     userId: order.userId,
//     projectId: order.projectId,
//     orderId: order._id,
//     contactId: order.contactId,
//     amount: order.total,
//     currency: order.currency,
//     status: "success",
//     paymentGateway: paymentData.gateway || "razorpay",
//     gatewayTransactionId: paymentData.gatewayTransactionId,
//     paymentMethod: paymentData.paymentMethod,
//     paymentDetails: paymentData,
//   });

//   order.paymentStatus = "paid";
//   order.status = "confirmed";
//   await order.save();

//   return { success: true, message: "Payment processed successfully", data: { order, transaction } };
// };

// // Delete Order
// exports.deleteOrder = async (req) => {
//   const { orderId } = req.params;
//   const tenantId = req.user.tenantId;

//   const order = await Order.findOneAndDelete({ _id: orderId, tenantId });
//   if (!order) throw new Error("Order not found");

//   return { success: true, message: "Order deleted successfully" };
// };
// exports.sendPaymentLink = async ({ to, phoneNumberId, accessToken, paymentUrl }) => {
//   try {
//     if (!to || !phoneNumberId || !accessToken || !paymentUrl) {
//       throw new Error("Missing required fields for sending payment link");
//     }

//     const message = {
//       text: {
//         body: `Hi 👋, here is your payment link: ${paymentUrl}\n\nPlease complete your payment securely.`,
//       },
//     };

//     const sendResult = await sendWhatsAppMessages({
//       phoneNumberId,
//       accessToken,
//       to,
//       type: "text",
//       message,
//       FACEBOOK_URL: "https://graph.facebook.com/v19.0",
//     });

//     return { success: sendResult.success, data: sendResult.data };
//   } catch (err) {
//     console.error("[sendPaymentLink] Error:", err.message);
//     return { success: false, error: err.message };
//   }
// };



// // orderController.js
// exports.updateOrderAddress = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const shippingAddress = req.body;

//     const order = await Order.findByIdAndUpdate(
//       orderId,
//       { shippingAddress },
//       { new: true }
//     );

//     if (!order) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     res.json({ success: true, message: "Address updated", order });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };



// exports.generatePaymentLinkForOrder = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const order = await Order.findById(orderId);
//     if (!order) return res.status(404).json({ success: false, message: "Order not found" });

//     const link = await razorpay.paymentLink.create({
//       amount: order.total * 100, // convert to paise
//       currency: order.currency,
//       description: `Payment for Order ${order.orderNumber}`,
//       customer: {
//         name: order.shippingAddress?.name || "Customer",
//         contact: order.shippingAddress?.phone,
//       },
//       callback_url: `${process.env.FRONTEND_URL}/payment/callback/${orderId}`,
//       callback_method: "get",
//     });

//     order.paymentLink = link.short_url;
//     order.paymentLinkSent = true;
//     await order.save();

//     res.json({ success: true, url: link.short_url });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };


const Order = require("../models/OrderSchema");
const Transaction = require("../models/Transaction");
const { sendWhatsAppMessages } = require("./messageService");

// Generate Order Number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `ORD${timestamp}${random}`;
};

// ✅ Create order from WhatsApp webhook
exports.createOrderFromWebhook = async (inboundMessage, project, contact, conversationId) => {
  try {
    const orderData = inboundMessage.order;
    const items = (orderData.product_items || []).map(item => ({
      productRetailerId: item.product_retailer_id,
      quantity: item.quantity,
      itemPrice: item.item_price,
      currency: item.currency,
    }));

    const order = await Order.create({
      tenantId: project.tenantId,
      userId: project.userId,
      projectId: project._id,
      contactId: contact._id,
      conversationId,
      orderNumber: generateOrderNumber(),
      items,
      subtotal: items.reduce((sum, i) => sum + i.itemPrice * i.quantity, 0),
      total: items.reduce((sum, i) => sum + i.itemPrice * i.quantity, 0),
      currency: items[0]?.currency || "INR",
      status: "pending",
      paymentStatus: "pending",
      metaOrderId: inboundMessage.id,
      catalogId: orderData.catalog_id,
    });

    return { success: true, order };
  } catch (err) {
    console.error("[OrderService] Webhook order failed:", err);
    return { success: false, error: err.message };
  }
};

// ✅ Create order via REST
exports.createOrderFromApi = async (req) => {
  const { items, subtotal, total, currency, projectId, contactId } = req.body;
  const tenantId = req.user.tenantId;
  const userId = req.user._id;

  const order = await Order.create({
    tenantId,
    userId,
    projectId,
    contactId,
    items,
    subtotal,
    total,
    currency: currency || "INR",
    status: "pending",
    paymentStatus: "pending",
  });

  return { success: true, order };
};

// ✅ Get Order
exports.getOrderDetails = async (req) => {
  const { orderId } = req.params;

    const tenantId = req.tenant._id;

  const order = await Order.findOne({ _id: orderId, tenantId })
    .populate("contactId")

  if (!order) throw new Error("Order not found");

  return { success: true, message: "Order fetched", data: order };
};

// ✅ Update Status
exports.updateOrderStatus = async (req) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const tenantId = req.user.tenantId;

  const order = await Order.findOneAndUpdate(
    { _id: orderId, tenantId },
    { status, updatedAt: Date.now() },
    { new: true }
  );

  if (!order) throw new Error("Order not found");

  return { success: true, message: "Order updated", data: order };
};

// ✅ Update Address
exports.updateOrderAddress = async (req) => {
  const { orderId } = req.params;
  const shippingAddress = req.body;

  const order = await Order.findByIdAndUpdate(orderId, { shippingAddress }, { new: true });
  if (!order) throw new Error("Order not found");

  return { success: true, message: "Address updated", data: order };
};

// ✅ Payment Success (manual API call, not Razorpay callback)
exports.processPaymentSuccess = async (req) => {
  const { orderId } = req.params;
  const paymentData = req.body;

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  const txn = await Transaction.create({
    tenantId: order.tenantId,
    userId: order.userId,
    projectId: order.projectId,
    orderId: order._id,
    contactId: order.contactId,
    amount: order.total,
    currency: order.currency,
    status: "success",
    paymentGateway: paymentData.gateway || "razorpay",
    gatewayTransactionId: paymentData.gatewayTransactionId,
    paymentMethod: paymentData.paymentMethod,
    paymentDetails: paymentData,
  });

  order.paymentStatus = "paid";
  order.status = "confirmed";
  await order.save();

  return { success: true, message: "Payment processed", data: { order, txn } };
};

// ✅ WhatsApp Payment Link Sender
exports.sendPaymentLink = async ({ to, phoneNumberId, accessToken, paymentUrl }) => {
  try {
    const message = {
      text: { body: `Hi 👋, here is your payment link: ${paymentUrl}` },
    };

    const sendResult = await sendWhatsAppMessages({
      phoneNumberId,
      accessToken,
      to,
      type: "text",
      message,
      FACEBOOK_URL: "https://graph.facebook.com/v19.0",
    });

    return { success: sendResult.success, data: sendResult.data };
  } catch (err) {
    console.error("[sendPaymentLink] Error:", err.message);
    return { success: false, error: err.message };
  }
};



exports.getOrdersList = async (req) => {
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;
  let { page = 1, limit = 10, status, paymentStatus } = req.query;
console.log("params", req.params,projectId);
  // Ensure numbers
  page = parseInt(page, 10);
  limit = parseInt(limit, 10);
if(!projectId){
    return { success: false, message: "Project ID is required", data: [] };
}
  const query = { tenantId };
  if (status) query.status = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (projectId) query.projectId = projectId;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate("contactId", "name phone email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(query),
  ]);

  return {
    success: true,
    message: "Orders list fetched",
    data: {
      orders,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    },
  };
};


exports.getOrderDetail = async (req) => {
  const { orderId,projectId } = req.params;
const tenantId = req.tenant._id;
console.log("params", req.params);
  // 🔎 Find order with populated relations
  console.log("orderId", orderId, "tenantId", tenantId, "projectId", projectId);
  
  const order = await Order.findOne({ _id: orderId, tenantId ,projectId})
    .populate("contactId", "name phone email") // customer details
    .populate("items.productId");              // product details

  if (!order) throw new Error("Order not found");

  // 🔎 Find related transaction
  const txn = await Transaction.findOne({ orderId: order._id });

  return {
    success: true,
    message: "Order detail fetched",
    data: {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shipping,
      total: order.total,
      currency: order.currency,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,

      contact: order.contactId,        // populated contact
      shippingAddress: order.shippingAddress,

     items: order.items.map(item => ({
  quantity: item.quantity,
  price: item.price || item.snapshot?.price || 0,
  currency: item.currency || order.currency,
  name: item.name || item.snapshot?.name || item.productId?.name || "N/A",
  image: item.image || item.snapshot?.image || item.productId?.image || null,
  product: item.productId || null,
})),


      transaction: txn || null,
    },
  };
};

// ✅ Get All Transactions (admin view)
exports.getTransactions = async (req) => {
  const { page = 1, limit = 10, status, projectId, orderId } = req.query;
  const tenantId = req.user.tenantId;

  const query = { tenantId };
  if (status) query.status = status;
  if (projectId) query.projectId = projectId;
  if (orderId) query.orderId = orderId;

  const txns = await Transaction.find(query)
    .populate("orderId", "orderNumber total status paymentStatus")
    .populate("contactId", "name phone email")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Transaction.countDocuments(query);

  return {
    success: true,
    message: "Transactions list fetched",
    data: {
      transactions: txns,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    },
  };
};
