const express = require("express");
const router = express.Router();
const moment = require("moment");
const querystring = require("qs");
const crypto = require("crypto");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { authenticate } = require("../middleware/authMiddleware");
const mongoose = require("mongoose");

require("dotenv").config(); // Đọc file .env

const vnp_TmnCode = process.env.VNP_TMNCODE || "SHO2XNBE";
const vnp_HashSecret =
  process.env.VNP_HASHSECRET || "2Y9O0BXPAB29WSRQTUIBWLSQFKD2DDUB";
const vnp_Url =
  process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

const vnp_ReturnUrl =
  process.env.VNP_RETURNURL || "http://localhost:5173/payment-result";

router.post("/create_payment_url", authenticate, (req, res) => {
  try {
    const { orderId, amount, orderDescription, bankCode, language } = req.body;
    const userId = req.user.id;

    console.log("[DEBUG] Input Data:", {
      orderId,
      amount,
      orderDescription,
      userId,
    });

    if (!orderId || !amount || !orderDescription || !userId) {
      return res.status(400).json({
        message:
          "Thiếu thông tin bắt buộc (orderId, amount, orderDescription, userId)",
      });
    }

    const createDate = moment().format("YYYYMMDDHHmmss");
    const ipAddr =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    const vnp_TxnRef = `${orderId}-${userId}`;
    const vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode,
      vnp_Amount: amount * 100, // Số tiền cần nhân với 100 (VND)
      vnp_CurrCode: "VND",
      vnp_TxnRef,
      vnp_OrderInfo: orderDescription,
      vnp_OrderType: "billpayment",
      vnp_Locale: language || "vn",
      vnp_ReturnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    if (bankCode) {
      vnp_Params["vnp_BankCode"] = bankCode;
    }

    const sortedParams = sortObject(vnp_Params);

    const signData = querystring.stringify(sortedParams, { encode: false });
    console.log("[DEBUG] Sign Data:", signData);

    const hmac = crypto.createHmac("sha512", vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
    console.log("[DEBUG] Signature:", signed);

    sortedParams["vnp_SecureHash"] = signed;

    const paymentUrl = `${vnp_Url}?${querystring.stringify(sortedParams, {
      encode: false,
    })}`;
    console.log("[DEBUG] Payment URL:", paymentUrl);

    res.json({ paymentUrl });
  } catch (error) {
    console.error("[ERROR] create_payment_url:", error);
    res.status(500).json({ message: "Lỗi tạo URL thanh toán VNPay" });
  }
});

// Xử lý IPN từ VNPay (đảm bảo trong file routes/paymentRoutes.js)
router.get("/vnpay_ipn", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const vnp_Params = req.query;

    console.log("[DEBUG] Dữ liệu trả về từ VNPay (IPN):", vnp_Params);

    const secureHash = vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];

    const signData = querystring.stringify(sortObject(vnp_Params), {
      encode: false,
    });
    const hmac = crypto.createHmac("sha512", process.env.VNP_HASHSECRET);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    if (secureHash === signed) {
      console.log("[DEBUG] Signature validated successfully");

      if (vnp_Params["vnp_ResponseCode"] === "00") {
        const vnp_TxnRef = vnp_Params.vnp_TxnRef;
        const [orderId, userId] = vnp_TxnRef.split("-");

        if (!userId || !orderId) {
          throw new Error("Không tìm thấy userId hoặc orderId trong TxnRef");
        }

        const cart = await Cart.findOne({ user: userId }).populate("items.product");
        if (!cart || cart.items.length === 0) {
          throw new Error("Giỏ hàng trống hoặc không tồn tại");
        }

        console.log("[DEBUG] Cart Items:", cart.items);

        const productsToDeleteFromCart = [];
        for (const item of cart.items) {
          const product = await Product.findById(item.product._id).session(session);

          if (!product) {
            throw new Error(`Sản phẩm không tồn tại: ${item.product._id}`);
          }

          if (product.quantity < item.quantity) {
            throw new Error(`Không đủ số lượng sản phẩm: ${product.name}`);
          }

          product.quantity -= item.quantity;
          if (product.quantity === 0) {
            productsToDeleteFromCart.push(product._id);
          }

          await product.save({ session });
        }

        // Xóa các sản phẩm đã thanh toán khỏi giỏ hàng của người dùng
        cart.items = [];
        await cart.save({ session });

        // Xóa sản phẩm hết hàng khỏi giỏ hàng của tất cả người dùng
        if (productsToDeleteFromCart.length > 0) {
          await Cart.updateMany(
            { "items.product": { $in: productsToDeleteFromCart } },
            { $pull: { items: { product: { $in: productsToDeleteFromCart } } } },
            { session }
          );
        }

        await session.commitTransaction();
        session.endSession();

        console.log("[DEBUG] Thanh toán VNPay thành công và giỏ hàng đã được xử lý");
        return res.status(200).json({ RspCode: "00", Message: "Success" });
      } else {
        console.error("[DEBUG] Payment failed:", vnp_Params);
        return res.status(200).json({ RspCode: "01", Message: "Failed" });
      }
    } else {
      console.error("[DEBUG] Invalid Signature:", vnp_Params);
      return res.status(400).json({ RspCode: "97", Message: "Checksum failed" });
    }
  } catch (error) {
    console.error("[ERROR] vnpay_ipn:", error.message);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ RspCode: "99", Message: error.message });
  }
});

