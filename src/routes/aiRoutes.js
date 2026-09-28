const express = require("express");
const {
  summarizeMaterial,
  createFlashcards,
  createQuiz,
  createStudyPlan,
  getMyResources,
} = require("../controllers/aiController");
const protect = require("../middleware/auth");

const router = express.Router();

router.use(protect);

// Summarization is nested under /materials/:id/summarize (per spec)
router.post("/materials/:id/summarize", summarizeMaterial);

// AI generation endpoints under /ai
router.post("/ai/flashcards", createFlashcards);
router.post("/ai/quiz", createQuiz);
router.post("/ai/study-plan", createStudyPlan);

// Retrieve all AI-generated resources for the authenticated user
router.get("/ai/resources", getMyResources);

module.exports = router;
