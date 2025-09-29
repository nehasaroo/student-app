const { db } = require("../utils/db")
const bcrypt = require("bcryptjs")

// ---------------- GET incidents for a specific building ----------------
const getIncidentsByBuilding = async (req, res) => {
  const { buildingName } = req.params

  try {
    const incidentsRef = db.collection(`${buildingName}`).doc("incidents")
    const incidentsSnapshot = await incidentsRef.get()

    if (!incidentsSnapshot.exists) {
      return res.status(404).json({
        message: "Incidents document not found.",
        status: false,
      })
    }

    const incidentsData = incidentsSnapshot.data()
    const incidents = incidentsData.incidents || []

    res.status(200).json({
      message: "Incidents retrieved successfully.",
      incidents: incidents,
      total: incidents.length,
      status: true,
    })
  } catch (error) {
    console.error("Error retrieving incidents:", error)
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    })
  }
}

// ---------------- GET all incidents from all buildings ----------------
const getAllIncidents = async (req, res) => {
  try {
    const collections = await db.listCollections()

    const buildingIncidentsPromises = collections
      .filter((col) => col.id.endsWith("BuildingDB") || col.id === "areej5")
      .map(async (col) => {
        const buildingName = col.id
        const incidentsRef = db.collection(col.id).doc("incidents")
        const incidentsSnapshot = await incidentsRef.get()

        const incidentsData = incidentsSnapshot.exists ? incidentsSnapshot.data() : null
        const incidents = incidentsData?.incidents || []

        return {
          buildingName,
          incidents: incidents,
          total: incidents.length,
          status: incidentsSnapshot.exists,
        }
      })

    const buildingIncidents = await Promise.all(buildingIncidentsPromises)
    const allIncidents = buildingIncidents
      .filter((result) => result.status)
      .flatMap((result) =>
        result.incidents.map((incident) => ({
          ...incident,
          buildingName: result.buildingName,
        })),
      )

    res.status(200).json({
      message: "All incidents retrieved successfully.",
      incidents: allIncidents,
      total: allIncidents.length,
      buildings: buildingIncidents.filter((result) => result.status).length,
      status: true,
    })
  } catch (error) {
    console.error("Error retrieving all incidents:", error)
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    })
  }
}

// ---------------- ADD new incident ----------------
const addIncident = async (req, res) => {
  const { buildingName } = req.params
  const { email, password, incident } = req.body

  if (!email || !password || !incident) {
    return res.status(400).json({
      message: "All fields are required.",
      status: false,
    })
  }

  try {
    // Verify user has access
    const userRef = db.collection("UserDB")
    const userSnapshot = await userRef.where("email", "==", email).get()

    if (userSnapshot.empty) {
      return res.status(404).json({
        message: "User not found.",
        status: false,
      })
    }

    const userData = userSnapshot.docs[0].data()
    const isPasswordValid = await bcrypt.compare(password, userData.password)

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid credentials.",
        status: false,
      })
    }

    if (userData.role !== "admin" && (!userData.buildings || !userData.buildings.includes(buildingName))) {
      return res.status(403).json({
        message: "Unauthorized to add incidents to this building.",
        status: false,
      })
    }

    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName
    const incidentsRef = db.collection(collectionName).doc("incidents")
    const incidentsSnapshot = await incidentsRef.get()

    // Generate unique incident ID
    const incidentId = `V365-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${String(Date.now()).slice(-3)}`

    const newIncident = {
      ...incident,
      incidentId,
      createdAt: new Date().toISOString(),
      createdBy: email,
      lastUpdated: new Date().toISOString(),
    }

    if (incidentsSnapshot.exists) {
      const existingData = incidentsSnapshot.data()
      const incidents = existingData.incidents || []
      incidents.push(newIncident)
      await incidentsRef.update({ incidents })
    } else {
      await incidentsRef.set({ incidents: [newIncident] })
    }

    res.status(201).json({
      message: "Incident added successfully.",
      incidentId,
      status: true,
    })
  } catch (error) {
    console.error("Error adding incident:", error)
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    })
  }
}

// ---------------- UPDATE incident ----------------
const updateIncident = async (req, res) => {
  const { buildingName, incidentId } = req.params
  const { email, password, updates } = req.body

  if (!email || !password || !updates) {
    return res.status(400).json({
      message: "All fields are required.",
      status: false,
    })
  }

  try {
    const userRef = db.collection("UserDB")
    const userSnapshot = await userRef.where("email", "==", email).get()

    if (userSnapshot.empty) {
      return res.status(404).json({
        message: "User not found.",
        status: false,
      })
    }

    const userData = userSnapshot.docs[0].data()
    const isPasswordValid = await bcrypt.compare(password, userData.password)

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid credentials.",
        status: false,
      })
    }

    if (userData.role !== "admin" && (!userData.buildings || !userData.buildings.includes(buildingName))) {
      return res.status(403).json({
        message: "Unauthorized to update incidents in this building.",
        status: false,
      })
    }

    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName
    const incidentsRef = db.collection(collectionName).doc("incidents")
    const incidentsSnapshot = await incidentsRef.get()

    if (!incidentsSnapshot.exists) {
      return res.status(404).json({
        message: "Incidents document not found.",
        status: false,
      })
    }

    const incidentsData = incidentsSnapshot.data()
    const incidents = incidentsData.incidents || []

    const incidentIndex = incidents.findIndex((inc) => inc.incidentId === incidentId)

    if (incidentIndex === -1) {
      return res.status(404).json({
        message: "Incident not found.",
        status: false,
      })
    }

    incidents[incidentIndex] = {
      ...incidents[incidentIndex],
      ...updates,
      lastUpdated: new Date().toISOString(),
      updatedBy: email,
    }

    await incidentsRef.update({ incidents })

    res.status(200).json({
      message: "Incident updated successfully.",
      status: true,
    })
  } catch (error) {
    console.error("Error updating incident:", error)
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    })
  }
}

// ---------------- INITIALIZE sample incidents ----------------
const initializeIncidents = async (req, res) => {
  const { buildingName } = req.params
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required.",
      status: false,
    })
  }

  try {
    const userRef = db.collection("UserDB")
    const userSnapshot = await userRef.where("email", "==", email).get()

    if (userSnapshot.empty) {
      return res.status(404).json({
        message: "User not found.",
        status: false,
      })
    }

    const userData = userSnapshot.docs[0].data()
    const isPasswordValid = await bcrypt.compare(password, userData.password)

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid credentials.",
        status: false,
      })
    }

    if (userData.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required.",
        status: false,
      })
    }

    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName
    const sampleIncidents = [/* your big sample incidents array from before */]

    const incidentsRef = db.collection(collectionName).doc("incidents")
    await incidentsRef.set({ incidents: sampleIncidents })

    res.status(200).json({
      message: `Sample incidents initialized for ${buildingName}`,
      count: sampleIncidents.length,
      status: true,
    })
  } catch (error) {
    console.error("Error initializing sample incidents:", error)
    res.status(500).json({
      message: "Internal Server Error",
      status: false,
    })
  }
}

//  Export all functions
module.exports = {
  getIncidentsByBuilding,
  getAllIncidents,
  addIncident,
  updateIncident,
  initializeIncidents,
}
