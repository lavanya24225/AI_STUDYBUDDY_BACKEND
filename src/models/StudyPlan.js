const mongoose = require("mongoose");

const studyPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    studyPlan: {
      type: String,
      required: true,
    },
    examDate: {
      type: Date,
      default: null,
    },
    availableStudyTime: {
      type: Number, // hours per day/week, as supplied by the user
      required: true,
    },
    learningGoals: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudyPlan", studyPlanSchema);
