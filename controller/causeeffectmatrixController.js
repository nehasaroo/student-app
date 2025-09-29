const { db } = require("../utils/db");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");

// Utility: flatten matrix data
const flattenMatrixData = (matrix) => {
  const flattened = {}
  matrix.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell !== "") flattened[`${rowIndex}_${colIndex}`] = cell
    })
  })
  return flattened
}

// Utility: reconstruct matrix from flattened data
const reconstructMatrixData = (flattened, totalRows, totalCols) => {
  const matrix = Array.from({ length: totalRows }, () =>
    Array(totalCols).fill("")
  )
  Object.keys(flattened).forEach((key) => {
    const [row, col] = key.split("_").map(Number)
    matrix[row][col] = flattened[key]
  })
  return matrix
}

// ---------------- Get cause & effect matrix ----------------
exports.getMatrixByBuilding = async (req, res) => {
  const { buildingName } = req.params
  try {
    const matrixRef = db.collection(buildingName).doc("cause-effect-matrix")
    const snapshot = await matrixRef.get()

    if (!snapshot.exists) {
      return res.status(404).json({ message: "Matrix not found", status: false })
    }

    const matrixData = snapshot.data()
    if (matrixData.flattenedData) {
      matrixData.rawData = reconstructMatrixData(
        matrixData.flattenedData,
        matrixData.totalRows,
        matrixData.totalColumns
      )
    }

    res.status(200).json({
      message: "Matrix retrieved successfully",
      matrix: matrixData,
      buildingName,
      status: true,
    })
  } catch (error) {
    console.error("Error retrieving matrix:", error)
    res.status(500).json({ message: "Internal Server Error", status: false })
  }
}

// ---------------- Upload cause & effect matrix ----------------
exports.uploadMatrix = async (req, res) => {
  const { buildingName } = req.params
  const { email, password } = req.body

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password required", status: false })
  }

  if (!req.file) {
    return res
      .status(400)
      .json({ message: "Excel file required", status: false })
  }

  try {
    // Verify user
    const userSnapshot = await db
      .collection("UserDB")
      .where("email", "==", email)
      .get()

    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found", status: false })
    }

    const userData = userSnapshot.docs[0].data()
    const isPasswordValid = await bcrypt.compare(password, userData.password)
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials", status: false })
    }

    if (
      userData.role !== "admin" &&
      (!userData.buildings || !userData.buildings.includes(buildingName))
    ) {
      return res
        .status(403)
        .json({ message: "Unauthorized to upload", status: false })
    }

    // Upload file to GCS
    const timestamp = Date.now()
    const fileName = `cause-effect-matrices/${buildingName}/${timestamp}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`
    let fileUrl = null
    try {
      fileUrl = await uploadExcelToBucket(req.file, fileName)
    } catch (err) {
      console.error("Upload to GCS failed:", err)
    }

    // Parse Excel
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: "" })

    const totalRows = rawData.length
    const totalColumns =
      rawData.length > 0 ? Math.max(...rawData.map((r) => r.length)) : 0

    const flattenedData = flattenMatrixData(rawData)

    const collectionName =
      buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName
    const matrixRef = db.collection(collectionName).doc("cause-effect-matrix")

    const matrixData = {
      buildingName,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: email,
      lastUpdated: new Date().toISOString(),
      sheetName,
      flattenedData,
      totalRows,
      totalColumns,
    }

    await matrixRef.set(matrixData)
    matrixData.rawData = rawData

    res.status(200).json({
      message: `Matrix uploaded successfully for ${buildingName}`,
      matrix: matrixData,
      status: true,
    })
  } catch (error) {
    console.error("Error uploading matrix:", error)
    res.status(500).json({ message: "Internal Server Error", status: false })
  }
}

