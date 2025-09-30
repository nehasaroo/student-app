const { db } = require("../utils/db");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");


// Helper function to get building collection name
exports.getBuildingCollectionName = (buildingName) => {
  return `${buildingName}BuildingDB`
}

// POST endpoint to create a new community
exports.createCommunity = async (req, res) => {
  // NOTE: You must ensure 'db' is accessible/imported in a real-world scenario.
  const { communityName, description, createdBy } = req.body

  // Validate required fields
  if (!communityName) {
    return res.status(400).json({
      message: "Community name is required.",
      status: false,
    })
  }

  try {
    // Check if community name already exists
    const existingCommunity = await db.collection("communities").where("communityName", "==", communityName).get()

    if (!existingCommunity.empty) {
      return res.status(409).json({
        message: "Community with this name already exists.",
        status: false,
      })
    }

    const communityData = {
      communityName: communityName.trim(),
      description: description?.trim() || "",
      buildings: [],
      totalBuildings: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: createdBy || "system",
      isActive: true,
    }

    // Create community document
    exports. communityRef = await db.collection("communities").add(communityData)

    res.status(201).json({
      message: `Community '${communityName}' created successfully`,
      communityId: communityRef.id,
      communityData: {
        id: communityRef.id,
        ...communityData,
      },
      status: true,
    })
  } catch (error) {
    console.error("Error creating community:", error)
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    })
  }
}

// POST endpoint to get all communities (admin) or assigned communities (non-admin)
exports.getAllCommunities = async (req, res) => {
  const { email, role } = req.body

  if (!email || !role) {
    return res.status(400).json({ message: "Email and role are required.", status: false })
  }

  try {
    // If admin role, return all communities
    if (role === "admin") {
      const communitiesRef = db.collection("communities")
      const snapshot = await communitiesRef.orderBy("createdAt", "desc").get()

      if (snapshot.empty) {
        return res.status(200).json({
          message: "No communities found",
          communities: [],
          totalCommunities: 0,
          status: true,
        })
      }

      const communities = []
      snapshot.forEach((doc) => {
        communities.push({
          id: doc.id,
          ...doc.data(),
          // Handle Firestore Timestamps if present
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
        })
      })

      return res.status(200).json({
        message: `Retrieved ${communities.length} communities (admin access)`,
        communities: communities,
        totalCommunities: communities.length,
        status: true,
      })
    }

    // For non-admin users, get their specific assignments
    const mailRef = db.collection("MailDB")
    const userSnapshot = await mailRef.where("email", "==", email).get()

    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found.", status: false })
    }

    const userData = userSnapshot.docs[0].data()
    const userCommunityIds = userData.communities || []

    if (userCommunityIds.length === 0) {
      return res.status(200).json({
        message: "No communities assigned to this user",
        communities: [],
        totalCommunities: 0,
        status: true,
      })
    }

    // Get only the communities assigned to this user
    const communitiesRef = db.collection("communities")
    const assignedCommunities = []

    // NOTE: Using `where(admin.firestore.FieldPath.documentId(), 'in', userCommunityIds)` is more efficient for large lists (up to 10 IDs), but a loop is used here to match the original logic and accommodate potential building filtering.
    for (const communityId of userCommunityIds) {
      const communityDoc = await communitiesRef.doc(communityId).get()
      if (communityDoc.exists) {
        const communityData = communityDoc.data()

        // Filter buildings based on user's building assignments
        const userBuildingIds = userData.buildings?.[communityId] || [] // Use optional chaining for safer access
        let filteredBuildings = communityData.buildings || []

        if (userBuildingIds.length > 0) {
          filteredBuildings = communityData.buildings.filter((building) =>
            userBuildingIds.includes(building.id || building), // Assuming building is either an object with .id or just the name/ID string
          )
        }

        assignedCommunities.push({
          id: communityDoc.id,
          ...communityData,
          buildings: filteredBuildings,
          createdAt: communityData.createdAt?.toDate?.() || communityData.createdAt,
          updatedAt: communityData.updatedAt?.toDate?.() || communityData.updatedAt,
        })
      }
    }

    res.status(200).json({
      message: `Retrieved ${assignedCommunities.length} assigned communities`,
      communities: assignedCommunities,
      totalCommunities: assignedCommunities.length,
      status: true,
    })
  } catch (error) {
    console.error("Error retrieving communities:", error)
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    })
  }
}

