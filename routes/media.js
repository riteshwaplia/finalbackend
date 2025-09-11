const express = require("express");
const multer = require("multer");
const mediaController = require("../controllers/mediaController");
const { protect } = require('../middleware/auth');

const router = express.Router();
const upload = multer();

// Upload image
router.post("/upload", protect, upload.single("file"), mediaController.uploadController);

// Get all user images
router.get("/", protect, mediaController.getAllController);

// Delete an image
router.delete("/:id", protect, mediaController.deleteController);

module.exports = router;
