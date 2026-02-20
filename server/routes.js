const express = require("express");
const { login, fetchAttendance } = require("./scraper");
const { processAttendance } = require("./calculator");

const router = express.Router();

/**
 * POST /api/attendance
 * Body: { username, password } (optional — falls back to .env)
 * Returns: processed attendance data with skip calculations
 */
router.post("/attendance", async (req, res) => {
    try {
        const username = req.body.username || process.env.EGOV_USERNAME;
        const password = req.body.password || process.env.EGOV_PASSWORD;

        if (!username || !password) {
            return res.status(400).json({
                error:
                    "Username and password are required. Provide in request body or .env file.",
            });
        }

        console.log(`[INFO] Attempting login for user: ${username}`);

        // Step 1: Login
        const session = await login(username, password);
        console.log("[INFO] Login successful, fetching attendance...");

        // Step 2: Fetch raw attendance
        const rawAttendance = await fetchAttendance(session);
        console.log(
            `[INFO] Fetched attendance for ${rawAttendance.data.length} subjects`
        );

        // Step 3: Process with skip calculations
        const processed = processAttendance(rawAttendance);

        res.json({
            success: true,
            data: processed,
        });
    } catch (error) {
        console.error("[ERROR]", error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/health
 * Simple health check
 */
router.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

module.exports = router;
