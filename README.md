# AI StudyBuddy Backend

An AI-powered learning backend REST API. Students register, log in, manage study
materials, and generate AI summaries, flashcards, quizzes, and personalized study
plans using Google Gemini. Admins can view/manage users and monitor system
statistics and activity.

**This is a backend-only project.** There is no frontend, no HTML/CSS, and no UI.
Test it with Postman, Thunder Client, curl, or any REST client.

---

## 1. Project Description

AI StudyBuddy exposes a JSON REST API for:

- JWT-based authentication (register/login) with role-based access control
  (`student` / `admin`)
- CRUD management of study materials (text input or file upload)
- AI-generated summaries, flashcards, quizzes, and study plans via the Gemini API
- Strict ownership enforcement — students can only ever see their own materials
  and AI resources
- Admin endpoints for user management and system statistics

---

## 2. Backend Architecture

Layered MVC-style architecture:

```
Request → Express → CORS/JSON middleware → auth (JWT) → role (RBAC, admin routes)
        → controller (ownership checks) → model / geminiService → MongoDB / Gemini
        → JSON response → errorHandler (on failure)
```

- **Routes** wire URLs to controllers and apply `auth`/`role` middleware.
- **Controllers** contain request handling, validation, and ownership checks.
- **Models** define Mongoose schemas and relationships.
- **Services** (`geminiService.js`) isolate all Gemini API calls — controllers
  never talk to the AI SDK directly.
- **Middleware** handles authentication, authorization, file uploads, and
  centralized error responses.

---

## 3. Technology Stack

- Node.js + Express.js
- MongoDB + Mongoose
- JWT (`jsonwebtoken`) for authentication
- `bcryptjs` for password hashing
- `cors`, `dotenv`
- `multer` for file uploads
- `@google/genai` (Google Gemini) for AI generation
- `nodemon` for development

---

## 4. Folder Structure

```text
AI-StudyBuddy-Backend/
├── index.js
├── package.json
├── .env / .env.example
├── .gitignore
└── src/
    ├── config/db.js
    ├── models/            User, Material, Summary, Flashcard, Quiz, StudyPlan
    ├── controllers/       authController, materialController, aiController, adminController
    ├── routes/            authRoutes, materialRoutes, aiRoutes, adminRoutes
    ├── middleware/        auth, role, upload, errorHandler
    ├── services/          geminiService
    └── utils/             generateToken, asyncHandler
```

---

## 5. MongoDB Setup

1. Install MongoDB locally, or use a hosted instance (e.g. MongoDB Atlas).
2. Local default connection string (used in `.env.example`):
   ```
   mongodb://127.0.0.1:27017/ai_studybuddy
   ```
3. Start MongoDB locally with `mongod` (or ensure your Atlas cluster is running),
   then set `MONGO_URI` in `.env` accordingly.

No manual schema setup is required — Mongoose creates collections automatically
on first write.

---

## 6. Gemini API Setup

1. Get an API key from Google AI Studio.
2. Set `GEMINI_API_KEY` in `.env`.
3. Optionally set `GEMINI_MODEL` (defaults to `gemini-2.0-flash`).
4. The key is only ever read server-side in `src/services/geminiService.js` and
   is never included in any API response.

---

## 7. Environment Variables

Copy `.env.example` to `.env` and fill in real values:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/ai_studybuddy
JWT_SECRET=replace_with_secure_secret
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=replace_with_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash
NODE_ENV=development
MAX_FILE_SIZE_MB=10
```

`.env` is listed in `.gitignore` and must never be committed.

---

## 8. Installation

```bash
cd AI-StudyBuddy-Backend
npm install
cp .env.example .env   # then edit .env with real values
```

---

## 9. Running the Server

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

Health check:

```bash
curl http://localhost:5000/api/health
```

Expected response:

```json
{ "success": true, "message": "AI StudyBuddy API is running" }
```

---

## 10. Authentication

All protected routes require:

```
Authorization: Bearer <JWT_TOKEN>
```

Tokens are issued at login and expire per `JWT_EXPIRES_IN`. Admin-only routes
additionally require the authenticated user's `role` to be `admin` (returns
`403 Forbidden` otherwise).

---

## 11 & 12. API Endpoints, Requests & Responses

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a new student |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Get current user |

**Register**
```json
POST /api/auth/register
{ "name": "Rahul", "email": "rahul@example.com", "password": "Password123" }
```
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": { "user": { "id": "...", "name": "Rahul", "email": "rahul@example.com", "role": "student" } }
}
```

**Login**
```json
POST /api/auth/login
{ "email": "rahul@example.com", "password": "Password123" }
```
```json
{
  "success": true,
  "message": "Login successful",
  "data": { "token": "...", "user": { "id": "...", "name": "Rahul", "email": "rahul@example.com", "role": "student" } }
}
```

### Materials (JWT required)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/material/upload` | Create material (JSON text or multipart file) |
| GET | `/api/material` | List your materials |
| GET | `/api/material/:id` | Get one material (ownership enforced) |
| PUT | `/api/material/:id` | Update your material |
| DELETE | `/api/material/:id` | Delete your material (+ its AI resources) |