// GET endpoint to retrieve a specific community by ID
exports.getCommunityById = async (req, res) => {
  const { communityId } = req.params

  if (!communityId) {
    return res.status(400).json({
      message: "Community ID is required.",
      status: false,
    })
  }

  try {
    const communityRef = db.collection("communities").doc(communityId)
    const communityDoc = await communityRef.get()

    if (!communityDoc.exists) {
      return res.status(404).json({
        message: `Community not found with ID: ${communityId}`,
        status: false,
      })
    }

    const communityData = {
      id: communityDoc.id,
      ...communityDoc.data(),
      createdAt: communityDoc.data().createdAt?.toDate?.() || communityDoc.data().createdAt,
      updatedAt: communityDoc.data().updatedAt?.toDate?.() || communityDoc.data().updatedAt,
    }

    res.status(200).json({
      message: `Community retrieved successfully`,
      community: communityData,
      status: true,
    })
  } catch (error) {
    console.error("Error retrieving community:", error)
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    })
  }
}

// PUT endpoint to update a community
exports.updateCommunity = async (req, res) => {
  const { communityId } = req.params
  const { communityName, description, updatedBy, isActive } = req.body

  if (!communityId) {
    return res.status(400).json({
      message: "Community ID is required.",
      status: false,
    })
  }

  try {
    const communityRef = db.collection("communities").doc(communityId)
    const communityDoc = await communityRef.get()

    if (!communityDoc.exists) {
      return res.status(404).json({
        message: `Community not found with ID: ${communityId}`,
        status: false,
      })
    }

    // Check if new community name already exists (if name is being changed)
    if (communityName && communityName.trim() !== communityDoc.data().communityName) {
      const existingCommunity = await db.collection("communities").where("communityName", "==", communityName.trim()).get()

      if (!existingCommunity.empty) {
        return res.status(409).json({
          message: "Community with this name already exists.",
          status: false,
        })
      }
    }

    const updateData = {
      updatedAt: new Date(),
      updatedBy: updatedBy || "system",
    }

    if (communityName !== undefined) updateData.communityName = communityName.trim()
    if (description !== undefined) updateData.description = description?.trim()
    if (isActive !== undefined) updateData.isActive = isActive

    await communityRef.update(updateData)

    // Get updated document
    const updatedDoc = await communityRef.get()
    const updatedCommunityData = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data().createdAt?.toDate?.() || updatedDoc.data().createdAt,
      updatedAt: updatedDoc.data().updatedAt?.toDate?.() || updatedDoc.data().updatedAt,
    }

    res.status(200).json({
      message: `Community updated successfully`,
      community: updatedCommunityData,
      status: true,
    })
  } catch (error) {
    console.error("Error updating community:", error)
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    })
  }
}

// DELETE endpoint to delete a community
exports.deleteCommunity = async (req, res) => {
  const { communityId } = req.params

  if (!communityId) {
    return res.status(400).json({
      message: "Community ID is required.",
      status: false,
    })
  }

  try {
    const communityRef = db.collection("communities").doc(communityId)
    const communityDoc = await communityRef.get()

    if (!communityDoc.exists) {
      return res.status(404).json({
        message: `Community not found with ID: ${communityId}`,
        status: false,
      })
    }

    const communityData = communityDoc.data()

    // Check if community has buildings assigned
    if (communityData.buildings && communityData.buildings.length > 0) {
      return res.status(400).json({
        message: `Cannot delete community. ${communityData.buildings.length} buildings are still assigned to this community. Please reassign or remove buildings first.`,
        assignedBuildings: communityData.buildings,
        status: false,
      })
    }

    // Delete the community
    await communityRef.delete()

    res.status(200).json({
      message: `Community '${communityData.communityName}' deleted successfully`,
      deletedCommunity: {
        id: communityId,
        communityName: communityData.communityName,
      },
      status: true,
    })
  } catch (error) {
    console.error("Error deleting community:", error)
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    })
  }
}

