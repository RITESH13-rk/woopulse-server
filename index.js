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