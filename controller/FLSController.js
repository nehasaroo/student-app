const { db } = require("../utils/db");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");


// --------------------
// Get FLS lifecycle for a specific building
// --------------------
exports.getFLSLifecycle = async (req, res) => {
  const { buildingName } = req.params
  try {
    const flsRef = db.collection(`${buildingName}`).doc("fls-lifecycle")
    const flsSnapshot = await flsRef.get()
    if (!flsSnapshot.exists)
      return res.status(404).json({ message: "FLS lifecycle not found.", status: false })

    const lifecycle = flsSnapshot.data().lifecycle || []
    res.status(200).json({
      message: "FLS lifecycle retrieved successfully.",
      lifecycle,
      buildingName,
      total: lifecycle.length,
      status: true,
    })
  } catch (error) {
    console.error("Error retrieving FLS lifecycle:", error)
    res.status(500).json({ message: "Internal Server Error", status: false })
  }
}

// --------------------
// Get all FLS lifecycles from all buildings
// --------------------
exports.getAllFLSLifecycles = async (req, res) => {
  try {
    const collections = await db.listCollections()
    const buildingFLSPromises = collections
      .filter((col) => col.id.endsWith("BuildingDB") || col.id === "areej5")
      .map(async (col) => {
        const buildingName = col.id
        const flsRef = db.collection(col.id).doc("fls-lifecycle")
        const flsSnapshot = await flsRef.get()
        const lifecycle = flsSnapshot.exists ? flsSnapshot.data().lifecycle || [] : []
        return { buildingName, lifecycle, total: lifecycle.length, status: flsSnapshot.exists }
      })

    const buildingFLS = await Promise.all(buildingFLSPromises)
    res.status(200).json({
      message: "All FLS lifecycles retrieved successfully.",
      buildings: buildingFLS,
      totalBuildings: buildingFLS.filter((result) => result.status).length,
      status: true,
    })
  } catch (error) {
    console.error("Error retrieving all FLS lifecycles:", error)
    res.status(500).json({ message: "Internal Server Error", status: false })
  }
}

// --------------------
// Initialize FLS lifecycle
// --------------------
exports.initializeFLSLifecycle = async (req, res) => {
  const { buildingName } = req.params
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required.", status: false })

  try {
    const userSnapshot = await db.collection("UserDB").where("email", "==", email).get()
    if (userSnapshot.empty) return res.status(404).json({ message: "User not found.", status: false })

    const userData = userSnapshot.docs[0].data()
    const isPasswordValid = await bcrypt.compare(password, userData.password)
    if (!isPasswordValid) return res.status(401).json({ message: "Invalid credentials.", status: false })

    if (userData.role !== "admin" && (!userData.buildings || !userData.buildings.includes(buildingName))) {
      return res.status(403).json({
        message: "Unauthorized to initialize FLS lifecycle for this building.",
        status: false,
      })
    }

    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName
    const flsRef = db.collection(collectionName).doc("fls-lifecycle")

    const flsWithMetadata = defaultFLSLifecycle.map((item) => ({
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: email,
      buildingName,
    }))

    await flsRef.set({
      lifecycle: flsWithMetadata,
      createdAt: new Date().toISOString(),
      createdBy: email,
      buildingName,
      totalPhases: 7,
      totalTasks: defaultFLSLifecycle.length,
    })

    res.status(200).json({
      message: `FLS lifecycle initialized for ${buildingName}`,
      count: defaultFLSLifecycle.length,
      phases: 7,
      status: true,
    })
  } catch (error) {
    console.error("Error initializing FLS lifecycle:", error)
    res.status(500).json({ message: "Internal Server Error", status: false })
  }
}

