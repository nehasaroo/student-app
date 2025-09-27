const express = require("express");
const router = express.Router();
const floorMapController = require("../controller/floormapController.js");
const uploadimage = require("../middlewares/uploadimage");

// Path constant for floor map specific routes
const floorMapPath = "/buildings/:buildingName/floor-maps/:floorPlanName";


// GET /floor-maps/all
router.get("/floor-maps/all", floorMapController.getAllFloorMapsGlobally);


// GET /buildings/:buildingName/floor-maps
router.get("/buildings/:buildingName/floor-maps", floorMapController.getAllFloorMapsForBuilding);

// POST /buildings/:buildingName/floor-maps (Create/Overwrite)
router.post(
  "/buildings/:buildingName/floor-maps",
  uploadimage.single("floorPlanImage"),
  floorMapController.saveOrUpdateFloorMap
);


// GET /buildings/:buildingName/floor-maps/:floorPlanName (Get specific floor map)
router.get(floorMapPath, floorMapController.getSpecificFloorMap);

// PATCH /buildings/:buildingName/floor-maps/:floorPlanName (Update image and/or assets)
router.patch(
  floorMapPath,
  uploadimage.single("floorPlanImage"),
  floorMapController.updateFloorMapAndAssets
);

// DELETE /buildings/:buildingName/floor-maps/:floorPlanName
router.delete(floorMapPath, floorMapController.deleteFloorMap);


// PATCH /buildings/:buildingName/floor-maps/:floorPlanName/assets (Update only asset positions)
router.patch(`${floorMapPath}/assets`, floorMapController.updateAssetPositions);

// GET /buildings/:buildingName/floor-maps/:floorPlanName/active-status
router.get(`${floorMapPath}/active-status`, floorMapController.getActiveStatus);

// GET /buildings/:buildingName/floor-maps/:floorPlanName/active-status/stream (Server-Sent Events)
router.get(`${floorMapPath}/active-status/stream`, floorMapController.streamActiveStatus);

module.exports = router;
