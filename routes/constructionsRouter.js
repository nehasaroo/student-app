const express = require("express");
const router = express.Router();
const constructionsController = require("../controller/constructionsController.js");

// ------------------------- BUILDING CONSTRUCTION ENDPOINTS -------------------------

// Create / Update construction status
router.post("/construction/status", constructionsController.updateConstructionStatus);

// Get construction status (GET)
router.get("/construction/status/:buildingName", constructionsController.getConstructionStatus);

// Get construction status (POST alternative)
router.post("/construction/status/get", constructionsController.getConstructionStatusPost);

// Get all buildings
router.get("/construction/all", constructionsController.getAllConstructions);

// Update specific construction step
router.put("/construction/step", constructionsController.updateStep);

// Delete construction data
router.delete("/construction/status/:buildingName", constructionsController.deleteConstruction);


// ------------------------- SUBCATEGORY CONSTRUCTION ENDPOINTS -------------------------

// Create / Update subcategory construction status
router.post("/construction/subcategory/status", constructionsController.updateSubcategoryStatus);

// Get subcategory status (GET)
router.get("/construction/subcategory/status/:buildingName/:categoryKey/:subcategoryName", constructionsController.getSubcategoryStatus);

// Get subcategory status (POST alternative)
router.post("/construction/subcategory/status/get", constructionsController.getSubcategoryStatus);

// Get all subcategories for a building
router.get("/construction/subcategory/all/:buildingName", constructionsController.getAllSubcategories);

module.exports = router;
