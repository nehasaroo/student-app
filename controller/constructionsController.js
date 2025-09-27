const { db } = require("../utils/db");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");



// ------------------------- MAIN CONSTRUCTION STATUS -------------------------

// Create / Update Construction Status
exports.updateConstructionStatus = async (req, res) => {
  const { 
    buildingName, totalAssets, dcdDrawingsReady, fieldClearance, containmentReady, cablingReady,
    deviceInstalled, consultantMaterialApproval, consultantCablingApproval,
    consultantFinalInspectionApproval, consultantInstallationApproval, dcdApprovalStatus
  } = req.body;

  if (!buildingName) return res.status(400).json({ message: "Building name is required.", status: false });

  const statusFields = [
    dcdDrawingsReady, fieldClearance, containmentReady, cablingReady,
    deviceInstalled, consultantMaterialApproval, consultantCablingApproval,
    consultantFinalInspectionApproval, consultantInstallationApproval, dcdApprovalStatus
  ];
  const validStatuses = [-1, 0, 1];

  for (let status of statusFields) {
    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Status values must be -1 (Yet to Start), 0 (Ongoing), or 1 (Completed)",
        status: false
      });
    }
  }

  try {
    const constructionData = {
      buildingName,
      totalAssets: totalAssets || 0,
      constructionStatus: {
        dcdDrawingsReady: dcdDrawingsReady ?? -1,
        fieldClearance: fieldClearance ?? -1,
        containmentReady: containmentReady ?? -1,
        cablingReady: cablingReady ?? -1,
        deviceInstalled: deviceInstalled ?? -1,
        consultantMaterialApproval: consultantMaterialApproval ?? -1,
        consultantCablingApproval: consultantCablingApproval ?? -1,
        consultantFinalInspectionApproval: consultantFinalInspectionApproval ?? -1,
        consultantInstallationApproval: consultantInstallationApproval ?? -1,
        dcdApprovalStatus: dcdApprovalStatus ?? -1
      },
      lastUpdated: new Date(),
      updatedBy: req.body.updatedBy || 'system'
    };

    // Calculate overall progress
    const statusValues = Object.values(constructionData.constructionStatus);
    const completedCount = statusValues.filter(status => status === 1).length;
    const ongoingCount = statusValues.filter(status => status === 0).length;
    const yetToStartCount = statusValues.filter(status => status === -1).length;

    constructionData.overallProgress = {
      completed: completedCount,
      ongoing: ongoingCount,
      yetToStart: yetToStartCount,
      totalSteps: statusValues.length,
      completionPercentage: Math.round((completedCount / statusValues.length) * 100)
    };

    await db.collection('constructionDetails').doc(buildingName).set(constructionData, { merge: true });

    res.status(200).json({
      message: `Construction status updated successfully for building: ${buildingName}`,
      constructionData,
      status: true
    });
  } catch (error) {
    console.error("Error updating construction status:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
  }
};

// Get Construction Status (GET)
exports.getConstructionStatus = async (req, res) => {
  const { buildingName } = req.params;
  if (!buildingName) return res.status(400).json({ message: "Building name is required.", status: false });

  try {
    const doc = await db.collection('constructionDetails').doc(buildingName).get();
    if (!doc.exists) return res.status(404).json({ message: "No construction data found", status: false });

    res.status(200).json({ message: "Success", constructionData: doc.data(), status: true });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
  }
};

// Get Construction Status (POST alternative)
exports.getConstructionStatusPost = async (req, res) => {
  const { buildingName } = req.body;
  if (!buildingName) return res.status(400).json({ message: "Building name is required.", status: false });

  try {
    const doc = await db.collection('constructionDetails').doc(buildingName).get();
    if (!doc.exists) {
      return res.status(200).json({
        message: "Default structure",
        constructionData: { buildingName, overallProgress: { completionPercentage: 0 } },
        isDefault: true,
        status: true
      });
    }
    res.status(200).json({ message: "Success", constructionData: doc.data(), isDefault: false, status: true });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
  }
};

// Get All Buildings
exports.getAllConstructions = async (req, res) => {
  try {
    const snapshot = await db.collection("constructionDetails").get();
    const buildings = [];
    snapshot.forEach(doc => buildings.push({ buildingName: doc.id, ...doc.data() }));

    buildings.sort((a, b) => (b.overallProgress?.completionPercentage || 0) - (a.overallProgress?.completionPercentage || 0));

    res.status(200).json({ message: "Success", buildings, status: true });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
  }
};

// Update Specific Step
exports.updateStep = async (req, res) => {
  const { buildingName, stepName, stepValue, updatedBy } = req.body;
  if (!buildingName || !stepName || stepValue === undefined) return res.status(400).json({ message: "Required fields missing", status: false });

  const validSteps = [
    'dcdDrawingsReady','fieldClearance','containmentReady','cablingReady','deviceInstalled',
    'consultantMaterialApproval','consultantCablingApproval','consultantFinalInspectionApproval',
    'consultantInstallationApproval','dcdApprovalStatus'
  ];
  if (!validSteps.includes(stepName)) return res.status(400).json({ message: "Invalid step name", status: false });
  if (![-1,0,1].includes(stepValue)) return res.status(400).json({ message: "Invalid step value", status: false });

  try {
    const ref = db.collection("constructionDetails").doc(buildingName);
    const doc = await ref.get();
    let data = doc.exists ? doc.data() : { buildingName, constructionStatus: {} };

    data.constructionStatus[stepName] = stepValue;
    data.lastUpdated = new Date();
    data.updatedBy = updatedBy || "system";

    const statusValues = Object.values(data.constructionStatus);
    const completed = statusValues.filter(s => s === 1).length;
    data.overallProgress = {
      completed,
      ongoing: statusValues.filter(s => s === 0).length,
      yetToStart: statusValues.filter(s => s === -1).length,
      totalSteps: statusValues.length,
      completionPercentage: Math.round((completed / statusValues.length) * 100)
    };

    await ref.set(data, { merge: true });
    res.status(200).json({ message: "Step updated", constructionData: data, status: true });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
  }
};

