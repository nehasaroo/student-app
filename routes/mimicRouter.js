const express = require("express");
const router = express.Router();
const mimicController = require("../controller/mimicController.js");

// MIMIC ROUTES
router.post("/:buildingName/mimic/add-device", mimicController.addDevice);
router.patch("/:buildingName/mimic/update-status", mimicController.updateDeviceStatus);
router.put("/:buildingName/mimic/update-name", mimicController.updateDeviceName);
router.get("/:buildingName/mimic", mimicController.getMimic);
router.delete("/:buildingName/mimic/delete-device", mimicController.deleteDevice);

// ACTIONS ROUTES
router.get("/:buildingName/actions", mimicController.getActions);
router.put("/:buildingName/actions", mimicController.updateActions);
router.patch("/:buildingName/actions", mimicController.patchActions);

module.exports = router;
