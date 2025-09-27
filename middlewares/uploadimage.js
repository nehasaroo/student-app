const multer = require("multer");
const path = require("path");

// Storage config
const storage = multer.memoryStorage(); 

// File filter (optional)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== ".png" && ext !== ".jpg" && ext !== ".jpeg") {
    return cb(new Error("Only images are allowed"), false);
  }
  cb(null, true);
};

// Multer upload middleware
const uploadimage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

module.exports = uploadimage;
