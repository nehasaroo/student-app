const express = require("express");
const {
  listMessages,
  getAlarmMessages,
  addAlarmMessage,
  deleteAlarmMessage,
} = require("../controller/alarmController.js");

const router = express.Router();

// GET /list-messages
router.get("/list-messages", listMessages);

// GET /building/:buildingName/alarm-message
router.get("/building/:buildingName/alarm-message", getAlarmMessages);

// POST /building/:buildingName/alarm-message
router.post("/building/:buildingName/alarm-message", addAlarmMessage);

// DELETE /building/:buildingName/alarm-messages/:messageTime
router.delete(
  "/building/:buildingName/alarm-messages/:messageTime",
  deleteAlarmMessage
);

module.exports = router;
