const crypto = require('crypto');

// ---------------- JazzCash (Hosted Checkout / Page Redirection v1.1) ----------------

const JAZZCASH_URLS = {
  sandbox: 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/',
  production: 'https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/',
};

const jazzcashEnabled = Boolean(
  process.env.JAZZCASH_MERCHANT_ID && process.env.JAZZCASH_PASSWORD && process.env.JAZZCASH_INTEGRITY_SALT
);

function pkTimestamp(date) {
  // JazzCash expects yyyyMMddHHmmss in Pakistan time (UTC+5)
  const d = new Date(date.getTime() + 5 * 3600 * 1000);
  return d.toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

// Secure hash: all non-empty pp* fields sorted by key, values joined with '&',
// prefixed with the integrity salt, HMAC-SHA256 keyed with the salt, upper-case hex.
function jazzcashHash(fields) {
  const salt = process.env.JAZZCASH_INTEGRITY_SALT;
  const values = Object.keys(fields)
    .filter((k) => k.toLowerCase().startsWith('pp') && k !== 'pp_SecureHash' && fields[k] !== '' && fields[k] != null)
    .sort()
    .map((k) => fields[k]);
  return crypto.createHmac('sha256', salt).update([salt, ...values].join('&')).digest('hex').toUpperCase();
}

function jazzcashCheckout({ txnRef, amount, memberName, returnUrl }) {
  const now = new Date();
  const fields = {
    pp_Version: '1.1',
    pp_TxnType: '',
    pp_Language: 'EN',
    pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID,
    pp_SubMerchantID: '',
    pp_Password: process.env.JAZZCASH_PASSWORD,
    pp_BankID: 'TBANK',
    pp_ProductID: 'RETL',
    pp_TxnRefNo: txnRef,
    pp_Amount: String(Math.round(amount * 100)), // paisa
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: pkTimestamp(now),
    pp_BillReference: 'lunch',
    pp_Description: `Lunch budget top-up - ${memberName}`.slice(0, 100),
    pp_TxnExpiryDateTime: pkTimestamp(new Date(now.getTime() + 24 * 3600 * 1000)),
    pp_ReturnURL: returnUrl,
    ppmpf_1: '',
    ppmpf_2: '',
    ppmpf_3: '',
    ppmpf_4: '',
    ppmpf_5: '',
  };
  fields.pp_SecureHash = jazzcashHash(fields);
  const action = JAZZCASH_URLS[process.env.JAZZCASH_ENV === 'production' ? 'production' : 'sandbox'];
  return { action, fields };
}

function jazzcashVerify(body) {
  const received = String(body.pp_SecureHash || '').toUpperCase();
  const expected = jazzcashHash(body);
  const valid = received.length === expected.length && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  return { valid, success: valid && body.pp_ResponseCode === '000', txnRef: body.pp_TxnRefNo, message: body.pp_ResponseMessage };
}

// ---------------- Meezan Bank (e-commerce payment gateway REST API) ----------------

const meezanEnabled = Boolean(process.env.MEEZAN_USERNAME && process.env.MEEZAN_PASSWORD);
const meezanBase = () => (process.env.MEEZAN_API_BASE || 'https://acquiring.meezanbank.com/payment/rest').replace(/\/$/, '');

async function meezanCall(endpoint, params) {
  const body = new URLSearchParams({
    userName: process.env.MEEZAN_USERNAME,
    password: process.env.MEEZAN_PASSWORD,
    ...params,
  });
  const res = await fetch(`${meezanBase()}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (data.errorCode && data.errorCode !== '0') throw new Error(data.errorMessage || `Meezan error ${data.errorCode}`);
  return data;
}

// Returns { orderId, formUrl } - redirect the member to formUrl.
async function meezanRegister({ orderNumber, amount, returnUrl, description }) {
  return meezanCall('register.do', {
    orderNumber,
    amount: String(Math.round(amount * 100)), // paisa
    currency: '586', // PKR
    returnUrl,
    description,
  });
}

// orderStatus 2 = fully paid
async function meezanStatus(orderId) {
  const data = await meezanCall('getOrderStatusExtended.do', { orderId });
  return { paid: Number(data.orderStatus) === 2, orderNumber: data.orderNumber, raw: data };
}

module.exports = {
  jazzcashEnabled,
  jazzcashCheckout,
  jazzcashVerify,
  meezanEnabled,
  meezanRegister,
  meezanStatus,
};