router.post("/querydr", function (req, res, next) {
  process.env.TZ = "Asia/Ho_Chi_Minh";
  let date = new Date();

  let config = require("config");
  let crypto = require("crypto");

  let vnp_TmnCode = config.get("vnp_TmnCode");
  let secretKey = config.get("vnp_HashSecret");
  let vnp_Api = config.get("vnp_Api");

  let vnp_TxnRef = req.body.orderId;
  let vnp_TransactionDate = req.body.transDate;

  let vnp_RequestId = moment(date).format("HHmmss");
  let vnp_Version = "2.1.0";
  let vnp_Command = "querydr";
  let vnp_OrderInfo = "Truy van GD ma:" + vnp_TxnRef;

  let vnp_IpAddr =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;

  let currCode = "VND";
  let vnp_CreateDate = moment(date).format("YYYYMMDDHHmmss");

  let data =
    vnp_RequestId +
    "|" +
    vnp_Version +
    "|" +
    vnp_Command +
    "|" +
    vnp_TmnCode +
    "|" +
    vnp_TxnRef +
    "|" +
    vnp_TransactionDate +
    "|" +
    vnp_CreateDate +
    "|" +
    vnp_IpAddr +
    "|" +
    vnp_OrderInfo;

  let hmac = crypto.createHmac("sha512", secretKey);
  let vnp_SecureHash = hmac.update(new Buffer(data, "utf-8")).digest("hex");

  let dataObj = {
    vnp_RequestId: vnp_RequestId,
    vnp_Version: vnp_Version,
    vnp_Command: vnp_Command,
    vnp_TmnCode: vnp_TmnCode,
    vnp_TxnRef: vnp_TxnRef,
    vnp_OrderInfo: vnp_OrderInfo,
    vnp_TransactionDate: vnp_TransactionDate,
    vnp_CreateDate: vnp_CreateDate,
    vnp_IpAddr: vnp_IpAddr,
    vnp_SecureHash: vnp_SecureHash,
  };
  // /merchant_webapi/api/transaction
  request(
    {
      url: vnp_Api,
      method: "POST",
      json: true,
      body: dataObj,
    },
    function (error, response, body) {
      console.log(response);
    }
  );
});

