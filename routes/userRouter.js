// userRouter.js
const express = require('express');
const router = express.Router();
const { signup, login } = require('../controller/userController.js');

// POST /signup route
router.post('/signup', signup);

// POST /login route
router.post('/login', login);

router.get("/test", (req, res) => {
  res.send("User router is working!");
});


module.exports = router;