const { GoogleGenAI } = require("@google/genai");

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const MAX_INPUT_CHARS = 30000; // guard against excessively large material content

let client = null;

const getClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error("Gemini API key is not configured on the server");
    error.statusCode = 500;
    throw error;
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
};

const guardInput = (text, fieldName = "content") => {
  if (!text || !text.trim()) {
    const error = new Error(`Cannot generate AI content: ${fieldName} is empty`);
    error.statusCode = 422;
    throw error;
  }
  if (text.length > MAX_INPUT_CHARS) {
    const error = new Error(
      `Cannot generate AI content: ${fieldName} exceeds the maximum allowed length of ${MAX_INPUT_CHARS} characters`
    );
    error.statusCode = 422;
    throw error;
  }
};

/**
 * Calls the Gemini API with a prompt and returns the raw text response.
 * Wraps network/API failures into a normalized, safe error.
 */
const callGemini = async (prompt) => {
  const ai = getClient();

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    });
  } catch (err) {
    const error = new Error(
      `Gemini API request failed: ${err.message || "unknown error"}`
    );
    error.statusCode = err.status === 429 ? 429 : 502;
    throw error;
  }

  const text = response?.text;

  if (!text || !text.trim()) {
    const error = new Error("Gemini returned an empty response");
    error.statusCode = 502;
    throw error;
  }

  return text.trim();
};

/**
 * Strips accidental Markdown code fences (```json ... ```) from a model response
 * and parses it as JSON. Throws a normalized error on malformed output.
 */
const parseJsonResponse = (rawText) => {
  let cleaned = rawText.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const error = new Error("Gemini returned malformed JSON that could not be parsed");
    error.statusCode = 502;
    throw error;
  }
};

// ---------------------------------------------------------------------------
// generateSummary
// ---------------------------------------------------------------------------
const generateSummary = async (materialContent) => {
  guardInput(materialContent, "material content");

  const prompt = `You are an expert study assistant. Read the following study material and produce a revision-friendly summary.

Return ONLY plain text (no JSON, no Markdown headers) containing:
1. A concise overall summary (2-4 paragraphs)
2. A "Key Concepts" list
3. A "Key Points" list
4. A short revision-friendly explanation in simple terms

Study material:
"""
${materialContent}
"""`;

  const text = await callGemini(prompt);
  return text;
};

// ---------------------------------------------------------------------------
// generateFlashcards
// ---------------------------------------------------------------------------
const generateFlashcards = async (materialContent, count) => {
  guardInput(materialContent, "material content");

  const safeCount = Math.min(Math.max(Number(count) || 10, 1), 50);

  const prompt = `You are an expert study assistant. Based on the study material below, generate exactly ${safeCount} flashcards to help a student memorize key facts and concepts.

Respond with ONLY valid JSON, no Markdown fences, no commentary, matching exactly this shape:
{
  "flashcards": [
    { "question": "string", "answer": "string" }
  ]
}

Study material:
"""
${materialContent}
"""`;

  const rawText = await callGemini(prompt);
  const parsed = parseJsonResponse(rawText);

  if (!parsed || !Array.isArray(parsed.flashcards)) {
    const error = new Error("Gemini flashcard response did not match the expected schema");
    error.statusCode = 502;
    throw error;
  }

  const validFlashcards = parsed.flashcards.filter(
    (card) =>
      card &&
      typeof card.question === "string" &&
      card.question.trim() &&
      typeof card.answer === "string" &&
      card.answer.trim()
  );

  if (validFlashcards.length === 0) {
    const error = new Error("Gemini did not return any valid flashcards");
    error.statusCode = 502;
    throw error;
  }

  return validFlashcards;
};

// ---------------------------------------------------------------------------
// generateQuiz
// ---------------------------------------------------------------------------
const generateQuiz = async (materialContent, numberOfQuestions) => {
  guardInput(materialContent, "material content");

  const safeCount = Math.min(Math.max(Number(numberOfQuestions) || 10, 1), 50);

  const prompt = `You are an expert study assistant. Based on the study material below, generate a multiple-choice quiz with exactly ${safeCount} questions.

Rules:
- Each question must have exactly 4 options.
- correctAnswer must be exactly equal to one of the 4 options (verbatim).
- Provide a short explanation for why the correct answer is correct.

Respond with ONLY valid JSON, no Markdown fences, no commentary, matching exactly this shape:
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string",
      "explanation": "string"
    }
  ]
}

Study material:
"""
${materialContent}
"""`;

  const rawText = await callGemini(prompt);
  const parsed = parseJsonResponse(rawText);

  if (!parsed || !Array.isArray(parsed.questions)) {
    const error = new Error("Gemini quiz response did not match the expected schema");
    error.statusCode = 502;
    throw error;
  }

  const validQuestions = parsed.questions.filter(
    (q) =>
      q &&
      typeof q.question === "string" &&
      q.question.trim() &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.every((opt) => typeof opt === "string" && opt.trim()) &&
      typeof q.correctAnswer === "string" &&
      q.options.includes(q.correctAnswer) &&
      typeof q.explanation === "string" &&
      q.explanation.trim()
  );

  if (validQuestions.length === 0) {
    const error = new Error("Gemini did not return any valid quiz questions");
    error.statusCode = 502;
    throw error;
  }

  return validQuestions;
};

// ---------------------------------------------------------------------------
// generateStudyPlan
// ---------------------------------------------------------------------------
const generateStudyPlan = async ({ subject, examDate, availableStudyTime, learningGoals }) => {
  guardInput(subject, "subject");

  const goalsText =
    Array.isArray(learningGoals) && learningGoals.length > 0
      ? learningGoals.join(", ")
      : "Not specified";

  const prompt = `You are an expert academic study planner. Create a personalized, actionable study plan.

Subject: ${subject}
Exam date: ${examDate || "Not specified"}
Available study time: ${availableStudyTime || "Not specified"} hours per day
Learning goals: ${goalsText}

Return ONLY plain text (no JSON, no Markdown headers) with:
1. A day-by-day or week-by-week schedule appropriate to the time available before the exam
2. Specific topics/milestones to cover in each session
3. Recommended revision and practice strategies
4. Tips tailored to the stated learning goals`;

  const text = await callGemini(prompt);
  return text;
};

module.exports = {
  generateSummary,
  generateFlashcards,
  generateQuiz,
  generateStudyPlan,
};
