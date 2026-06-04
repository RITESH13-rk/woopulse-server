const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const deviceTokens = {};

app.get("/", (req, res) => {
  res.send("WooPulse server is running");
});

app.post("/register-device", (req, res) => {
  const { storeKey, token } = req.body;

  if (!storeKey || !token) {
    return res.status(400).json({
      error: "Missing storeKey or token",
    });
  }

  deviceTokens[storeKey] = token;

  console.log("Device registered for store:", storeKey);

  return res.json({
    success: true,
    message: "Device token registered successfully",
  });
});

app.post("/webhook/woocommerce", async (req, res) => {
  try {
    console.log("WooCommerce webhook received");

    const storeKey = req.query.storeKey;

    if (!storeKey) {
      return res.status(400).json({
        error: "Missing storeKey",
      });
    }

    const deviceToken = deviceTokens[storeKey];

    if (!deviceToken) {
      console.log("No device token found for store:", storeKey);

      return res.status(200).json({
        success: false,
        message: "No device registered for this store",
      });
    }

    const order = req.body;
    const orderNumber = order.number || order.id;

    const customerName =
      `${order.billing?.first_name || ""} ${order.billing?.last_name || ""}`.trim() ||
      "Customer";

    const currency = order.currency || "INR";
    const total = order.total || "0";
    const status = order.status || "updated";

    const webhookTopic =
      req.headers["x-wc-webhook-topic"] || "";

    /*
     * Ignore automatic Pending -> Processing
     * updates right after order creation.
     */
    if (webhookTopic.includes("updated")) {

      const createdTime =
        new Date(order.date_created).getTime();

      const modifiedTime =
        new Date(order.date_modified).getTime();

      const minutesSinceCreation =
        (modifiedTime - createdTime) / (1000 * 60);

      if (
        status === "processing" &&
        minutesSinceCreation < 5
      ) {
        console.log(
          `Ignored auto-processing update for Order #${orderNumber}`
        );

        return res.status(200).json({
          success: true,
          ignored: true,
          reason: "Auto-processing update ignored",
        });
      }
    }

    let title = "";
    let body = "";
    let notificationType = "";

    if (webhookTopic.includes("updated")) {

      title =
        `📦 WooPulse Order Update #${orderNumber}`;

      body =
        `Order status changed to ${status.toUpperCase()}`;

      notificationType = "status_update";

    } else {

      title =
        `🛒 New Order #${orderNumber}`;

      body =
        `${customerName} placed an order of ${currency} ${total}`;

      notificationType = "new_order";
    }

    await admin.messaging().send({
      token: deviceToken,

      data: {
        title,
        body,
        order_id: String(order.id || ""),
        order_number: String(orderNumber || ""),
        status: String(status || ""),
        type: notificationType,
      },

      android: {
        priority: "high",
      },
    });

    console.log(
      `Notification sent: ${notificationType} for Order #${orderNumber}`
    );

    return res.status(200).json({
      success: true,
      type: notificationType,
    });

  } catch (error) {

    console.error("Webhook error:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/send-test", async (req, res) => {
  try {

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: "Missing token",
      });
    }

    await admin.messaging().send({
      token,

      data: {
        title: "WooPulse Render Test",
        body: "Notification sent from Render server!",
        source: "render_test",
        type: "test",
      },

      android: {
        priority: "high",
      },
    });

    return res.json({
      success: true,
    });

  } catch (error) {

    console.error("FCM error:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`WooPulse server running on port ${PORT}`);
});