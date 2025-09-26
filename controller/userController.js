// controllers/authController.js
const { db } = require("../utils/db");
const bcrypt = require("bcryptjs");

// ---------------- Signup ----------------
exports.signup = async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res
      .status(400)
      .json({ message: "All fields are required.", status: false });
  }

  try {
    const mailRef = db.collection("MailDB");
    const mailSnapshot = await mailRef.where("email", "==", email).get();

    if (mailSnapshot.empty) {
      return res
        .status(403)
        .json({ message: "Email not allowed for signup.", status: false });
    }

    const allowedUserDoc = mailSnapshot.docs[0];
    const allowedUserData = allowedUserDoc.data();
    const allowedRole = allowedUserData.role;

    if (!allowedRole) {
      return res.status(403).json({
        message: "Email exists but no role assigned. Contact admin.",
        status: false,
      });
    }

    const userRef = db.collection("UserDB");
    const userSnapshot = await userRef.where("email", "==", email).get();

    if (!userSnapshot.empty) {
      return res
        .status(400)
        .json({ message: "Email already registered.", status: false });
    }

    // hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    await userRef.add({
      email,
      password: hashedPassword,
      name,
      role: allowedRole,
    });

    // Update MailDB doc
    await mailRef.doc(allowedUserDoc.id).update({ active: true });

    res.status(201).json({
      message: "User registered successfully. Email is now active.",
      status: true,
    });
  } catch (error) {
    console.error("Error during signup:", error);
    res
      .status(500)
      .json({ message: "Internal server error", status: false });
  }
};

// ---------------- Login ----------------
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required.", status: false });
  }

  try {
    const userRef = db.collection("UserDB");
    const snapshot = await userRef.where("email", "==", email).get();

    if (snapshot.empty) {
      return res
        .status(400)
        .json({ message: "Invalid email or password.", status: false });
    }

    const userData = snapshot.docs[0].data();

    console.log("Input password:", password, "Database password:", userData.password);


    // compare password with hashed password
    const isPasswordValid=password===userData.password;

    if (!isPasswordValid) {
      return res
        .status(400)
        .json({ message: "Invalid email or password.", status: false });
    }

    delete userData.password; // remove before sending response

    res.status(200).json({
      message: "Login successful.",
      user: userData,
      status: true,
    });
  } catch (error) {
    console.error("Error during login:", error);
    res
      .status(500)
      .json({ message: "Internal server error", status: false });
  }
};
