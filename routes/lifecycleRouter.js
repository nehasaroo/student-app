const express = require("express");
const {
  getLifecycleChecklist,
  getAllLifecycleChecklists,
  initializeLifecycleChecklist,
  updateTaskStatus,
  addTask,
  deleteTask,
} = require("../controller/lifecycleController.js");

const router = express.Router();

// Single building
router.get("/building/:buildingName/lifecycle-checklist", getLifecycleChecklist);

// All buildings
router.get("/buildings/lifecycle-checklist", getAllLifecycleChecklists);

// Initialize checklist
router.post("/building/:buildingName/lifecycle-checklist/initialize", initializeLifecycleChecklist);

// Update task
router.put("/building/:buildingName/lifecycle-checklist/:taskId", updateTaskStatus);

// Add task
router.post("/building/:buildingName/lifecycle-checklist/task", addTask);

// Delete task
router.delete("/building/:buildingName/lifecycle-checklist/:taskId", deleteTask);

module.exports = router;
