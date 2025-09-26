const { db } = require("../utils/db");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");




// Get lifecycle checklist for a specific building
const getLifecycleChecklist = async (req, res) => {
  const { buildingName } = req.params;
  try {
    const checklistRef = db.collection(`${buildingName}`).doc("lifecycle-checklist");
    const checklistSnapshot = await checklistRef.get();

    if (!checklistSnapshot.exists) {
      return res.status(404).json({ message: "Lifecycle checklist not found.", status: false });
    }

    const checklistData = checklistSnapshot.data();
    const checklist = checklistData.checklist || [];

    res.status(200).json({
      message: "Lifecycle checklist retrieved successfully.",
      checklist,
      buildingName,
      total: checklist.length,
      status: true,
    });
  } catch (error) {
    console.error("Error retrieving lifecycle checklist:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Get all lifecycle checklists
const getAllLifecycleChecklists = async (req, res) => {
  try {
    const collections = await db.listCollections();

    const buildingChecklistsPromises = collections
      .filter((col) => col.id.endsWith("BuildingDB") || col.id === "areej5")
      .map(async (col) => {
        const buildingName = col.id;
        const checklistRef = db.collection(col.id).doc("lifecycle-checklist");
        const checklistSnapshot = await checklistRef.get();

        const checklistData = checklistSnapshot.exists ? checklistSnapshot.data() : null;
        const checklist = checklistData?.checklist || [];

        return {
          buildingName,
          checklist,
          total: checklist.length,
          status: checklistSnapshot.exists,
        };
      });

    const buildingChecklists = await Promise.all(buildingChecklistsPromises);

    res.status(200).json({
      message: "All lifecycle checklists retrieved successfully.",
      buildings: buildingChecklists,
      totalBuildings: buildingChecklists.filter((result) => result.status).length,
      status: true,
    });
  } catch (error) {
    console.error("Error retrieving all lifecycle checklists:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Initialize lifecycle checklist
const initializeLifecycleChecklist = async (req, res) => {
  const { buildingName } = req.params;
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required.", status: false });
  }

  try {
    const userRef = db.collection("UserDB");
    const userSnapshot = await userRef.where("email", "==", email).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found.", status: false });
    }

    const userData = userSnapshot.docs[0].data();
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials.", status: false });
    }

    if (userData.role !== "admin" && (!userData.buildings || !userData.buildings.includes(buildingName))) {
      return res.status(403).json({ message: "Unauthorized to initialize checklist for this building.", status: false });
    }

    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName;
    const checklistRef = db.collection(collectionName).doc("lifecycle-checklist");

    const checklistWithMetadata = defaultLifecycleChecklist.map((item) => ({
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: email,
      buildingName,
    }));

    await checklistRef.set({
      checklist: checklistWithMetadata,
      createdAt: new Date().toISOString(),
      createdBy: email,
      buildingName,
    });

    res.status(200).json({
      message: `Lifecycle checklist initialized for ${buildingName}`,
      count: defaultLifecycleChecklist.length,
      status: true,
    });
  } catch (error) {
    console.error("Error initializing lifecycle checklist:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Update task status
const updateTaskStatus = async (req, res) => {
  const { buildingName, taskId } = req.params;
  const { email, password, status, notes } = req.body;

  if (!email || !password || !status) {
    return res.status(400).json({ message: "Email, password, and status are required.", status: false });
  }

  try {
    const userRef = db.collection("UserDB");
    const userSnapshot = await userRef.where("email", "==", email).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found.", status: false });
    }

    const userData = userSnapshot.docs[0].data();
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials.", status: false });
    }

    if (userData.role !== "admin" && (!userData.buildings || !userData.buildings.includes(buildingName))) {
      return res.status(403).json({ message: "Unauthorized to update checklist.", status: false });
    }

    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName;
    const checklistRef = db.collection(collectionName).doc("lifecycle-checklist");
    const checklistSnapshot = await checklistRef.get();

    if (!checklistSnapshot.exists) {
      return res.status(404).json({ message: "Lifecycle checklist not found.", status: false });
    }

    const checklistData = checklistSnapshot.data();
    const checklist = checklistData.checklist || [];

    const taskIndex = checklist.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      return res.status(404).json({ message: "Task not found.", status: false });
    }

    checklist[taskIndex] = {
      ...checklist[taskIndex],
      status,
      notes: notes || checklist[taskIndex].notes,
      updatedAt: new Date().toISOString(),
      updatedBy: email,
    };

    await checklistRef.update({ checklist });

    res.status(200).json({
      message: "Task status updated successfully.",
      task: checklist[taskIndex],
      status: true,
    });
  } catch (error) {
    console.error("Error updating task status:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Add new task
const addTask = async (req, res) => {
  const { buildingName } = req.params;
  const { email, password, task } = req.body;

  if (!email || !password || !task) {
    return res.status(400).json({ message: "Email, password, and task details are required.", status: false });
  }

  try {
    const userRef = db.collection("UserDB");
    const userSnapshot = await userRef.where("email", "==", email).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found.", status: false });
    }

    const userData = userSnapshot.docs[0].data();
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials.", status: false });
    }

    if (userData.role !== "admin" && (!userData.buildings || !userData.buildings.includes(buildingName))) {
      return res.status(403).json({ message: "Unauthorized to add tasks.", status: false });
    }

    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName;
    const checklistRef = db.collection(collectionName).doc("lifecycle-checklist");
    const checklistSnapshot = await checklistRef.get();

    if (!checklistSnapshot.exists) {
      return res.status(404).json({ message: "Checklist not found. Please initialize first.", status: false });
    }

    const checklistData = checklistSnapshot.data();
    const checklist = checklistData.checklist || [];

    const taskId = `custom-${Date.now()}`;
    const maxOrder = Math.max(...checklist.map((t) => t.order || 0), 0);

    const newTask = {
      id: taskId,
      phase: task.phase,
      task: task.task,
      responsibleParty: task.responsibleParty,
      status: task.status || "Not Started",
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: email,
      buildingName,
      notes: task.notes || "",
    };

    checklist.push(newTask);
    await checklistRef.update({ checklist });

    res.status(201).json({ message: "Task added successfully.", task: newTask, status: true });
  } catch (error) {
    console.error("Error adding task:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

// Delete task
const deleteTask = async (req, res) => {
  const { buildingName, taskId } = req.params;
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required.", status: false });
  }

  try {
    const userRef = db.collection("UserDB");
    const userSnapshot = await userRef.where("email", "==", email).get();

    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found.", status: false });
    }

    const userData = userSnapshot.docs[0].data();
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials.", status: false });
    }

    if (userData.role !== "admin") {
      return res.status(403).json({ message: "Admin access required to delete tasks.", status: false });
    }

    const collectionName = buildingName === "areej5" ? `${buildingName}BuildingDB` : buildingName;
    const checklistRef = db.collection(collectionName).doc("lifecycle-checklist");
    const checklistSnapshot = await checklistRef.get();

    if (!checklistSnapshot.exists) {
      return res.status(404).json({ message: "Lifecycle checklist not found.", status: false });
    }

    const checklistData = checklistSnapshot.data();
    const checklist = checklistData.checklist || [];

    const taskIndex = checklist.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      return res.status(404).json({ message: "Task not found.", status: false });
    }

    const deletedTask = checklist[taskIndex];
    checklist.splice(taskIndex, 1);
    await checklistRef.update({ checklist });

    res.status(200).json({ message: "Task deleted successfully.", deletedTask, status: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

module.exports = {
  getLifecycleChecklist,
  getAllLifecycleChecklists,
  initializeLifecycleChecklist,
  updateTaskStatus,
  addTask,
  deleteTask,
};