// --------------------
// Update FLS task
// --------------------
exports.updateFLSTask = async (req, res) => {
  const { buildingName, taskId } = req.params
  const { email, password, status, notes, actualStartDate, actualEndDate, issues, recommendations } = req.body
  if (!email || !password || !status)
    return res.status(400).json({ message: "Email, password, and status are required.", status: false })

  try {
    const userSnapshot = await db.collection("UserDB").where("email", "==", email).get()
    if (userSnapshot.empty) return res.status(404).json({ message: "User not found.", status: false })

    const userData = userSnapshot.docs[0].data()
    const isPasswordValid = await bcrypt.compare(password, userData.password)
    if (!isPasswordValid) return res.status(401).json({ message: "Invalid credentials.", status: false })

    if (userData.role !== "admin" && (!userData.buildings || !userData.buildings.includes(buildingName))) {
      return res.status(403).json({
        message: "Unauthorized to update FLS lifecycle for this building.",
        status: false,
      })
    }

    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName
    const flsRef = db.collection(collectionName).doc("fls-lifecycle")
    const flsSnapshot = await flsRef.get()
    if (!flsSnapshot.exists) return res.status(404).json({ message: "FLS lifecycle not found.", status: false })

    const lifecycle = flsSnapshot.data().lifecycle || []
    const taskIndex = lifecycle.findIndex((task) => task.id === taskId)
    if (taskIndex === -1) return res.status(404).json({ message: "Task not found.", status: false })

    lifecycle[taskIndex] = {
      ...lifecycle[taskIndex],
      status,
      notes: notes || lifecycle[taskIndex].notes || "",
      actualStartDate: actualStartDate || lifecycle[taskIndex].actualStartDate,
      actualEndDate: actualEndDate || lifecycle[taskIndex].actualEndDate,
      issues: issues || lifecycle[taskIndex].issues || "",
      recommendations: recommendations || lifecycle[taskIndex].recommendations || "",
      updatedAt: new Date().toISOString(),
      updatedBy: email,
    }

    await flsRef.update({ lifecycle })
    res.status(200).json({ message: "FLS task status updated successfully.", task: lifecycle[taskIndex], status: true })
  } catch (error) {
    console.error("Error updating FLS task status:", error)
    res.status(500).json({ message: "Internal Server Error", status: false })
  }
}

// --------------------
// Add new task
// --------------------
exports.addFLSTask = async (req, res) => {
  const { buildingName } = req.params
  const { email, password, task } = req.body
  if (!email || !password || !task)
    return res.status(400).json({ message: "Email, password, and task details are required.", status: false })

  try {
    const userSnapshot = await db.collection("UserDB").where("email", "==", email).get()
    if (userSnapshot.empty) return res.status(404).json({ message: "User not found.", status: false })

    const userData = userSnapshot.docs[0].data()
    const isPasswordValid = await bcrypt.compare(password, userData.password)
    if (!isPasswordValid) return res.status(401).json({ message: "Invalid credentials.", status: false })

    if (userData.role !== "admin" && (!userData.buildings || !userData.buildings.includes(buildingName))) {
      return res.status(403).json({
        message: "Unauthorized to add tasks to this building's FLS lifecycle.",
        status: false,
      })
    }

    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName
    const flsRef = db.collection(collectionName).doc("fls-lifecycle")
    const flsSnapshot = await flsRef.get()
    if (!flsSnapshot.exists)
      return res.status(404).json({ message: "FLS lifecycle not found. Please initialize first.", status: false })

    const lifecycle = flsSnapshot.data().lifecycle || []
    const taskId = `fls-custom-${Date.now()}`
    const maxOrder = Math.max(...lifecycle.map((t) => t.order || 0), 0)

    const newTask = {
      id: taskId,
      phase: task.phase,
      task: task.task,
      responsibleParty: task.responsibleParty,
      status: task.status || "Not Started",
      order: maxOrder + 1,
      description: task.description || "",
      documents: task.documents || [],
      codes: task.codes || [],
      systems: task.systems || [],
      dcdRequirement: task.dcdRequirement || false,
      criticalPath: task.criticalPath || false,
      estimatedDuration: task.estimatedDuration || "",
      prerequisites: task.prerequisites || [],
      deliverables: task.deliverables || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: email,
      buildingName,
      notes: task.notes || "",
    }

    lifecycle.push(newTask)
    await flsRef.update({ lifecycle })
    res.status(201).json({ message: "FLS task added successfully.", task: newTask, status: true })
  } catch (error) {
    console.error("Error adding FLS task:", error)
    res.status(500).json({ message: "Internal Server Error", status: false })
  }
}