// ---------------- Update a cell ----------------
exports.updateCell = async (req, res) => {
  const { buildingName } = req.params
  const { email, password, rowIndex, columnIndex, value } = req.body

  if (!email || !password || rowIndex === undefined || columnIndex === undefined) {
    return res
      .status(400)
      .json({ message: "Missing required fields", status: false })
  }

  try {
    const userSnapshot = await db
      .collection("UserDB")
      .where("email", "==", email)
      .get()
    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found", status: false })
    }

    const userData = userSnapshot.docs[0].data()
    const isPasswordValid = await bcrypt.compare(password, userData.password)
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials", status: false })
    }

    if (
      userData.role !== "admin" &&
      (!userData.buildings || !userData.buildings.includes(buildingName))
    ) {
      return res
        .status(403)
        .json({ message: "Unauthorized to update", status: false })
    }

    const collectionName =
      buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName
    const matrixRef = db.collection(collectionName).doc("cause-effect-matrix")
    const snapshot = await matrixRef.get()
    if (!snapshot.exists) {
      return res.status(404).json({ message: "Matrix not found", status: false })
    }

    const matrixData = snapshot.data()
    const flattenedData = matrixData.flattenedData || {}
    const cellKey = `${rowIndex}_${columnIndex}`

    if (value && value !== "") {
      flattenedData[cellKey] = value
    } else {
      delete flattenedData[cellKey]
    }

    const newTotalRows = Math.max(matrixData.totalRows || 0, rowIndex + 1)
    const newTotalColumns = Math.max(
      matrixData.totalColumns || 0,
      columnIndex + 1
    )

    const updatedMatrix = {
      ...matrixData,
      flattenedData,
      lastUpdated: new Date().toISOString(),
      updatedBy: email,
      totalRows: newTotalRows,
      totalColumns: newTotalColumns,
    }

    await matrixRef.update(updatedMatrix)
    updatedMatrix.rawData = reconstructMatrixData(
      flattenedData,
      newTotalRows,
      newTotalColumns
    )

    res.status(200).json({
      message: "Cell updated successfully",
      matrix: updatedMatrix,
      status: true,
    })
  } catch (error) {
    console.error("Error updating cell:", error)
    res.status(500).json({ message: "Internal Server Error", status: false })
  }
}

// ---------------- Delete matrix ----------------
exports.deleteMatrix = async (req, res) => {
  const { buildingName } = req.params
  const { email, password } = req.body

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password required", status: false })
  }

  try {
    const userSnapshot = await db
      .collection("UserDB")
      .where("email", "==", email)
      .get()
    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found", status: false })
    }

    const userData = userSnapshot.docs[0].data()
    const isPasswordValid = await bcrypt.compare(password, userData.password)
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials", status: false })
    }

    if (userData.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Admin access required", status: false })
    }

    const collectionName =
      buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName
    const matrixRef = db.collection(collectionName).doc("cause-effect-matrix")
    const snapshot = await matrixRef.get()

    if (snapshot.exists) {
      const matrixData = snapshot.data()
      if (matrixData.fileUrl) {
        try {
          const fileName = matrixData.fileUrl.split(`${bucketName1}/`)[1]
          if (fileName) await bucket1.file(fileName).delete()
        } catch (err) {
          console.error("Error deleting GCS file:", err)
        }
      }
    }

    await matrixRef.delete()
    res.status(200).json({ message: "Matrix deleted successfully", status: true })
  } catch (error) {
    console.error("Error deleting matrix:", error)
    res.status(500).json({ message: "Internal Server Error", status: false })
  }
}

// ---------------- Download matrix ----------------
exports.downloadMatrix = async (req, res) => {
  const { buildingName } = req.params
  const { email } = req.query

  if (!email) {
    return res.status(400).json({ message: "Email required", status: false })
  }

  try {
    const userSnapshot = await db
      .collection("UserDB")
      .where("email", "==", email)
      .get()
    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found", status: false })
    }

    const userData = userSnapshot.docs[0].data()
    if (
      userData.role !== "admin" &&
      (!userData.buildings || !userData.buildings.includes(buildingName))
    ) {
      return res
        .status(403)
        .json({ message: "Unauthorized to download", status: false })
    }

    const collectionName =
      buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName
    const matrixRef = db.collection(collectionName).doc("cause-effect-matrix")
    const snapshot = await matrixRef.get()
    if (!snapshot.exists) {
      return res.status(404).json({ message: "Matrix not found", status: false })
    }

    const matrixData = snapshot.data()
    if (!matrixData.fileUrl) {
      return res
        .status(404)
        .json({ message: "Excel file not available", status: false })
    }

    res.status(200).json({
      message: "Download URL retrieved successfully",
      downloadUrl: matrixData.fileUrl,
      fileName: matrixData.fileName,
      status: true,
    })
  } catch (error) {
    console.error("Error downloading matrix:", error)
    res.status(500).json({ message: "Internal Server Error", status: false })
  }
}
