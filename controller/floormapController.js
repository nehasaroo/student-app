const { db } = require("../utils/db");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");


// POST /buildings/:buildingName/floor-maps
exports.saveOrUpdateFloorMap = async (req, res) => {
  try {
    const { buildingName } = req.params;
    const { floorPlanName, assetMappings } = req.body;
    const imageFile = req.file;

    
    if (!buildingName) {
      return res.status(400).json({
        message: "Building name is required in URL parameters.",
        status: false,
      });
    }

    if (!floorPlanName) {
      return res.status(400).json({
        message: "Floor plan name is required.",
        status: false,
      });
    }

    if (!imageFile) {
      return res.status(400).json({
        message: "Floor plan image is required.",
        status: false,
      });
    }

    // Parse assetMappings if it's a string (from form-data)
    let parsedAssetMappings;
    try {
      parsedAssetMappings = typeof assetMappings === "string" ? JSON.parse(assetMappings) : assetMappings;
    } catch (parseError) {
      return res.status(400).json({
        message: "Invalid asset mappings format. Must be valid JSON.",
        status: false,
      });
    }

    if (!parsedAssetMappings || !Array.isArray(parsedAssetMappings)) {
      return res.status(400).json({
        message: "Asset mappings are required and must be an array.",
        status: false,
      });
    }

    // Validate each asset mapping has required fields
    for (const mapping of parsedAssetMappings) {
      if (!mapping.assetName || !mapping.category || typeof mapping.x !== "number" || typeof mapping.y !== "number") {
        return res.status(400).json({
          message: "Each asset mapping must include assetName, category, x, and y coordinates.",
          status: false,
        });
      }
    }

    // --- Logic ---

    // Generate unique filename for the image
    const timestamp = Date.now();
    const fileExtension = path.extname(imageFile.originalname);
    const fileName = `floor-plans/${buildingName}/${floorPlanName}-${timestamp}${fileExtension}`;

    // Upload image to GCP bucket
    const imageUrl = await uploadImageToBucket(imageFile, fileName);

    // Create a reference to the floor map document
    const floorMapRef = db.collection("FloorMaps").doc(buildingName).collection("floors").doc(floorPlanName);

    // Check if floor plan already exists (Update or Create logic)
    const floorMapDoc = await floorMapRef.get();

    if (floorMapDoc.exists) {
      // Logic for UPDATING existing map (deleting old image and mappings)
      const oldData = floorMapDoc.data();
      const oldImageUrl = oldData.imageUrl;

      await floorMapRef.update({ imageUrl: imageUrl });

      const mappingsCollectionRef = floorMapRef.collection("assetMappings");
      const existingMappings = await mappingsCollectionRef.get();

      // Batch delete existing mappings
      const deleteBatch = db.batch();
      existingMappings.docs.forEach((doc) => {
        deleteBatch.delete(doc.ref);
      });
      await deleteBatch.commit();

      // Optionally delete the old image from bucket
      if (oldImageUrl && oldImageUrl.includes("storage.googleapis.com") && bucket) {
        try {
          // Assuming 'bucket' is available globally or imported
          const oldFileName = oldImageUrl.split("/").slice(-3).join("/");
          const oldFile = bucket.file(oldFileName);
          await oldFile.delete();
        } catch (deleteError) {
          console.warn("Could not delete old image:", deleteError.message);
        }
      }
    } else {
      // Logic for CREATING new floor plan
      await floorMapRef.set({
        floorPlanName,
        buildingName,
        imageUrl,
      });
    }

    // Add all asset mappings as subcollection documents
    const mappingsCollectionRef = floorMapRef.collection("assetMappings");
    const addBatch = db.batch();

    parsedAssetMappings.forEach((mapping) => {
      const mappingRef = mappingsCollectionRef.doc();
      addBatch.set(mappingRef, {
        assetName: mapping.assetName,
        category: mapping.category,
        x: mapping.x,
        y: mapping.y,
        active: mapping.active || 0,
      });
    });

    await addBatch.commit();

    res.status(200).json({
      message: "Floor plan and asset mappings saved successfully",
      buildingName,
      floorPlanName,
      imageUrl,
      status: true,
    });
  } catch (error) {
    console.error("Error saving floor map:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    });
  }
};

// PATCH /buildings/:buildingName/floor-maps/:floorPlanName (Update Image and/or Assets)
exports.updateFloorMapAndAssets = async (req, res) => {
  try {
    const { buildingName, floorPlanName } = req.params;
    const { assetMappings } = req.body;
    const imageFile = req.file;

    if (!buildingName || !floorPlanName) {
      return res.status(400).json({
        message: "Building name and floor plan name are required in URL parameters.",
        status: false,
      });
    }

    if (!imageFile && !assetMappings) {
      return res.status(400).json({
        message: "Either a new image or asset mappings must be provided for update.",
        status: false,
      });
    }

    const floorMapRef = db.collection("FloorMaps").doc(buildingName).collection("floors").doc(floorPlanName);
    const floorMapDoc = await floorMapRef.get();
    if (!floorMapDoc.exists) {
      return res.status(404).json({ message: "Floor plan not found.", status: false });
    }

    const existingData = floorMapDoc.data();
    const updateData = {};
    let parsedAssetMappings;

    // Handle image update if provided
    if (imageFile) {
      const timestamp = Date.now();
      const fileExtension = path.extname(imageFile.originalname);
      const fileName = `floor-plans/${buildingName}/${floorPlanName}-${timestamp}${fileExtension}`;

      const newImageUrl = await uploadImageToBucket(imageFile, fileName);
      updateData.imageUrl = newImageUrl;

      if (existingData.imageUrl && existingData.imageUrl.includes("storage.googleapis.com") && bucket) {
        try {
          const oldFileName = existingData.imageUrl.split("/").slice(-3).join("/");
          const oldFile = bucket.file(oldFileName);
          await oldFile.delete();
        } catch (deleteError) {
          console.warn("Could not delete old image:", deleteError.message);
        }
      }
    }

    // Handle asset mappings update if provided
    if (assetMappings) {
      try {
        parsedAssetMappings = typeof assetMappings === "string" ? JSON.parse(assetMappings) : assetMappings;
      } catch (parseError) {
        return res.status(400).json({ message: "Invalid asset mappings format. Must be valid JSON.", status: false });
      }

      if (!Array.isArray(parsedAssetMappings)) {
        return res.status(400).json({ message: "Asset mappings must be an array.", status: false });
      }

      for (const mapping of parsedAssetMappings) {
        if (!mapping.assetName || !mapping.category || typeof mapping.x !== "number" || typeof mapping.y !== "number") {
          return res.status(400).json({
            message: "Each asset mapping must include assetName, category, x, and y coordinates.",
            status: false,
          });
        }
      }

      // Delete existing asset mappings
      const mappingsCollectionRef = floorMapRef.collection("assetMappings");
      const existingMappings = await mappingsCollectionRef.get();
      const deleteBatch = db.batch();
      existingMappings.docs.forEach((doc) => {
        deleteBatch.delete(doc.ref);
      });
      await deleteBatch.commit();

      // Add updated asset mappings
      const addBatch = db.batch();
      parsedAssetMappings.forEach((mapping) => {
        const mappingRef = mappingsCollectionRef.doc();
        addBatch.set(mappingRef, {
          assetName: mapping.assetName,
          category: mapping.category,
          x: mapping.x,
          y: mapping.y,
          active: mapping.active || 0,
        });
      });
      await addBatch.commit();
    }

    // Update the floor map document (if image was updated)
    if (Object.keys(updateData).length > 0) {
        await floorMapRef.update(updateData);
    }
    

    const responseData = {
      message: "Floor plan updated successfully",
      buildingName,
      floorPlanName,
      status: true,
      ...(updateData.imageUrl && { imageUrl: updateData.imageUrl }),
      ...(parsedAssetMappings && { assetMappingsCount: parsedAssetMappings.length }),
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error updating floor map:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    });
  }
};

