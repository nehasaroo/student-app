const express = require("express")
const router = express.Router()
const communityController = require("../controller/communityController.js") 

// Community Management Routes
router.post("/create", communityController.createCommunity)
router.post("/all", communityController.getAllCommunities) 
router.get("/:communityId", communityController.getCommunityById)
router.put("/:communityId", communityController.updateCommunity)
router.delete("/:communityId", communityController.deleteCommunity)

// Building Assignment Routes
router.post("/:communityId/assign-buildings", communityController.assignBuildingsToCommunity)
router.post("/:communityId/remove-buildings", communityController.removeBuildingsFromCommunity)
router.get("/:communityId/buildings", communityController.getCommunityBuildings)

// Building Status Routes
router.post("/buildings/with-community-status", communityController.getBuildingsWithCommunityStatus)
router.get("/buildings/unassigned", communityController.getUnassignedBuildings)

module.exports = router;