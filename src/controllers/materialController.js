const mongoose = require("mongoose");
const Material = require("../models/Material");
const Summary = require("../models/Summary");
const Flashcard = require("../models/Flashcard");
const Quiz = require("../models/Quiz");
const asyncHandler = require("../utils/asyncHandler");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// @route  POST /api/material/upload
// @access Private
const createMaterial = asyncHandler(async (req, res) => {
  const { title, subject, content } = req.body;

  if (!title || !subject) {
    const error = new Error("Title and subject are required");
    error.statusCode = 400;
    throw error;
  }

  const materialData = {
    userId: req.user._id,
    title: title.trim(),
    subject: subject.trim(),
  };

  if (req.file) {
    materialData.fileName = req.file.originalname;
    materialData.fileType = req.file.mimetype;
    materialData.filePath = req.file.path;

    if (content) {
      materialData.content = content.trim();
    }
  } else {
    if (!content || !content.trim()) {
      const error = new Error("Content is required when no file is uploaded");
      error.statusCode = 400;
      throw error;
    }

    materialData.content = content.trim();
  }

  const material = await Material.create(materialData);

  res.status(201).json({
    success: true,
    message: "Study material created successfully",
    data: {
      material,
    },
  });
});

// @route  GET /api/material
// @access Private
const getMaterials = asyncHandler(async (req, res) => {
  const materials = await Material.find({
    userId: req.user._id,
  }).sort({
    createdAt: -1,
  });

  res.status(200).json({
    success: true,
    message: "Study materials retrieved successfully",
    data: {
      materials,
      count: materials.length,
    },
  });
});

// @route  GET /api/material/:id
// @access Private
const getMaterialById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log("Requested Material ID:", id);
  console.log("Is valid ObjectId:", isValidObjectId(id));

  if (!isValidObjectId(id)) {
    const error = new Error("Invalid material ID");
    error.statusCode = 400;
    throw error;
  }

  const material = await Material.findOne({
    _id: new mongoose.Types.ObjectId(id),
    userId: req.user._id,
  });

  console.log(
    "Material found:",
    material ? material._id.toString() : "NOT FOUND"
  );

  if (!material) {
    const error = new Error("Material not found");
    error.statusCode = 404;
    throw error;
  }

  res.status(200).json({
    success: true,
    message: "Study material retrieved successfully",
    data: {
      material,
    },
  });
});

// @route  PUT /api/material/:id
// @access Private
const updateMaterial = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, subject, content } = req.body;

  if (!isValidObjectId(id)) {
    const error = new Error("Invalid material ID");
    error.statusCode = 400;
    throw error;
  }

  const material = await Material.findOne({
    _id: new mongoose.Types.ObjectId(id),
    userId: req.user._id,
  });

  if (!material) {
    const error = new Error("Material not found");
    error.statusCode = 404;
    throw error;
  }

  if (title) {
    material.title = title.trim();
  }

  if (subject) {
    material.subject = subject.trim();
  }

  if (typeof content === "string") {
    material.content = content.trim();
  }

  await material.save();

  res.status(200).json({
    success: true,
    message: "Study material updated successfully",
    data: {
      material,
    },
  });
});

// @route  DELETE /api/material/:id
// @access Private
const deleteMaterial = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    const error = new Error("Invalid material ID");
    error.statusCode = 400;
    throw error;
  }

  const material = await Material.findOne({
    _id: new mongoose.Types.ObjectId(id),
    userId: req.user._id,
  });

  if (!material) {
    const error = new Error("Material not found");
    error.statusCode = 404;
    throw error;
  }

  // Delete associated AI-generated resources
  await Promise.all([
    Summary.deleteMany({ materialId: material._id }),
    Flashcard.deleteMany({ materialId: material._id }),
    Quiz.deleteMany({ materialId: material._id }),
  ]);

  await material.deleteOne();

  res.status(200).json({
    success: true,
    message: "Study material and associated AI resources deleted successfully",
    data: {},
  });
});

module.exports = {
  createMaterial,
  getMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
};