// PATCH /buildings/:buildingName/floor-maps/:floorPlanName/assets (Update Assets Only)
exports.updateAssetPositions = async (req, res) => {
  try {
    const { buildingName, floorPlanName } = req.params;
    const { assetMappings } = req.body;

    if (!buildingName || !floorPlanName) {
      return res.status(400).json({
        message: "Building name and floor plan name are required in URL parameters.",
        status: false,
      });
    }

    if (!assetMappings || !Array.isArray(assetMappings)) {
      return res.status(400).json({
        message: "Asset mappings are required and must be an array.",
        status: false,
      });
    }

    for (const mapping of assetMappings) {
      if (!mapping.assetName || !mapping.category || typeof mapping.x !== "number" || typeof mapping.y !== "number") {
        return res.status(400).json({
          message: "Each asset mapping must include assetName, category, x, and y coordinates.",
          status: false,
        });
      }
    }

    const floorMapRef = db.collection("FloorMaps").doc(buildingName).collection("floors").doc(floorPlanName);
    const floorMapDoc = await floorMapRef.get();
    if (!floorMapDoc.exists) {
      return res.status(404).json({ message: "Floor plan not found.", status: false });
    }

    // Delete existing asset mappings
    const mappingsCollectionRef = floorMapRef.collection("assetMappings");
    const existingMappings = await mappingsCollectionRef.get();
    const deleteBatch = db.batch();
    existingMappings.docs.forEach((doc) => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();

    // Add updated asset mappings
    const addBatch = db.batch();
    assetMappings.forEach((mapping) => {
      const mappingRef = mappingsCollectionRef.doc();
      addBatch.set(mappingRef, {
        assetName: mapping.assetName,
        category: mapping.category,
        x: mapping.x,
        y: mapping.y,
        active: mapping.active || 0,
      });
    });
    await addBatch.commit();

    res.status(200).json({
      message: "Asset mappings updated successfully",
      buildingName,
      floorPlanName,
      assetMappingsCount: assetMappings.length,
      status: true,
    });
  } catch (error) {
    console.error("Error updating asset mappings:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    });
  }
};

// DELETE /buildings/:buildingName/floor-maps/:floorPlanName
exports.deleteFloorMap = async (req, res) => {
  const { buildingName, floorPlanName } = req.params;

  try {
    const floorMapRef = db.collection("FloorMaps").doc(buildingName).collection("floors").doc(floorPlanName);
    const floorMapDoc = await floorMapRef.get();

    if (!floorMapDoc.exists) {
      return res.status(404).json({ message: "Floor plan not found", status: false });
    }

    const floorMapData = floorMapDoc.data();
    const imageUrl = floorMapData.imageUrl;

    // Delete the image from GCP bucket
    if (imageUrl && imageUrl.includes("storage.googleapis.com") && bucket) {
      try {
        const fileName = imageUrl.split("/").slice(-3).join("/");
        const file = bucket.file(fileName);
        await file.delete();
      } catch (deleteError) {
        console.warn("Could not delete image from bucket:", deleteError.message);
      }
    }

    // Delete all asset mappings
    const mappingsCollectionRef = floorMapRef.collection("assetMappings");
    const existingMappings = await mappingsCollectionRef.get();

    const batch = db.batch();
    existingMappings.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete the floor map document
    batch.delete(floorMapRef);
    await batch.commit();

    res.status(200).json({
      message: "Floor plan deleted successfully",
      buildingName,
      floorPlanName,
      status: true,
    });
  } catch (error) {
    console.error("Error deleting floor map:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    });
  }
};

// GET /buildings/:buildingName/floor-maps/:floorPlanName
exports.getSpecificFloorMap = async (req, res) => {
  const { buildingName, floorPlanName } = req.params;

  try {
    const floorMapRef = db.collection("FloorMaps").doc(buildingName).collection("floors").doc(floorPlanName);
    const floorMapDoc = await floorMapRef.get();

    if (!floorMapDoc.exists) {
      return res.status(404).json({ message: "Floor plan not found", status: false });
    }

    const floorMapData = floorMapDoc.data();
    const imageUrl = floorMapData.imageUrl;

    // Retrieve asset mappings
    const mappingsCollectionRef = floorMapRef.collection("assetMappings");
    const mappingsSnapshot = await mappingsCollectionRef.get();

    const assetMappings = [];
    mappingsSnapshot.forEach((doc) => {
      assetMappings.push({
        id: doc.id,
        ...doc.data(),
        active: doc.data().active || 0,
      });
    });

    // Group asset mappings by category and assetName
    const groupedMappings = {};
    assetMappings.forEach((mapping) => {
      if (!groupedMappings[mapping.category]) {
        groupedMappings[mapping.category] = {};
      }
      if (!groupedMappings[mapping.category][mapping.assetName]) {
        groupedMappings[mapping.category][mapping.assetName] = [];
      }

      groupedMappings[mapping.category][mapping.assetName].push({
        id: mapping.id,
        x: mapping.x,
        y: mapping.y,
        active: mapping.active || 0,
      });
    });

    res.status(200).json({
      buildingName,
      floorPlanName,
      imageUrl,
      assetMappings: groupedMappings,
      status: true,
    });
  } catch (error) {
    console.error("Error retrieving floor map:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    });
  }
};

// GET /buildings/:buildingName/floor-maps/:floorPlanName/active-status
exports.getActiveStatus = async (req, res) => {
  const { buildingName, floorPlanName } = req.params;

  try {
    const floorMapRef = db.collection("FloorMaps").doc(buildingName).collection("floors").doc(floorPlanName);
    const floorMapDoc = await floorMapRef.get();

    if (!floorMapDoc.exists) {
      return res.status(404).json({ message: "Floor plan not found", status: false });
    }

    // Retrieve only active status from asset mappings
    const mappingsCollectionRef = floorMapRef.collection("assetMappings");
    const mappingsSnapshot = await mappingsCollectionRef.get();

    const activeStatuses = {};
    mappingsSnapshot.forEach((doc) => {
      const data = doc.data();
      activeStatuses[doc.id] = {
        active: data.active || 0,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    });

    res.status(200).json({
      buildingName,
      floorPlanName,
      activeStatuses,
      timestamp: new Date().toISOString(),
      status: true,
    });
  } catch (error) {
    console.error("Error retrieving active statuses:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    });
  }
};

// GET /buildings/:buildingName/floor-maps/:floorPlanName/active-status/stream (Server-Sent Events)
exports.streamActiveStatus = async (req, res) => {
  const { buildingName, floorPlanName } = req.params;

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  const sendActiveStatus = async () => {
    try {
      const floorMapRef = db.collection("FloorMaps").doc(buildingName).collection("floors").doc(floorPlanName);
      const mappingsCollectionRef = floorMapRef.collection("assetMappings");
      const mappingsSnapshot = await mappingsCollectionRef.get();

      const activeStatuses = {};
      mappingsSnapshot.forEach((doc) => {
        const data = doc.data();
        activeStatuses[doc.id] = {
          active: data.active || 0,
          lastUpdated: data.lastUpdated || new Date().toISOString(),
        };
      });

      const eventData = {
        buildingName,
        floorPlanName,
        activeStatuses,
        timestamp: new Date().toISOString(),
      };

      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    } catch (error) {
      console.error("Error in SSE stream:", error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }
  };

  // Send initial data
  await sendActiveStatus();

  // Send updates every 2 seconds
  const interval = setInterval(sendActiveStatus, 2000);

  // Clean up on client disconnect
  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
};

// GET /buildings/:buildingName/floor-maps
exports.getAllFloorMapsForBuilding = async (req, res) => {
  const { buildingName } = req.params;

  try {
    const floorMapsSnapshot = await db.collection("FloorMaps").doc(buildingName).collection("floors").get();

    if (floorMapsSnapshot.empty) {
      return res.status(200).json({
        message: "No floor plans found for this building",
        buildingName,
        floorPlans: [],
        status: true,
      });
    }

    const floorPlans = [];
    floorMapsSnapshot.forEach((doc) => {
      const data = doc.data();
      floorPlans.push({
        name: doc.id,
        floorPlanName: data.floorPlanName,
        buildingName: data.buildingName,
        imageUrl: data.imageUrl,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    res.status(200).json({
      message: "Floor plans retrieved successfully",
      buildingName,
      floorPlans,
      count: floorPlans.length,
      status: true,
    });
  } catch (error) {
    console.error("Error retrieving floor plans:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    });
  }
};

// GET /floor-maps/all
exports.getAllFloorMapsGlobally = async (req, res) => {
  try {
    const allFloorPlans = [];

    const buildingsSnapshot = await db.collection("FloorMaps").get();

    for (const buildingDoc of buildingsSnapshot.docs) {
      const buildingName = buildingDoc.id;

      try {
        const floorMapsSnapshot = await db.collection("FloorMaps").doc(buildingName).collection("floors").get();

        floorMapsSnapshot.forEach((doc) => {
          const data = doc.data();
          allFloorPlans.push({
            name: doc.id,
            floorPlanName: data.floorPlanName,
            buildingName: data.buildingName || buildingName,
            imageUrl: data.imageUrl,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
      } catch (buildingError) {
        console.warn(`Could not access floor plans for building ${buildingName}:`, buildingError.message);
      }
    }

    res.status(200).json({
      message: "All floor plans retrieved successfully",
      floorPlans: allFloorPlans,
      count: allFloorPlans.length,
      status: true,
    });
  } catch (error) {
    console.error("Error retrieving all floor plans:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    });
  }
};
