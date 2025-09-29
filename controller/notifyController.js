const { db } = require("../utils/db");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");


// Assign notifications
exports.assignNotif = async (req, res) => {
  try {
    const {
      email,
      communities = [],
      buildings = [],
      notificationMethods = [],
      updatedBy = "system"
    } = req.body || {};

    // Validations
    if (!email) {
      return res.status(400).json({
        status: false,
        message: "Email is required.",
      });
    }
    if (!Array.isArray(communities) || !Array.isArray(buildings)) {
      return res.status(400).json({
        status: false,
        message: "Communities and buildings must be arrays.",
      });
    }

    // Save into Firestore
    await db.collection("notifications").add({
      email,
      communities,
      buildings,
      notificationMethods,
      updatedBy,
      timestamp: new Date(),
    });

    return res.status(200).json({
      status: true,
      message: "Notification configuration saved successfully.",
    });
  } catch (error) {
    console.error("Error saving notification config:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to save configuration.",
      error: error.message,
    });
  }
};

// Get all notification configs
exports.getNotifConfigs = async (req, res) => {
  try {
    const snapshot = await db.collection("notifications").get();
    const configs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json({
      status: true,
      data: configs,
    });
  } catch (error) {
    console.error("Error fetching configs:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch notification configs.",
      error: error.message,
    });
  }
};
