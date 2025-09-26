const { db } = require("../utils/db");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");


// 1. GET endpoint to retrieve smoke actions for a specific building
 const getSmokeActions = async (req, res) => {
  const { buildingName } = req.params;
  
  try {
    const collectionName = buildingName === "areej5"
      ? `${buildingName}BuildingDB`
      : buildingName ;
    const smokeRef = db.collection(collectionName).doc("smokeActions");
    const smokeSnapshot = await smokeRef.get();
    
    if (!smokeSnapshot.exists) {
      return res.status(404).json({ 
        message: `Smoke actions not found for building ${buildingName}.`, 
        status: false 
      });
    }
    
    res.status(200).json({ 
      message: "Smoke actions retrieved successfully.", 
      smokeActions: smokeSnapshot.data(), 
      status: true 
    });
  } catch (error) {
    console.error(`Error retrieving smoke actions for ${buildingName}:`, error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// 2. POST endpoint to create smoke actions for a specific building
const createSmokeActions = async (req, res) => {
  const { buildingName } = req.params;
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required.", status: false });
  }
  
  try {
    // Verify user has access
    const userRef = db.collection("UserDB");
    const userSnapshot = await userRef.where("email", "==", email).get();
    
    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found.", status: false });
    }
    
    const userData = userSnapshot.docs[0].data();
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials.", status: false });
    }
    
    if (userData.role !== "admin" && 
        (!userData.buildings || !userData.buildings.includes(buildingName))) {
      return res.status(403).json({ message: "Unauthorized to update this building.", status: false });
    }
    collectionName = buildingName === "areej5"
      ? `${buildingName}BuildingDB`
      : buildingName ;
    const smokeRef = db.collection(collectionName).doc("smokeActions");
    const smokeSnapshot = await smokeRef.get();
    
    // If smokeActions already exists, return an error
    if (smokeSnapshot.exists) {
      return res.status(400).json({ 
        message: `Smoke actions already exist for building ${buildingName}.`, 
        status: false 
      });
    }
    
    // Create default smoke actions
    await smokeRef.set({
      p550: false,
      p551: false,
      p552: false,
      p553: false
    });
    
    res.status(201).json({ 
      message: `Smoke actions created successfully for building ${buildingName}.`, 
      status: true 
    });
  } catch (error) {
    console.error(`Error creating smoke actions for ${buildingName}:`, error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// PUT endpoint to update smoke actions for a specific building
 const updateSmokeAction = async (req, res) => {
  const { buildingName } = req.params;
  const { email, password, smokePoint, value } = req.body;
  
  if (!email || !password || !smokePoint) {
    return res.status(400).json({ 
      message: "Email, password, and smokePoint are required.", 
      status: false 
    });
  }
  
  // Map human-readable names to point IDs
  const humanNameToPointIdMap = {
    'SEF': 'p550',
    'SPF': 'p551',
    'LIFT': 'p552',
    'FAN': 'p553'
  };
  
  // Map point IDs to human-readable names
  const pointIdToHumanNameMap = {
    'p550': 'SEF',
    'p551': 'SPF',
    'p552': 'LIFT',
    'p553': 'FAN'
  };
  
  // Normalize the smokePoint - convert human names to point IDs if needed
  let normalizedSmokePoint = smokePoint;
  let isHumanNameFormat = false;
  
  // Check if the input is a human-readable name
  if (humanNameToPointIdMap[smokePoint]) {
    normalizedSmokePoint = humanNameToPointIdMap[smokePoint];
    isHumanNameFormat = true;
  }
  
  // Validate smokePoint is one of the allowed values (after normalization)
  if (!['p550', 'p551', 'p552', 'p553'].includes(normalizedSmokePoint)) {
    return res.status(400).json({ 
      message: "Invalid smokePoint. Must be one of: p550, p551, p552, p553, SEF, SPF, LIFT, FAN", 
      status: false 
    });
  }
  
  try {
    // Verify user has access
    const userRef = db.collection("UserDB");
    const userSnapshot = await userRef.where("email", "==", email).get();
    
    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found.", status: false });
    }
    
    const userData = userSnapshot.docs[0].data();
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials.", status: false });
    }
    
    if (userData.role !== "admin" && 
        (!userData.buildings || !userData.buildings.includes(buildingName))) {
      return res.status(403).json({ message: "Unauthorized to update this building.", status: false });
    }
    collectionName = buildingName === "areej5"
      ? `${buildingName}BuildingDB`
      : buildingName ;
    const smokeRef = db.collection(collectionName).doc("smokeActions");
    const smokeSnapshot = await smokeRef.get();
    
    // Determine the format used by this building by checking existing data
    let buildingUsesHumanNames = false;
    
    if (smokeSnapshot.exists) {
      const existingData = smokeSnapshot.data();
      const hasHumanNames = Object.keys(existingData).some(key => ['SEF', 'SPF', 'LIFT', 'FAN'].includes(key));
      const hasPointIds = Object.keys(existingData).some(key => key.startsWith('p'));
      
      if (hasHumanNames && !hasPointIds) {
        buildingUsesHumanNames = true;
      }
    } else {
      // For new buildings, use the format based on the input
      buildingUsesHumanNames = isHumanNameFormat;
    }
    
    // Determine which key to use for storage
    const storageKey = buildingUsesHumanNames ? pointIdToHumanNameMap[normalizedSmokePoint] : normalizedSmokePoint;
    
    // If smokeActions doesn't exist, create it
    if (!smokeSnapshot.exists) {
      let defaultSmokeActions;
      
      if (buildingUsesHumanNames) {
        defaultSmokeActions = {
          SEF: false,
          SPF: false,
          LIFT: false,
          FAN: false
        };
      } else {
        defaultSmokeActions = {
          p550: false,
          p551: false,
          p552: false,
          p553: false
        };
      }
      
      // Set the requested smoke point to the specified value or toggle it
      if (value !== undefined) {
        defaultSmokeActions[storageKey] = Boolean(value);
      } else {
        defaultSmokeActions[storageKey] = true; // Default to true if creating new
      }
      
      await smokeRef.set(defaultSmokeActions);
      
      return res.status(201).json({ 
        message: `Smoke actions created and ${storageKey} updated successfully.`, 
        status: true 
      });
    }
    
    // Get current smoke actions
    const currentSmokeActions = smokeSnapshot.data();
    
    // Toggle the value if no specific value is provided
    const newValue = value !== undefined ? Boolean(value) : !currentSmokeActions[storageKey];
    
    // Update the specific smoke point
    await smokeRef.update({
      [storageKey]: newValue
    });
    
    res.status(200).json({ 
      message: `Smoke point ${storageKey} updated successfully to ${newValue}.`, 
      status: true 
    });
  } catch (error) {
    console.error(`Error updating smoke actions for ${buildingName}:`, error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};
// 4. Additional endpoint to toggle all smoke points at once
 const updateAllSmokeActions = async (req, res) => {
  const { buildingName } = req.params;
  const { email, password, value } = req.body;
  
  if (!email || !password || value === undefined) {
    return res.status(400).json({ 
      message: "Email, password, and value are required.", 
      status: false 
    });
  }
  
  try {
    // Verify user has access
    const userRef = db.collection("UserDB");
    const userSnapshot = await userRef.where("email", "==", email).get();
    
    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found.", status: false });
    }
    
    const userData = userSnapshot.docs[0].data();
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials.", status: false });
    }
    
    if (userData.role !== "admin" && 
        (!userData.buildings || !userData.buildings.includes(buildingName))) {
      return res.status(403).json({ message: "Unauthorized to update this building.", status: false });
    }
    collectionName = buildingName === "areej5"
      ? `${buildingName}BuildingDB`
      : buildingName ;
    const smokeRef = db.collection(collectionName).doc("smokeActions");
    const smokeSnapshot = await smokeRef.get();
    
    // Convert value to boolean
    const boolValue = Boolean(value);
    
    // If smokeActions doesn't exist, create it
    if (!smokeSnapshot.exists) {
      await smokeRef.set({
        p550: boolValue,
        p551: boolValue,
        p552: boolValue,
        p553: boolValue
      });
      
      return res.status(201).json({ 
        message: `Smoke actions created with all points set to ${boolValue}.`, 
        status: true 
      });
    }
    
    // Update all smoke points
    await smokeRef.update({
      p550: boolValue,
      p551: boolValue,
      p552: boolValue,
      p553: boolValue
    });
    
    res.status(200).json({ 
      message: `All smoke points updated successfully to ${boolValue}.`, 
      status: true 
    });
  } catch (error) {
    console.error(`Error updating all smoke actions for ${buildingName}:`, error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

module.exports = {
  getSmokeActions,
  createSmokeActions,
  updateSmokeAction,
  updateAllSmokeActions
};