// Delete Construction
exports.deleteConstruction = async (req, res) => {
  const { buildingName } = req.params;
  try {
    await db.collection("constructionDetails").doc(buildingName).delete();
    res.status(200).json({ message: "Deleted successfully", buildingName, status: true });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
  }
};

// ------------------------- SUBCATEGORY CONSTRUCTION STATUS -------------------------

// Create / Update Subcategory Construction Status
exports.updateSubcategoryStatus = async (req, res) => {
  const {
    buildingName, subcategoryName, categoryKey, totalAssets,
    dcdDrawingsReady, fieldClearance, containmentReady, cablingReady, deviceInstalled,
    consultantMaterialApproval, consultantCablingApproval,
    consultantFinalInspectionApproval, consultantInstallationApproval, dcdApprovalStatus
  } = req.body;

  if (!buildingName || !subcategoryName || !categoryKey) {
    return res.status(400).json({ message: "Building name, subcategory name, and category key are required.", status: false });
  }

  const statusFields = [
    dcdDrawingsReady, fieldClearance, containmentReady, cablingReady, deviceInstalled,
    consultantMaterialApproval, consultantCablingApproval,
    consultantFinalInspectionApproval, consultantInstallationApproval, dcdApprovalStatus
  ];
  const validStatuses = [-1, 0, 1];
  for (const status of statusFields) {
    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Status values must be -1, 0, or 1", status: false });
    }
  }

  try {
    const data = {
      buildingName, subcategoryName, categoryKey, totalAssets: totalAssets || 0,
      constructionStatus: {
        dcdDrawingsReady: dcdDrawingsReady ?? -1,
        fieldClearance: fieldClearance ?? -1,
        containmentReady: containmentReady ?? -1,
        cablingReady: cablingReady ?? -1,
        deviceInstalled: deviceInstalled ?? -1,
        consultantMaterialApproval: consultantMaterialApproval ?? -1,
        consultantCablingApproval: consultantCablingApproval ?? -1,
        consultantFinalInspectionApproval: consultantFinalInspectionApproval ?? -1,
        consultantInstallationApproval: consultantInstallationApproval ?? -1,
        dcdApprovalStatus: dcdApprovalStatus ?? -1
      },
      lastUpdated: new Date(),
      updatedBy: req.body.updatedBy || "system"
    };

    // Calculate progress
    const statusValues = Object.values(data.constructionStatus);
    const completedCount = statusValues.filter(s => s === 1).length;
    const ongoingCount = statusValues.filter(s => s === 0).length;
    const yetToStartCount = statusValues.filter(s => s === -1).length;

    data.overallProgress = {
      completed: completedCount,
      ongoing: ongoingCount,
      yetToStart: yetToStartCount,
      totalSteps: statusValues.length,
      completionPercentage: Math.round((completedCount / statusValues.length) * 100)
    };

    const ref = db.collection("subcategoryConstruction").doc(buildingName)
                  .collection("subcategories").doc(`${categoryKey}_${subcategoryName}`);

    await ref.set(data, { merge: true });

    res.status(200).json({ message: "Subcategory updated", constructionData: data, status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
  }
};

// Get Subcategory Status
exports.getSubcategoryStatus = async (req, res) => {
  const { buildingName, categoryKey, subcategoryName } = req.params;
  if (!buildingName || !categoryKey || !subcategoryName) return res.status(400).json({ message: "Required params missing", status: false });

  try {
    const doc = await db.collection("subcategoryConstruction").doc(buildingName)
                  .collection("subcategories").doc(`${categoryKey}_${subcategoryName}`).get();
    if (!doc.exists) return res.status(200).json({ message: "Default structure", isDefault: true, status: true });

    res.status(200).json({ message: "Success", constructionData: doc.data(), isDefault: false, status: true });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
  }
};

// Get All Subcategories for a Building
exports.getAllSubcategories = async (req, res) => {
  const { buildingName } = req.params;
  if (!buildingName) return res.status(400).json({ message: "Building name is required", status: false });

  try {
    const snapshot = await db.collection("subcategoryConstruction").doc(buildingName)
                          .collection("subcategories").get();

    const subcategories = [];
    snapshot.forEach(doc => subcategories.push({ id: doc.id, ...doc.data() }));
    subcategories.sort((a,b) => (b.overallProgress?.completionPercentage || 0) - (a.overallProgress?.completionPercentage || 0));

    res.status(200).json({ message: "Success", subcategories, totalSubcategories: subcategories.length, status: true });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
  }
};