// POST endpoint to assign buildings to a community
exports.assignBuildingsToCommunity = async (req, res) => {
  const { communityId } = req.params
  const { buildings, updatedBy } = req.body

  if (!communityId) {
    return res.status(400).json({
      message: "Community ID is required.",
      status: false,
    })
  }

  if (!buildings || !Array.isArray(buildings)) {
    return res.status(400).json({
      message: "Buildings array is required.",
      status: false,
    })
  }

  try {
    const communityRef = db.collection("communities").doc(communityId)
    const communityDoc = await communityRef.get()

    if (!communityDoc.exists) {
      return res.status(404).json({
        message: `Community not found with ID: ${communityId}`,
        status: false,
      })
    }

    // Validate that all buildings exist and update their community info
    const buildingUpdatePromises = buildings.map(async (buildingName) => {
      const buildingCollectionName = getBuildingCollectionName(buildingName)

      try {
        const buildingDetailsRef = db.collection(buildingCollectionName).doc("buildingDetails")
        const buildingDoc = await buildingDetailsRef.get()

        if (!buildingDoc.exists) {
          throw new Error(`Building ${buildingName} does not exist (collection: ${buildingCollectionName})`)
        }

        // Update building with community information
        await buildingDetailsRef.update({
          communityId: communityId,
          communityName: communityDoc.data().communityName,
          updatedAt: new Date(),
        })

        return { buildingName, success: true }
      } catch (error) {
        return { buildingName, success: false, error: error.message }
      }
    })

    const buildingResults = await Promise.all(buildingUpdatePromises)
    const failedBuildings = buildingResults.filter((result) => !result.success)

    if (failedBuildings.length > 0) {
      // Revert community assignment for successful ones is complex, so for now, we return 400.
      return res.status(400).json({
        message: "Some buildings could not be assigned. No changes were made to the community.",
        failedBuildings: failedBuildings,
        status: false,
      })
    }

    // Get current buildings in community and merge with new ones
    const currentBuildings = communityDoc.data().buildings || []
    // Filter out potential duplicates if `buildings` array contains objects with an 'id' property
    const buildingsToAssign = buildings.map(b => (typeof b === 'object' && b !== null) ? (b.id || b.buildingName) : b).filter(Boolean);

    const allBuildings = [...new Set([...currentBuildings, ...buildingsToAssign])] // Remove duplicates

    // Update community with new buildings
    const updateData = {
      buildings: allBuildings,
      totalBuildings: allBuildings.length,
      updatedAt: new Date(),
      updatedBy: updatedBy || "system",
    }

    await communityRef.update(updateData)

    // Get updated community data
    const updatedDoc = await communityRef.get()
    const updatedCommunityData = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data().createdAt?.toDate?.() || updatedDoc.data().createdAt,
      updatedAt: updatedDoc.data().updatedAt?.toDate?.() || updatedDoc.data().updatedAt,
    }

    res.status(200).json({
      message: `Successfully assigned ${buildings.length} buildings to community '${communityDoc.data().communityName}'`,
      community: updatedCommunityData,
      assignedBuildings: buildings,
      status: true,
    })
  } catch (error) {
    console.error("Error assigning buildings to community:", error)
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    })
  }
}

