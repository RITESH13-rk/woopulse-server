const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const deviceTokens = {};

app.post("/register-device", (req, res) => {
  const { storeKey, token } = req.body;

  if (!storeKey || !token) {
    return res.status(400).json({
      error: "Missing storeKey or token"
    });
  }

  deviceTokens[storeKey] = token;

  console.log("Device registered for store:", storeKey);

  return res.json({
    success: true,
    message: "Device token registered successfully"
  });
});

app.post("/webhook/woocommerce", async (req, res) => {
  try {
    console.log("WooCommerce webhook received");

    const storeKey = req.query.storeKey;

    if (!storeKey) {
      return res.status(400).json({
        error: "Missing storeKey"
      });
    }

    const deviceToken = deviceTokens[storeKey];

    if (!deviceToken) {
      console.log("No device token found for store:", storeKey);
      return res.status(200).json({
        success: false,
        message: "No device registered for this store"
      });
    }

    const order = req.body;
    const orderNumber = order.number || order.id;

    const customerName =
      `${order.billing?.first_name || ""} ${order.billing?.last_name || ""}`.trim() || "Customer";

    const currency = order.currency || "INR";
    const total = order.total || "0";

    await admin.messaging().send({
      token: deviceToken,

      notification: {
        title: `🛒 New Order #${orderNumber}`,
        body: `${customerName} placed an order of ${currency} ${total}`
      },

      data: {
        order_id: String(order.id || ""),
        type: "new_order"
      }
    });

    console.log(`Notification sent for Order #${orderNumber}`);

    return res.status(200).json({
      success: true
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message
    });
  }
});

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.get("/", (req, res) => {
  res.send("WooPulse server is running");
});

app.post("/send-test", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    await admin.messaging().send({
      token,
      notification: {
        title: "WooPulse Render Test",
        body: "Notification sent from Render server!",
      },
      data: {
        source: "render_test",
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("FCM error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`WooPulse server running on port ${PORT}`);
});