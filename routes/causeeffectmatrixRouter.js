const express = require("express")
const router = express.Router()
const causeEffectController = require("../controller/causeeffectmatrixController.js");
const uploadExcel = require("../middlewares/uploadimage.js");

// GET cause and effect matrix for a building
router.get("/building/:buildingName/cause-effect-matrix", causeEffectController.getMatrixByBuilding)

// POST upload and process Excel file
router.post(
  "/building/:buildingName/cause-effect-matrix/upload",
  uploadExcel.single("excelFile"),
  causeEffectController.uploadMatrix
)

// PUT update specific cell in the matrix
router.put("/building/:buildingName/cause-effect-matrix/cell", causeEffectController.updateCell)

// DELETE delete cause and effect matrix
router.delete("/building/:buildingName/cause-effect-matrix", causeEffectController.deleteMatrix)

// GET download original Excel file
router.get("/building/:buildingName/cause-effect-matrix/download", causeEffectController.downloadMatrix)

module.exports = router;