// POST endpoint to remove buildings from a community
exports.removeBuildingsFromCommunity = async (req, res) => {
  const { communityId } = req.params
  const { buildings, updatedBy } = req.body

  if (!communityId) {
    return res.status(400).json({
      message: "Community ID is required.",
      status: false,
    })
  }

  if (!buildings || !Array.isArray(buildings)) {
    return res.status(400).json({
      message: "Buildings array is required.",
      status: false,
    })
  }

  try {
    const communityRef = db.collection("communities").doc(communityId)
    const communityDoc = await communityRef.get()

    if (!communityDoc.exists) {
      return res.status(404).json({
        message: `Community not found with ID: ${communityId}`,
        status: false,
      })
    }

    const currentBuildings = communityDoc.data().buildings || []
    
    // Ensure `buildings` passed in the body is an array of names/IDs
    const buildingsToRemove = buildings.map(b => (typeof b === 'object' && b !== null) ? (b.id || b.buildingName) : b).filter(Boolean);

    // Filter out the buildings to be removed
    const remainingBuildings = currentBuildings.filter((building) => !buildingsToRemove.includes(building))

    // Update community with remaining buildings
    const updateData = {
      buildings: remainingBuildings,
      totalBuildings: remainingBuildings.length,
      updatedAt: new Date(),
      updatedBy: updatedBy || "system",
    }

    await communityRef.update(updateData)

    // Remove community reference from buildings
    const buildingUpdatePromises = buildingsToRemove.map(async (buildingName) => {
      const buildingCollectionName = getBuildingCollectionName(buildingName)

      try {
        const buildingDetailsRef = db.collection(buildingCollectionName).doc("buildingDetails")
        const buildingDoc = await buildingDetailsRef.get()

        if (buildingDoc.exists) {
          // NOTE: Update logic is a simple removal of community info
          await buildingDetailsRef.update({
            communityId: null, // Set to null/undefined to mark as unassigned
            communityName: "Not Assigned",
            updatedAt: new Date(),
          })
        }
      } catch (error) {
        // Log the error but don't stop the main process
        console.error(`Error updating building ${buildingName} upon removal:`, error)
      }
    })

    await Promise.all(buildingUpdatePromises)

    // Get updated community data
    const updatedDoc = await communityRef.get()
    const updatedCommunityData = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data().createdAt?.toDate?.() || updatedDoc.data().createdAt,
      updatedAt: updatedDoc.data().updatedAt?.toDate?.() || updatedDoc.data().updatedAt,
    }

    res.status(200).json({
      message: `Successfully removed ${buildingsToRemove.length} buildings from community '${communityDoc.data().communityName}'`,
      community: updatedCommunityData,
      removedBuildings: buildingsToRemove,
      status: true,
    })
  } catch (error) {
    console.error("Error removing buildings from community:", error)
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    })
  }
}

// POST endpoint to get all available buildings with their community status
exports.getBuildingsWithCommunityStatus = async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({
      message: "Email is required.",
      status: false,
    })
  }

  try {
    const userRef = db.collection("UserDB")
    const userSnapshot = await userRef.where("email", "==", email).get()

    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found.", status: false })
    }

    const userData = userSnapshot.docs[0].data()
    let buildingNames = []

    if (userData.role === "admin") {
      // NOTE: db.listCollections() is a costly operation and should be used cautiously
      const collections = await db.listCollections()
      buildingNames = collections
        .map((col) => col.id)
        .filter((name) => name.endsWith("BuildingDB") || name === "areej5")
        .map((name) => name.replace("BuildingDB", "")) // Remove suffix for building name
    } else {
      buildingNames = userData.buildings || []
    }

    // Get building details with community information
    const buildingDetailsPromises = buildingNames.map(async (buildingName) => {
      const buildingCollectionName = getBuildingCollectionName(buildingName)

      try {
        const buildingDetailsRef = db.collection(buildingCollectionName).doc("buildingDetails")
        const buildingDoc = await buildingDetailsRef.get()

        if (buildingDoc.exists) {
          const data = buildingDoc.data()
          return {
            buildingName: buildingName,
            communityId: data.communityId || null,
            communityName: data.communityName || "Not Assigned",
            ...data,
          }
        } else {
          // Building collection exists but buildingDetails doc does not
          return {
            buildingName: buildingName,
            communityId: null,
            communityName: "Not Assigned",
          }
        }
      } catch (error) {
        console.error(`Error fetching details for building ${buildingName}:`, error)
        return {
          buildingName: buildingName,
          communityId: null,
          communityName: "Not Assigned",
        }
      }
    })

    const buildingsWithCommunity = await Promise.all(buildingDetailsPromises)

    res.status(200).json({
      message: "Buildings with community status retrieved successfully",
      buildings: buildingsWithCommunity,
      totalBuildings: buildingsWithCommunity.length,
      status: true,
    })
  } catch (error) {
    console.error("Error fetching buildings with community status:", error)
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    })
  }
}

