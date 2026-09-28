const mongoose = require("mongoose");
const Material = require("../models/Material");
const Summary = require("../models/Summary");
const Flashcard = require("../models/Flashcard");
const Quiz = require("../models/Quiz");
const StudyPlan = require("../models/StudyPlan");
const geminiService = require("../services/geminiService");
const asyncHandler = require("../utils/asyncHandler");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Loads a material by ID and verifies it belongs to the requesting user.
 * Throws a normalized error (404 / 403 / 400) otherwise.
 */
const loadOwnedMaterial = async (materialId, userId) => {
  if (!isValidObjectId(materialId)) {
    const error = new Error("Invalid material ID");
    error.statusCode = 400;
    throw error;
  }

  const material = await Material.findById(materialId);

  if (!material) {
    const error = new Error("Material not found");
    error.statusCode = 404;
    throw error;
  }

  if (material.userId.toString() !== userId.toString()) {
    const error = new Error("Forbidden: you do not own this material");
    error.statusCode = 403;
    throw error;
  }

  if (!material.content || !material.content.trim()) {
    const error = new Error(
      "This material has no extractable text content to send to the AI. Add text content before generating AI resources."
    );
    error.statusCode = 422;
    throw error;
  }

  return material;
};

// @route  POST /api/materials/:id/summarize
// @access Private
const summarizeMaterial = asyncHandler(async (req, res) => {
  const material = await loadOwnedMaterial(req.params.id, req.user._id);

  const summaryText = await geminiService.generateSummary(material.content);

  const summary = await Summary.create({
    userId: req.user._id,
    materialId: material._id,
    summary: summaryText,
  });

  res.status(201).json({
    success: true,
    message: "Summary generated successfully",
    data: { summary },
  });
});

// @route  POST /api/ai/flashcards
// @access Private
const createFlashcards = asyncHandler(async (req, res) => {
  const { materialId, count } = req.body;

  if (!materialId) {
    const error = new Error("materialId is required");
    error.statusCode = 400;
    throw error;
  }

  if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > 50)) {
    const error = new Error("count must be an integer between 1 and 50");
    error.statusCode = 422;
    throw error;
  }

  const material = await loadOwnedMaterial(materialId, req.user._id);

  const flashcardsData = await geminiService.generateFlashcards(material.content, count || 10);

  const flashcardDocs = flashcardsData.map((card) => ({
    userId: req.user._id,
    materialId: material._id,
    question: card.question,
    answer: card.answer,
  }));

  const savedFlashcards = await Flashcard.insertMany(flashcardDocs);

  res.status(201).json({
    success: true,
    message: "Flashcards generated successfully",
    data: { flashcards: savedFlashcards, count: savedFlashcards.length },
  });
});

// @route  POST /api/ai/quiz
// @access Private
const createQuiz = asyncHandler(async (req, res) => {
  const { materialId, numberOfQuestions } = req.body;

  if (!materialId) {
    const error = new Error("materialId is required");
    error.statusCode = 400;
    throw error;
  }

  if (
    numberOfQuestions !== undefined &&
    (!Number.isInteger(numberOfQuestions) || numberOfQuestions < 1 || numberOfQuestions > 50)
  ) {
    const error = new Error("numberOfQuestions must be an integer between 1 and 50");
    error.statusCode = 422;
    throw error;
  }

  const material = await loadOwnedMaterial(materialId, req.user._id);

  const questions = await geminiService.generateQuiz(material.content, numberOfQuestions || 10);

  const quiz = await Quiz.create({
    userId: req.user._id,
    materialId: material._id,
    questions,
  });

  res.status(201).json({
    success: true,
    message: "Quiz generated successfully",
    data: { quiz },
  });
});

// @route  POST /api/ai/study-plan
// @access Private
const createStudyPlan = asyncHandler(async (req, res) => {
  const { subject, examDate, availableStudyTime, learningGoals } = req.body;

  if (!subject || !subject.trim()) {
    const error = new Error("subject is required");
    error.statusCode = 400;
    throw error;
  }

  if (availableStudyTime === undefined || Number.isNaN(Number(availableStudyTime))) {
    const error = new Error("availableStudyTime is required and must be a number");
    error.statusCode = 400;
    throw error;
  }

  if (learningGoals !== undefined && !Array.isArray(learningGoals)) {
    const error = new Error("learningGoals must be an array of strings");
    error.statusCode = 422;
    throw error;
  }

  const studyPlanText = await geminiService.generateStudyPlan({
    subject,
    examDate,
    availableStudyTime,
    learningGoals,
  });

  const studyPlan = await StudyPlan.create({
    userId: req.user._id,
    subject: subject.trim(),
    studyPlan: studyPlanText,
    examDate: examDate ? new Date(examDate) : null,
    availableStudyTime: Number(availableStudyTime),
    learningGoals: learningGoals || [],
  });

  res.status(201).json({
    success: true,
    message: "Study plan generated successfully",
    data: { studyPlan },
  });
});

// @route  GET /api/ai/resources
// @access Private
// Convenience endpoint to retrieve all AI-generated resources for the user.
const getMyResources = asyncHandler(async (req, res) => {
  const [summaries, flashcards, quizzes, studyPlans] = await Promise.all([
    Summary.find({ userId: req.user._id }).sort({ createdAt: -1 }),
    Flashcard.find({ userId: req.user._id }).sort({ createdAt: -1 }),
    Quiz.find({ userId: req.user._id }).sort({ createdAt: -1 }),
    StudyPlan.find({ userId: req.user._id }).sort({ createdAt: -1 }),
  ]);

  res.status(200).json({
    success: true,
    message: "AI resources retrieved successfully",
    data: { summaries, flashcards, quizzes, studyPlans },
  });
});

module.exports = {
  summarizeMaterial,
  createFlashcards,
  createQuiz,
  createStudyPlan,
  getMyResources,
};
