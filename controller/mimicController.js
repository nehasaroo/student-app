const { db } = require("../utils/db");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");


/* ======================
      MIMIC & MIMICMAP
====================== */

// Add a device
exports.addDevice = async (req, res) => {
  const { buildingName } = req.params;
  const { deviceName } = req.body;

  if (!deviceName) return res.status(400).json({ message: "Device name is required.", status: false });

  try {
    const collectionName = buildingName === "areej5" ? buildingName : `${buildingName}BuildingDB`;
    const mimicRef = db.collection(collectionName).doc("mimic");
    const mimicMapRef = db.collection(collectionName).doc("mimicMap");

    const mimicSnapshot = await mimicRef.get();
    const mimicMapSnapshot = await mimicMapRef.get();

    // Generate a unique pseudo
    let pseudo = Math.floor(Math.random() * 1000000).toString();
    const mimicData = mimicSnapshot.exists ? mimicSnapshot.data() : {};

    while (mimicData[pseudo] !== undefined) pseudo = Math.floor(Math.random() * 1000000).toString();

    // Update mimic
    if (!mimicSnapshot.exists) await mimicRef.set({ [pseudo]: "1" });
    else await mimicRef.update({ [pseudo]: "1" });

    // Update mimicMap
    if (!mimicMapSnapshot.exists) {
      await mimicMapRef.set({ mimicDetails: [{ name: deviceName, pseudo }] });
    } else {
      const mimicMapData = mimicMapSnapshot.data();
      if (Array.isArray(mimicMapData.mimicDetails)) {
        await mimicMapRef.update({
          mimicDetails: admin.firestore.FieldValue.arrayUnion({ name: deviceName, pseudo }),
        });
      } else if (typeof mimicMapData.mimicDetails === "object") {
        const nextKey = Object.keys(mimicMapData.mimicDetails).length.toString();
        await mimicMapRef.update({ [`mimicDetails.${nextKey}`]: { name: deviceName, pseudo } });
      } else {
        await mimicMapRef.update({ mimicDetails: [{ name: deviceName, pseudo }] });
      }
    }

    res.status(201).json({ message: "Device added successfully.", pseudo, status: true });
  } catch (error) {
    console.error("Error adding device:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Update device status
exports.updateDeviceStatus = async (req, res) => {
  const { buildingName } = req.params;
  const { pseudo, status } = req.body;

  if (!pseudo || !status) return res.status(400).json({ message: "Pseudo and status are required.", status: false });

  try {
    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName;
    const mimicRef = db.collection(collectionName).doc("mimic");
    await mimicRef.update({ [pseudo]: status });
    res.status(200).json({ message: "Device status updated successfully.", status: true });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Update device name
exports.updateDeviceName = async (req, res) => {
  const { buildingName } = req.params;
  const { pseudo, newName } = req.body;

  if (!pseudo || !newName) return res.status(400).json({ message: "Pseudo and new name are required.", status: false });

  try {
    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName;
    const mimicMapRef = db.collection(collectionName).doc("mimicMap");
    const mimicMapSnapshot = await mimicMapRef.get();

    if (!mimicMapSnapshot.exists) return res.status(404).json({ message: "MimicMap not found.", status: false });

    const mimicDetails = mimicMapSnapshot.data().mimicDetails || [];
    const updatedDetails = mimicDetails.map((device) =>
      device.pseudo === pseudo ? { ...device, name: newName } : device
    );

    await mimicMapRef.update({ mimicDetails: updatedDetails });
    res.status(200).json({ message: "Device name updated successfully.", status: true });
  } catch (error) {
    console.error("Error updating device name:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Get mimic for a building
exports.getMimic = async (req, res) => {
  const { buildingName } = req.params;
  try {
    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName;
    const mimicRef = db.collection(collectionName).doc("mimic");
    const mimicMapRef = db.collection(collectionName).doc("mimicMap");
    const [mimicSnapshot, mimicMapSnapshot] = await Promise.all([mimicRef.get(), mimicMapRef.get()]);

    if (!mimicSnapshot.exists || !mimicMapSnapshot.exists)
      return res.status(404).json({ message: "Mimic or MimicMap not found.", status: false });

    res.status(200).json({
      message: "Mimic and MimicMap retrieved successfully.",
      mimic: mimicSnapshot.data(),
      mimicMap: mimicMapSnapshot.data(),
      status: true,
    });
  } catch (error) {
    console.error("Error retrieving mimic:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Delete a device
exports.deleteDevice = async (req, res) => {
  const { buildingName } = req.params;
  const { pseudo } = req.body;
  if (!pseudo) return res.status(400).json({ message: "Pseudo is required.", status: false });

  try {
    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName;
    const mimicRef = db.collection(collectionName).doc("mimic");
    const mimicMapRef = db.collection(collectionName).doc("mimicMap");

    await mimicRef.update({ [pseudo]: admin.firestore.FieldValue.delete() });

    const mimicMapSnapshot = await mimicMapRef.get();
    if (mimicMapSnapshot.exists) {
      const mimicDetails = mimicMapSnapshot.data().mimicDetails || [];
      const updatedDetails = mimicDetails.filter((device) => device.pseudo !== pseudo);
      await mimicMapRef.update({ mimicDetails: updatedDetails });
    }

    res.status(200).json({ message: "Device deleted successfully.", status: true });
  } catch (error) {
    console.error("Error deleting device:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

/* ======================
          ACTIONS
====================== */

// Get actions for a building
exports.getActions = async (req, res) => {
  const { buildingName } = req.params;
  try {
    const actionsRef = db.collection(buildingName).doc("actions");
    const actionsSnapshot = await actionsRef.get();

    if (!actionsSnapshot.exists)
      return res.status(404).json({ message: "Actions document not found.", status: false });

    res.status(200).json({ message: "Actions retrieved successfully.", actions: actionsSnapshot.data(), status: true });
  } catch (error) {
    console.error("Error retrieving actions:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Update actions for a building
exports.updateActions = async (req, res) => {
  const { buildingName } = req.params;
  const { actions } = req.body;
  if (!actions) return res.status(400).json({ message: "Actions are required.", status: false });

  try {
    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName;
    const actionsRef = db.collection(collectionName).doc("actions");
    await actionsRef.update(actions);
    res.status(200).json({ message: "Actions updated successfully.", status: true });
  } catch (error) {
    console.error("Error updating actions:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Patch actions fields
exports.patchActions = async (req, res) => {
  const { buildingName } = req.params;
  const updates = req.body;

  try {
    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName;
    const actionsRef = db.collection(collectionName).doc("actions");
    await actionsRef.update(updates);
    res.status(200).json({ message: "Actions updated successfully.", status: true });
  } catch (error) {
    console.error("Error updating actions:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};
