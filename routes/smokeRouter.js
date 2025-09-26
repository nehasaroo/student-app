const express = require("express");
const {
  getSmokeActions,
  createSmokeActions,
  updateSmokeAction,
  updateAllSmokeActions
} = require("../controller/smokeController");

const router = express.Router();

// GET smoke actions
router.get("/:buildingName", getSmokeActions);

// POST create smoke actions
router.post("/:buildingName", createSmokeActions);

// PUT update single smoke action
router.put("/:buildingName", updateSmokeAction);

// PUT update all smoke actions
router.put("/:buildingName/all", updateAllSmokeActions);

module.exports = router;
