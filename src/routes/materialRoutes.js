const express = require("express");

const {
  createMaterial,
  getMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
} = require("../controllers/materialController");

const protect = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

// All material routes require authentication
router.use(protect);

// Create/upload a study material
// Supports JSON text-only requests or multipart/form-data with a "file" field
router.post("/upload", upload.single("file"), createMaterial);

// Get all study materials
router.get("/", getMaterials);

// Get one study material
router.get("/:id", getMaterialById);

// Update a study material
router.put("/:id", updateMaterial);

// Delete a study material
router.delete("/:id", deleteMaterial);

module.exports = router;