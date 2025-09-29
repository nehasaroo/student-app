const express = require("express");
const router = express.Router();
const notifyController = require("../controller/notifyController");

// POST /users/assign_notif
router.post("/assign_notif", notifyController.assignNotif);

// GET /users/notif_configs
router.get("/notif_configs", notifyController.getNotifConfigs);

module.exports = router;
