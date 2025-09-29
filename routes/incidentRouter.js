const express = require("express")
const router = express.Router()
const incidentController = require("../controller/incidentController.js")

// GET all incidents of one building
router.get("/building/:buildingName/incidents", incidentController.getIncidentsByBuilding)

// GET all incidents across buildings
router.get("/buildings/incidents", incidentController.getAllIncidents)

// POST add new incident
router.post("/building/:buildingName/incidents", incidentController.addIncident)

// PUT update incident
router.put("/building/:buildingName/incidents/:incidentId", incidentController.updateIncident)

// POST initialize sample incidents
router.post("/building/:buildingName/incidents/initialize", incidentController.initializeIncidents)

module.exports = router;
