
const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
require("dotenv").config();

const {
  initializeDatabase,
  saveTransaction
} = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));
app.use(express.static(__dirname));

function getRazorpay() {
  if (
    !process.env.RAZORPAY_KEY_ID ||
    !process.env.RAZORPAY_KEY_SECRET
  ) {
    throw new Error("Payment provider is not configured");
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

// Server health
app.get("/api/health", (req, res) => {
  res.json({
    app: "KIRUU PAY",
    server: "online",
    payments: "not_enabled_for_public_use"
  });
});

// Create Razorpay order
app.post("/api/create-order", async (req, res) => {
  try {
    const amount = Number(req.body.amount);

    if (
      !Number.isInteger(amount) ||
      amount < 1 ||
      amount > 1000
    ) {
      return res.status(400).json({
        error: "Amount must be between ₹1 and ₹1,000"
      });
    }

    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "kiruu_" + crypto.randomUUID()
    });

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error("Order creation failed:", error.message);

    return res.status(503).json({
      error: "Payment service is unavailable"
    });
  }
});

// Verify payment and save captured transaction
app.post("/api/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string"
    ) {
      return res.status(400).json({
        verified: false,
        error: "Invalid payment details"
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      return res.status(503).json({
        verified: false,
        error: "Payment provider is not configured"
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest();

    let receivedSignature;

    try {
      receivedSignature = Buffer.from(
        razorpay_signature,
        "hex"
      );
    } catch {
      return res.status(400).json({
        verified: false,
        error: "Invalid signature"
      });
    }

    if (
      receivedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(
        receivedSignature,
        expectedSignature
      )
    ) {
      return res.status(400).json({
        verified: false,
        error: "Payment signature is invalid"
      });
    }

    const razorpay = getRazorpay();

    // Verify actual payment with Razorpay
    const payment = await razorpay.payments.fetch(
      razorpay_payment_id
    );

    if (
      payment.order_id !== razorpay_order_id ||
      payment.status !== "captured"
    ) {
      return res.status(400).json({
        verified: false,
        error: "Payment is not captured or does not match"
      });
    }

    const order = await razorpay.orders.fetch(
      razorpay_order_id
    );

    if (
      order.status !== "paid" ||
      order.amount !== payment.amount ||
      order.currency !== payment.currency
    ) {
      return res.status(400).json({
        verified: false,
        error: "Order and payment details do not match"
      });
    }

    // Save only after successful provider verification
    const saved = await saveTransaction({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: payment.amount,
      currency: payment.currency
    });

    if (!saved) {
      return res.status(409).json({
        verified: false,
        error: "Transaction already recorded"
      });
    }

    return res.json({
      verified: true,
      message: "Captured payment verified and recorded",
      transactionId: saved.id
    });

  } catch (error) {
    console.error("Payment verification failed:", error.message);

    return res.status(503).json({
      verified: false,
      error: "Verification or database service unavailable"
    });
  }
});

// Start server and initialize database
async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log("KIRUU PAY server running on port " + PORT);
    });
  } catch (error) {
    console.error("Database initialization failed:", error.message);
    process.exit(1);
  }
}

startServer();