// --------------------
// Delete FLS task
// --------------------
exports.deleteFLSTask = async (req, res) => {
  const { buildingName, taskId } = req.params
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ message: "Email and password are required.", status: false })

  try {
    const userSnapshot = await db.collection("UserDB").where("email", "==", email).get()
    if (userSnapshot.empty) return res.status(404).json({ message: "User not found.", status: false })

    const userData = userSnapshot.docs[0].data()
    const isPasswordValid = await bcrypt.compare(password, userData.password)
    if (!isPasswordValid) return res.status(401).json({ message: "Invalid credentials.", status: false })
    if (userData.role !== "admin")
      return res.status(403).json({ message: "Admin access required to delete FLS tasks.", status: false })

    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName
    const flsRef = db.collection(collectionName).doc("fls-lifecycle")
    const flsSnapshot = await flsRef.get()
    if (!flsSnapshot.exists) return res.status(404).json({ message: "FLS lifecycle not found.", status: false })

    const lifecycle = flsSnapshot.data().lifecycle || []
    const taskIndex = lifecycle.findIndex((task) => task.id === taskId)
    if (taskIndex === -1) return res.status(404).json({ message: "FLS task not found.", status: false })

    const deletedTask = lifecycle[taskIndex]
    lifecycle.splice(taskIndex, 1)
    await flsRef.update({ lifecycle })
    res.status(200).json({ message: "FLS task deleted successfully.", deletedTask, status: true })
  } catch (error) {
    console.error("Error deleting FLS task:", error)
    res.status(500).json({ message: "Internal Server Error", status: false })
  }
}

// --------------------
// Get FLS analytics
// --------------------
exports.getFLSAnalytics = async (req, res) => {
  const { buildingName } = req.params
  try {
    const flsRef = db.collection(`${buildingName}`).doc("fls-lifecycle")
    const flsSnapshot = await flsRef.get()
    if (!flsSnapshot.exists) return res.status(404).json({ message: "FLS lifecycle not found.", status: false })

    const lifecycle = flsSnapshot.data().lifecycle || []

    const totalTasks = lifecycle.length
    const completedTasks = lifecycle.filter((t) => t.status === "Completed").length
    const inProgressTasks = lifecycle.filter((t) => t.status === "In Progress").length
    const notStartedTasks = lifecycle.filter((t) => t.status === "Not Started").length
    const onHoldTasks = lifecycle.filter((t) => t.status === "On Hold").length
    const criticalPathTasks = lifecycle.filter((t) => t.criticalPath).length
    const dcdRequiredTasks = lifecycle.filter((t) => t.dcdRequirement).length

    const phases = [...new Set(lifecycle.map((t) => t.phase))]
    const phaseAnalytics = phases.map((phase) => {
      const phaseTasks = lifecycle.filter((t) => t.phase === phase)
      const phaseCompleted = phaseTasks.filter((t) => t.status === "Completed").length
      return { phase, total: phaseTasks.length, completed: phaseCompleted, percentage: Math.round((phaseCompleted / phaseTasks.length) * 100) }
    })

    const uniqueSystems = [...new Set(lifecycle.flatMap((t) => t.systems || []))]
    const systemAnalytics = uniqueSystems.map((system) => {
      const systemTasks = lifecycle.filter((t) => t.systems && t.systems.includes(system))
      const systemCompleted = systemTasks.filter((t) => t.status === "Completed").length
      return { system, total: systemTasks.length, completed: systemCompleted, percentage: Math.round((systemCompleted / systemTasks.length) * 100) }
    })

    res.status(200).json({
      message: "FLS analytics retrieved successfully.",
      analytics: {
        overview: { totalTasks, completedTasks, inProgressTasks, notStartedTasks, onHoldTasks, criticalPathTasks, dcdRequiredTasks, completionPercentage: Math.round((completedTasks / totalTasks) * 100) },
        phases: phaseAnalytics,
        systems: systemAnalytics,
      },
      status: true,
    })
  } catch (error) {
    console.error("Error retrieving FLS analytics:", error)
    res.status(500).json({ message: "Internal Server Error", status: false })
  }
}