**Create (text)**
```json
POST /api/material/upload
{ "title": "Data Structures", "subject": "Computer Science", "content": "Binary trees are..." }
```

**Create (file)** — `multipart/form-data` with fields `title`, `subject`, and file field `file`
(pdf/doc/docx/txt, size limited by `MAX_FILE_SIZE_MB`). Note: file **content extraction is not
implemented** — the file is stored and its metadata recorded; AI generation requires text
`content` (from the JSON flow) since no parser is wired up.

### AI (JWT required)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/materials/:id/summarize` | Generate + save a summary for a material |
| POST | `/api/ai/flashcards` | Generate + save flashcards for a material |
| POST | `/api/ai/quiz` | Generate + save a quiz for a material |
| POST | `/api/ai/study-plan` | Generate + save a personalized study plan |
| GET | `/api/ai/resources` | Retrieve all of your AI-generated resources |

**Flashcards**
```json
POST /api/ai/flashcards
{ "materialId": "64f...", "count": 10 }
```
```json
{ "success": true, "message": "Flashcards generated successfully", "data": { "flashcards": [ { "question": "...", "answer": "..." } ], "count": 10 } }
```

**Quiz**
```json
POST /api/ai/quiz
{ "materialId": "64f...", "numberOfQuestions": 10 }
```

**Study Plan**
```json
POST /api/ai/study-plan
{
  "subject": "Data Structures",
  "examDate": "2026-12-10",
  "availableStudyTime": 3,
  "learningGoals": ["Understand trees", "Practice graph algorithms"]
}
```

### Admin (JWT + admin role required)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/users?page=1&limit=10` | Paginated user list |
| GET | `/api/admin/users/:id` | User detail + usage stats |
| DELETE | `/api/admin/users/:id` | Delete a user and their data |
| GET | `/api/admin/stats` | System-wide counts (computed live from DB) |
| GET | `/api/admin/activity?limit=20` | Recent activity feed across collections |

To create your first admin, register normally then manually update that user's
`role` to `"admin"` in MongoDB (e.g. via `mongosh` or Compass) — there is
intentionally no public "become admin" endpoint.

---

## 13. Postman Testing

1. **Register** a user via `POST /api/auth/register`.
2. **Login** via `POST /api/auth/login` → copy the `token` from the response.
3. In Postman, set header `Authorization: Bearer <token>` on all subsequent
   requests (or use a Postman environment variable + Bearer Token auth type).
4. **Create a material** via `POST /api/material/upload` (JSON body with
   `title`, `subject`, `content`) → copy the returned `material._id`.
5. **Generate AI resources**: use that ID in `POST /api/materials/:id/summarize`,
   `POST /api/ai/flashcards`, `POST /api/ai/quiz`.
6. **Admin flow**: promote a user to `admin` in MongoDB, log in as that user,
   then call the `/api/admin/*` endpoints with their token.

Suggested Postman collection folders: `Auth`, `Materials`, `AI`, `Admin` — one
request per endpoint listed above, each with the `Authorization` header set
where required.

---

## 14. Error Handling

All errors flow through `src/middleware/errorHandler.js` and return:

```json
{ "success": false, "message": "Description of what went wrong" }
```

Status codes used: `200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`, `500`
(plus `502`/`429` for upstream Gemini failures). Stack traces are only included
in non-production responses.

---

## 15. Security

- Passwords hashed with `bcryptjs`, never returned in responses (`select: false`
  + safe serialization)
- JWT-based auth on all protected routes; expired/invalid tokens rejected
- Role-based access control for admin routes
- Ownership checks on every material/AI-resource read, update, and delete
- `GEMINI_API_KEY`, `JWT_SECRET`, `MONGO_URI` read only from environment
  variables, never hard-coded, never exposed in responses
- File upload MIME-type allowlist and size limit via Multer
- Centralized error handler prevents stack-trace/secret leakage in production
- CORS enabled; JSON body size limited

---

## 16. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `MongoDB connection error` on startup | MongoDB not running / wrong `MONGO_URI` | Start `mongod` or check your Atlas connection string |
| `401 Not authorized` on protected routes | Missing/expired/invalid JWT | Log in again and use the fresh token in the `Authorization` header |
| `403 Forbidden` on admin routes | User role is `student` | Promote the user to `admin` in MongoDB |
| `Gemini API key is not configured` | `GEMINI_API_KEY` missing in `.env` | Add a valid key and restart the server |
| `Gemini returned malformed JSON` | Occasional model formatting issue | Retry the request; the service already strips Markdown fences before parsing |
| `422` on material creation | Missing `content` for a text-only material, or unsupported file type | Provide `content`, or upload an allowed file type within the size limit |
| File upload rejected | File exceeds `MAX_FILE_SIZE_MB` or wrong MIME type | Increase the env limit or use an allowed file type (`txt`, `pdf`, `doc`, `docx`) |

---

## License

ISC
