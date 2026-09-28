const mongoose = require("mongoose");
const User = require("../models/User");
const Material = require("../models/Material");
const Summary = require("../models/Summary");
const Flashcard = require("../models/Flashcard");
const Quiz = require("../models/Quiz");
const StudyPlan = require("../models/StudyPlan");
const asyncHandler = require("../utils/asyncHandler");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// @route  GET /api/admin/users
// @access Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    message: "Users retrieved successfully",
    data: {
      users: users.map((u) => u.toSafeObject()),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

// @route  GET /api/admin/users/:id
// @access Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    const error = new Error("Invalid user ID");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(id);

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const [materialCount, summaryCount, flashcardCount, quizCount, studyPlanCount] = await Promise.all([
    Material.countDocuments({ userId: user._id }),
    Summary.countDocuments({ userId: user._id }),
    Flashcard.countDocuments({ userId: user._id }),
    Quiz.countDocuments({ userId: user._id }),
    StudyPlan.countDocuments({ userId: user._id }),
  ]);

  res.status(200).json({
    success: true,
    message: "User retrieved successfully",
    data: {
      user: user.toSafeObject(),
      stats: {
        materials: materialCount,
        summaries: summaryCount,
        flashcards: flashcardCount,
        quizzes: quizCount,
        studyPlans: studyPlanCount,
      },
    },
  });
});

// @route  DELETE /api/admin/users/:id
// @access Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    const error = new Error("Invalid user ID");
    error.statusCode = 400;
    throw error;
  }

  if (id === req.user._id.toString()) {
    const error = new Error(
      "Refusing to delete the currently authenticated admin account. Use a different admin account to perform this action."
    );
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(id);

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  // Cascade delete all data owned by this user.
  const materials = await Material.find({ userId: user._id }).select("_id");
  const materialIds = materials.map((m) => m._id);

  await Promise.all([
    Summary.deleteMany({ userId: user._id }),
    Flashcard.deleteMany({ userId: user._id }),
    Quiz.deleteMany({ userId: user._id }),
    StudyPlan.deleteMany({ userId: user._id }),
    Material.deleteMany({ _id: { $in: materialIds } }),
  ]);

  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: "User and all associated data deleted successfully",
    data: {},
  });
});

// @route  GET /api/admin/stats
// @access Private/Admin
const getStats = asyncHandler(async (req, res) => {
  const [
    users,
    students,
    admins,
    materials,
    summaries,
    flashcards,
    quizzes,
    studyPlans,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "student" }),
    User.countDocuments({ role: "admin" }),
    Material.countDocuments(),
    Summary.countDocuments(),
    Flashcard.countDocuments(),
    Quiz.countDocuments(),
    StudyPlan.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    message: "System statistics retrieved successfully",
    data: {
      users,
      students,
      admins,
      materials,
      summaries,
      flashcards,
      quizzes,
      studyPlans,
    },
  });
});

// @route  GET /api/admin/activity
// @access Private/Admin
// Builds a recent-activity feed from actual creation timestamps across
// collections (no separate activity-log collection is invented).
const getActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const [recentUsers, recentMaterials, recentSummaries, recentFlashcards, recentQuizzes, recentStudyPlans] =
    await Promise.all([
      User.find().sort({ createdAt: -1 }).limit(limit).select("name email role createdAt"),
      Material.find().sort({ createdAt: -1 }).limit(limit).select("title subject userId createdAt"),
      Summary.find().sort({ createdAt: -1 }).limit(limit).select("materialId userId createdAt"),
      Flashcard.find().sort({ createdAt: -1 }).limit(limit).select("materialId userId createdAt"),
      Quiz.find().sort({ createdAt: -1 }).limit(limit).select("materialId userId createdAt"),
      StudyPlan.find().sort({ createdAt: -1 }).limit(limit).select("subject userId createdAt"),
    ]);

  const events = [
    ...recentUsers.map((u) => ({
      type: "user_registered",
      timestamp: u.createdAt,
      details: { userId: u._id, name: u.name, email: u.email, role: u.role },
    })),
    ...recentMaterials.map((m) => ({
      type: "material_created",
      timestamp: m.createdAt,
      details: { materialId: m._id, userId: m.userId, title: m.title, subject: m.subject },
    })),
    ...recentSummaries.map((s) => ({
      type: "summary_generated",
      timestamp: s.createdAt,
      details: { summaryId: s._id, userId: s.userId, materialId: s.materialId },
    })),
    ...recentFlashcards.map((f) => ({
      type: "flashcard_generated",
      timestamp: f.createdAt,
      details: { flashcardId: f._id, userId: f.userId, materialId: f.materialId },
    })),
    ...recentQuizzes.map((q) => ({
      type: "quiz_generated",
      timestamp: q.createdAt,
      details: { quizId: q._id, userId: q.userId, materialId: q.materialId },
    })),
    ...recentStudyPlans.map((p) => ({
      type: "study_plan_generated",
      timestamp: p.createdAt,
      details: { studyPlanId: p._id, userId: p.userId, subject: p.subject },
    })),
  ]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);

  res.status(200).json({
    success: true,
    message: "Recent activity retrieved successfully",
    data: { events, count: events.length },
  });
});

module.exports = { getUsers, getUserById, deleteUser, getStats, getActivity };
