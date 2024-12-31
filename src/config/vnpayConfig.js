require('dotenv').config();

const vnp_TmnCode = process.env.VNP_TMNCODE || "SHO2XNBE";
const vnp_HashSecret = process.env.VNP_HASHSECRET || "2Y9O0BXPAB29WSRQTUIBWLSQFKD2DDUB";
const vnp_Url = process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const vnp_ReturnUrl = process.env.VNP_RETURNURL || "http://localhost:5173/payment-result";

module.exports = {
  vnp_TmnCode,
  vnp_HashSecret,
  vnp_Url,
  vnp_ReturnUrl,
};
