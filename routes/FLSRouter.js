const express = require("express")
const router = express.Router()
const flsController = require("../controller/FLSController.js") 

// Routes
router.get("/:buildingName/fls-lifecycle", flsController.getFLSLifecycle)
router.get("/buildings/fls-lifecycle", flsController.getAllFLSLifecycles)
router.post("/:buildingName/fls-lifecycle/initialize", flsController.initializeFLSLifecycle)
router.put("/:buildingName/fls-lifecycle/:taskId", flsController.updateFLSTask)
router.post("/:buildingName/fls-lifecycle/task", flsController.addFLSTask)
router.delete("/:buildingName/fls-lifecycle/:taskId", flsController.deleteFLSTask)
router.get("/:buildingName/fls-lifecycle/analytics", flsController.getFLSAnalytics)

module.exports = router
