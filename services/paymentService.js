// // services/paymentService.js

// const Razorpay = require("razorpay");
// const Order = require("../models/OrderSchema");
// const Transaction = require("../models/Transaction");

// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// // ✅ Generate Razorpay Payment Link
// exports.generatePaymentLinkForOrder = async (req) => {
//   const { orderId } = req.params;
//   const order = await Order.findById(orderId);
// console.log("res params", req.params);
//   if (!order) throw new Error("Order not found");

//   const link = await razorpay.paymentLink.create({
//     amount: order.total * 100,
//     currency: order.currency,
//     description: `Payment for Order ${order.orderNumber}`,
//     customer: {
//       name: order.shippingAddress?.name || "Customer",
//     //   email: order.shippingAddress?.email || "customer@example.com",
//     //   contact: order.shippingAddress?.phone || "911234567890",
//     contact: "917061274672",
//     email: "7rutba@gmail.com"
//     },
//     // notify: { sms: true, email: true },
//     callback_url: `${process.env.BACKEND_URL}/api/orders/callback/${orderId}`,
//     callback_method: "get",
//   });
// console.log("link", link);
//   order.paymentLink = link.short_url;
//   order.paymentLinkSent = true;
//   await order.save();

// return { success: true, data:{url: link.short_url} };
// };

// // ✅ Handle Razorpay Callback
// exports.paymentCallback = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const paymentId = req.query.razorpay_payment_id;

//     const order = await Order.findById(orderId);
//     if (!order) throw new Error("Order not found");

//     await Transaction.create({
//       tenantId: order.tenantId,
//       userId: order.userId,
//       projectId: order.projectId,
//       orderId: order._id,
//       contactId: order.contactId,
//       amount: order.total,
//       currency: order.currency,
//       status: paymentId ? "success" : "failed",
//       paymentGateway: "razorpay",
//       gatewayTransactionId: paymentId || "N/A",
//       paymentMethod: "upi/card",
//       paymentDetails: req.query,
//     });

//     order.paymentStatus = paymentId ? "paid" : "failed";
//     order.status = paymentId ? "confirmed" : "cancelled";
//     await order.save();

//     return res.redirect(
//       paymentId
//         ? `${process.env.FRONTEND_URL}/success/${orderId}`
//         : `${process.env.FRONTEND_URL}/failure/${orderId}`
//     );
//   } catch (err) {
//     console.error("[PaymentCallback] Error:", err);
//     return res.status(500).send("Payment verification failed");
//   }
// };


// services/paymentService.js

const Razorpay = require("razorpay");
const Order = require("../models/OrderSchema");
const Transaction = require("../models/Transaction");
const { sendWhatsAppMessages } = require("./messageService");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ Generate Razorpay Payment Link (without backend callback)
exports.generatePaymentLinkForOrder = async (req) => {
  const { orderId } = req.params;
  const order = await Order.findById(orderId);
  console.log("res params", req.params);

  if (!order) throw new Error("Order not found");

  const link = await razorpay.paymentLink.create({
    amount: order.total * 100,
    currency: order.currency,
    description: `Payment for Order ${order.orderNumber}`,
    customer: {
      name: order.shippingAddress?.name || "Customer",
    //   contact: order.shippingAddress?.phone || "917000000000",
    //   email: order.shippingAddress?.email || "customer@example.com",
        contact: "917061274672",
    email: "7rutba@gmail.com"
    },
  callback_url: `https://sabnode.netlify.app/success/${order.projectId}/${order._id}`,
  callback_method: "get",
    //   notify: { sms: true, email: true },

  });

  console.log("link", link);

  order.paymentLink = link.short_url;
  order.paymentLinkSent = true;
  await order.save();

  return { success: true, data: { url: link.short_url } };
};

// ✅ Verify Razorpay Payment (frontend will call this after redirect)
exports.verifyPayment = async (req) => {
  const { orderId, razorpay_payment_id } = req.body;

  if (!orderId || !razorpay_payment_id) {
    throw new Error("orderId and razorpay_payment_id are required");
  }
  console.log("transationid", razorpay_payment_id);

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  // Fetch payment details directly from Razorpay
  const payment = await razorpay.payments.fetch(razorpay_payment_id);

  const status = payment.status === "captured" ? "success" : "failed";

  // Save transaction
  const txn = new Transaction({
  tenantId: order.tenantId,
  userId: order.userId,
  projectId: order.projectId,
  orderId: order._id,
  contactId: order.contactId,
  amount: order.total,
  currency: order.currency,
  status,
  paymentGateway: "razorpay",
  gatewayTransactionId: razorpay_payment_id,
  paymentMethod: payment.method,
  paymentDetails: payment,
});

await txn.save();

  // Update order
  order.paymentStatus = status === "success" ? "paid" : "failed";
  order.status = status === "success" ? "confirmed" : "cancelled";
  await order.save();
if (status === "success" && order.contactId?.phone) {
    try {
      const msg = `🎉 Your order ${order.orderNumber} has been confirmed!\nWe received your payment of ${order.total} ${order.currency}. Thank you for shopping with us.`;
      await sendWhatsAppMessages(order.contactId.phone, msg);
      console.log(`✅ WhatsApp confirmation sent to ${order.contactId.phone}`);
    } catch (err) {
      console.error("❌ Failed to send WhatsApp confirmation:", err);
    }
  }
  return { success: true,  data:{orderId: order._id ,status,}};
};





// http://localhost:5173/success/68b936755cb20b76fe57f6e5?razorpay_payment_id=pay_RDTx4jbXIAjcWB&razorpay_payment_link_id=plink_RDTwqYh4gafIqK&razorpay_payment_link_reference_id=&razorpay_payment_link_status=paid&razorpay_signature=1fd37dc90d671e328e0519ad8dcd468fb0032a8ef8c03dfdc19c41d3cb65f3ca