// GET endpoint to get all available buildings (not assigned to any community)
exports.getUnassignedBuildings = async (req, res) => {
  try {
    // Get all collections that end with BuildingDB
    // NOTE: db.listCollections() is a costly operation and should be used cautiously
    const collections = await db.listCollections()
    const buildingCollectionNames = collections
      .map((col) => col.id)
      .filter((name) => name.endsWith("BuildingDB") || name === "areej5")

    const unassignedBuildings = []

    // Check each building's community status
    // NOTE: This performs a read per building and can be slow/costly for many buildings
    for (const collectionName of buildingCollectionNames) {
      try {
        const buildingDetailsRef = db.collection(collectionName).doc("buildingDetails")
        const buildingDoc = await buildingDetailsRef.get()

        if (buildingDoc.exists) {
          const data = buildingDoc.data()
          const buildingName = collectionName.replace("BuildingDB", "")

          // If no communityId (null, undefined, or empty string), it's unassigned
          if (!data.communityId) {
            unassignedBuildings.push({
              buildingName: buildingName,
              communityName: data.communityName || "Not Assigned",
              ...data,
            })
          }
        }
      } catch (error) {
        console.error(`Error checking building ${collectionName}:`, error)
      }
    }

    res.status(200).json({
      message: `Found ${unassignedBuildings.length} unassigned buildings`,
      buildings: unassignedBuildings,
      totalBuildings: unassignedBuildings.length,
      status: true,
    })
  } catch (error) {
    console.error("Error retrieving unassigned buildings:", error)
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    })
  }
}

// GET endpoint to get buildings by community
exports.getCommunityBuildings = async (req, res) => {
  const { communityId } = req.params

  if (!communityId) {
    return res.status(400).json({
      message: "Community ID is required.",
      status: false,
    })
  }

  try {
    const communityRef = db.collection("communities").doc(communityId)
    const communityDoc = await communityRef.get()

    if (!communityDoc.exists) {
      return res.status(404).json({
        message: `Community not found with ID: ${communityId}`,
        status: false,
      })
    }

    const communityData = communityDoc.data()
    const buildingNames = communityData.buildings || []

    // Get detailed information for each building
    const buildingDetailsPromises = buildingNames.map(async (buildingName) => {
      const buildingCollectionName = getBuildingCollectionName(buildingName)

      try {
        const buildingDetailsRef = db.collection(buildingCollectionName).doc("buildingDetails")
        const buildingDoc = await buildingDetailsRef.get()

        if (buildingDoc.exists) {
          return {
            buildingName: buildingName,
            communityId: communityId,
            communityName: communityData.communityName,
            ...buildingDoc.data(),
          }
        } else {
          // Building is listed in community but its collection/doc is missing
          return {
            buildingName: buildingName,
            communityId: communityId,
            communityName: communityData.communityName,
            // You might want to include a warning here
            warning: "Building details document not found",
          }
        }
      } catch (error) {
        console.error(`Error fetching details for building ${buildingName}:`, error)
        return {
          buildingName: buildingName,
          communityId: communityId,
          communityName: communityData.communityName,
          error: "Failed to fetch building details",
        }
      }
    })

    const communityBuildings = await Promise.all(buildingDetailsPromises)

    res.status(200).json({
      message: `Found ${communityBuildings.length} buildings in community`,
      buildings: communityBuildings,
      totalBuildings: communityBuildings.length,
      communityId: communityId,
      status: true,
    })
  } catch (error) {
    console.error("Error retrieving community buildings:", error)
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    })
  }
}