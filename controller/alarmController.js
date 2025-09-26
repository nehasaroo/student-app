const { db } = require("../utils/db");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");

// List all alarm messages
exports.listMessages = async (req, res) => {
  try {
    let buildingNames = [];
    if (req.query.buildings) {
      buildingNames = req.query.buildings.split(",");
    } else {
      const collections = await db.listCollections();
      buildingNames = collections
        .map((col) => col.id.replace(/BuildingDB$/, ""))
        .filter((name) => name !== "");
    }

    const messagesPromises = buildingNames.map(async (buildingName) => {
      try {
        const collectionName = `${buildingName}BuildingDB`;
        const messagesRef = db.collection(collectionName).doc("alarmMessage");
        const messagesSnapshot = await messagesRef.get();

        return {
          buildingName,
          messages: messagesSnapshot.exists
            ? messagesSnapshot.data().alarmMessage
            : [],
          status: messagesSnapshot.exists,
        };
      } catch (error) {
        console.error(`Error fetching messages for ${buildingName}:`, error);
        return null;
      }
    });

    const messagesResults = await Promise.all(messagesPromises);
    const validResults = messagesResults
      .filter((result) => result !== null && result.status)
      .map(({ buildingName, messages }) => ({ buildingName, messages }));

    res.status(200).json({
      message: "Alarm messages retrieved successfully.",
      data: validResults,
      status: true,
    });
  } catch (error) {
    console.error("Error retrieving alarm messages:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Get alarm messages for a specific building
exports.getAlarmMessages = async (req, res) => {
  const { buildingName } = req.params;

  try {
    const messagesRef = db.collection(buildingName).doc("alarmMessage");
    const messagesSnapshot = await messagesRef.get();

    if (!messagesSnapshot.exists) {
      return res
        .status(404)
        .json({ message: "Alarm messages document not found.", status: false });
    }

    res.status(200).json({
      message: "Alarm messages retrieved successfully.",
      alarmMessages: messagesSnapshot.data(),
      status: true,
    });
  } catch (error) {
    console.error("Error retrieving alarm messages:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Add alarm message
exports.addAlarmMessage = async (req, res) => {
  const { buildingName } = req.params;
  const { email, password, message } = req.body;

  if (!email || !password || !message) {
    return res
      .status(400)
      .json({ message: "All fields are required.", status: false });
  }

  try {
    const userRef = db.collection("UserDB");
    const userSnapshot = await userRef.where("email", "==", email).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found.", status: false });
    }

    const userData = userSnapshot.docs[0].data();
    const isPasswordValid = password === userData.password;


    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: "Invalid credentials.", status: false });
    }

    if (
      userData.role !== "admin" &&
      (!userData.buildings || !userData.buildings.includes(buildingName))
    ) {
      return res
        .status(403)
        .json({ message: "Unauthorized to update this building.", status: false });
    }

    const messagesRef = db.collection(`${buildingName}`).doc("alarmMessage");
    const messagesSnapshot = await messagesRef.get();

    if (!messagesSnapshot.exists) {
      return res
        .status(404)
        .json({ message: "Alarm messages document not found.", status: false });
    }

    const newMessage = {
      message: message,
      time: Date.now(),
    };

    await messagesRef.update({
      messages: admin.firestore.FieldValue.arrayUnion(newMessage),
    });

    res
      .status(200)
      .json({ message: "Alarm message added successfully.", status: true });
  } catch (error) {
    console.error("Error adding alarm message:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Delete alarm message
exports.deleteAlarmMessage = async (req, res) => {
  const { buildingName, messageTime } = req.params;
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required.", status: false });
  }

  try {
    const userRef = db.collection("UserDB");
    const userSnapshot = await userRef.where("email", "==", email).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found.", status: false });
    }

    const userData = userSnapshot.docs[0].data();
    const isPasswordValid = password === userData.password;

    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: "Invalid credentials.", status: false });
    }

    if (
      userData.role !== "admin" &&
      (!userData.buildings || !userData.buildings.includes(buildingName))
    ) {
      return res
        .status(403)
        .json({ message: "Unauthorized to update this building.", status: false });
    }

    const messagesRef = db.collection(`${buildingName}BuildingDB`).doc("alarmMessage");
    const messagesSnapshot = await messagesRef.get();

    if (!messagesSnapshot.exists) {
      return res
        .status(404)
        .json({ message: "Alarm messages document not found.", status: false });
    }

    const messagesData = messagesSnapshot.data();
    const updatedMessages = messagesData.messages.filter(
      (msg) => msg.time !== parseInt(messageTime)
    );

    await messagesRef.update({
      messages: updatedMessages,
    });

    res
      .status(200)
      .json({ message: "Alarm message deleted successfully.", status: true });
  } catch (error) {
    console.error("Error deleting alarm message:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};