router.post("/refund", function (req, res, next) {
  process.env.TZ = "Asia/Ho_Chi_Minh";
  let date = new Date();

  let config = require("config");
  let crypto = require("crypto");

  let vnp_TmnCode = config.get("vnp_TmnCode");
  let secretKey = config.get("vnp_HashSecret");
  let vnp_Api = config.get("vnp_Api");

  let vnp_TxnRef = req.body.orderId;
  let vnp_TransactionDate = req.body.transDate;
  let vnp_Amount = req.body.amount * 100;
  let vnp_TransactionType = req.body.transType;
  let vnp_CreateBy = req.body.user;

  let currCode = "VND";

  let vnp_RequestId = moment(date).format("HHmmss");
  let vnp_Version = "2.1.0";
  let vnp_Command = "refund";
  let vnp_OrderInfo = "Hoan tien GD ma:" + vnp_TxnRef;

  let vnp_IpAddr =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;

  let vnp_CreateDate = moment(date).format("YYYYMMDDHHmmss");

  let vnp_TransactionNo = "0";

  let data =
    vnp_RequestId +
    "|" +
    vnp_Version +
    "|" +
    vnp_Command +
    "|" +
    vnp_TmnCode +
    "|" +
    vnp_TransactionType +
    "|" +
    vnp_TxnRef +
    "|" +
    vnp_Amount +
    "|" +
    vnp_TransactionNo +
    "|" +
    vnp_TransactionDate +
    "|" +
    vnp_CreateBy +
    "|" +
    vnp_CreateDate +
    "|" +
    vnp_IpAddr +
    "|" +
    vnp_OrderInfo;
  let hmac = crypto.createHmac("sha512", secretKey);
  let vnp_SecureHash = hmac.update(new Buffer(data, "utf-8")).digest("hex");

  let dataObj = {
    vnp_RequestId: vnp_RequestId,
    vnp_Version: vnp_Version,
    vnp_Command: vnp_Command,
    vnp_TmnCode: vnp_TmnCode,
    vnp_TransactionType: vnp_TransactionType,
    vnp_TxnRef: vnp_TxnRef,
    vnp_Amount: vnp_Amount,
    vnp_TransactionNo: vnp_TransactionNo,
    vnp_CreateBy: vnp_CreateBy,
    vnp_OrderInfo: vnp_OrderInfo,
    vnp_TransactionDate: vnp_TransactionDate,
    vnp_CreateDate: vnp_CreateDate,
    vnp_IpAddr: vnp_IpAddr,
    vnp_SecureHash: vnp_SecureHash,
  };

  request(
    {
      url: vnp_Api,
      method: "POST",
      json: true,
      body: dataObj,
    },
    function (error, response, body) {
      console.log(response);
    }
  );
});

function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}
// Hàm sắp xếp object theo thứ tự alphabet

router.get("/", function (req, res, next) {
  res.render("orderlist", { title: "Danh sách đơn hàng" });
});

router.get("/create_payment_url", function (req, res, next) {
  res.render("order", { title: "Tạo mới đơn hàng", amount: 10000 });
});

router.get("/querydr", function (req, res, next) {
  let desc = "truy van ket qua thanh toan";
  res.render("querydr", { title: "Truy vấn kết quả thanh toán" });
});

router.get("/refund", function (req, res, next) {
  let desc = "Hoan tien GD thanh toan";
  res.render("refund", { title: "Hoàn tiền giao dịch thanh toán" });
});

router.get("/vnpay_return", async (req, res) => {
  try {
    let vnp_Params = req.query;

    console.log("[DEBUG] Dữ liệu trả về từ VNPay (Return URL):", vnp_Params);

    // Lấy SecureHash từ tham số trả về
    let secureHash = vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];

    // Sắp xếp tham số theo thứ tự alphabet
    vnp_Params = sortObject(vnp_Params);

    // Tạo chữ ký hash từ tham số trả về
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    // Kiểm tra chữ ký hợp lệ
    if (secureHash === signed) {
      const responseCode = vnp_Params["vnp_ResponseCode"];
      if (responseCode === "00") {
        console.log("[DEBUG] Giao dịch thành công:", vnp_Params);
        res.status(200).send({
          status: "success",
          message: "Giao dịch thành công!",
          data: vnp_Params,
        });
      } else {
        console.log("[DEBUG] Giao dịch thất bại:", vnp_Params);
        res.status(200).send({
          status: "failed",
          message: `Giao dịch thất bại với mã lỗi: ${responseCode}`,
        });
      }
    } else {
      console.error("[DEBUG] Chữ ký không hợp lệ!", vnp_Params);
      res.status(400).send({
        status: "error",
        message: "Chữ ký không hợp lệ!",
      });
    }
  } catch (error) {
    console.error("[DEBUG] Lỗi trong /vnpay_return:", error);
    res.status(500).send({
      status: "error",
      message: "Đã xảy ra lỗi khi xử lý phản hồi từ VNPay.",
    });
  }
});
module.exports = router;
