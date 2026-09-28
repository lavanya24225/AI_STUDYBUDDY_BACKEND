const express = require("express");
const { getUsers, getUserById, deleteUser, getStats, getActivity } = require("../controllers/adminController");
const protect = require("../middleware/auth");
const requireRole = require("../middleware/role");

const router = express.Router();

router.use(protect, requireRole("admin"));

router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.delete("/users/:id", deleteUser);
router.get("/stats", getStats);
router.get("/activity", getActivity);

module.exports = router;
