const { Redis } = require("@upstash/redis");

// ===== ROLL NUMBER PARSER =====
function parseRollNumber(rollNumber) {
    if (!rollNumber || typeof rollNumber !== "string") return null;

    const cleaned = rollNumber.trim().toUpperCase();
    // Pattern: 2-digit year + 2-3 letter dept code + digits
    const match = cleaned.match(/^(\d{2})([A-Z]{2,3})(\d+)$/);
    if (!match) return null;

    const admissionYear = parseInt(match[1]);
    const department = match[2];
    const studentNum = match[3];

    // Derive current year of study
    // Academic year starts in July: if current month >= 7, academic year = current calendar year
    // e.g. in Feb 2026, academic year is 2025-26, so academic start = 2025
    const now = new Date();
    const currentCalYear = now.getFullYear() % 100; // e.g. 26
    const currentMonth = now.getMonth() + 1; // 1-12
    const academicStartYear = currentMonth >= 7 ? currentCalYear : currentCalYear - 1;
    const yearOfStudy = academicStartYear - admissionYear + 1;

    return {
        raw: cleaned,
        admissionYear: 2000 + admissionYear,
        department,
        studentNum,
        yearOfStudy: Math.max(1, Math.min(yearOfStudy, 6)), // clamp 1-6
    };
}

// ===== REDIS CLIENT =====
function getRedis() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    return new Redis({ url, token });
}

// ===== LOG ACCESS =====
async function logAccess(rollNumber) {
    const redis = getRedis();
    if (!redis) return; // silently skip if Redis not configured

    const parsed = parseRollNumber(rollNumber);
    if (!parsed) return; // skip if roll number doesn't match expected format

    const now = new Date();
    const dateKey = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timestamp = now.getTime();

    // Use a pipeline for efficiency (all commands in one HTTP request)
    const pipeline = redis.pipeline();

    // Log the access with timestamp
    pipeline.zadd("analytics:accesses", {
        score: timestamp,
        member: `${parsed.raw}:${timestamp}`,
    });

    // Increment counters
    pipeline.incr("analytics:total");
    pipeline.incr(`analytics:dept:${parsed.department}`);
    pipeline.incr(`analytics:year:${parsed.yearOfStudy}`);
    pipeline.incr(`analytics:daily:${dateKey}`);

    // Track unique users
    pipeline.sadd("analytics:unique", parsed.raw);

    await pipeline.exec();
}

// ===== GET ANALYTICS =====
async function getAnalytics() {
    const redis = getRedis();
    if (!redis) {
        return { error: "Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN." };
    }

    // Fetch all counters
    const [total, uniqueCount] = await Promise.all([
        redis.get("analytics:total"),
        redis.scard("analytics:unique"),
    ]);

    // Get department breakdown — scan for dept keys
    const deptKeys = [];
    const yearKeys = [];
    const dailyKeys = [];

    // We'll scan known department codes common at CHARUSAT
    const knownDepts = [
        "CE", "IT", "CS", "EC", "EE", "ME", "CL", "IC", "BM", "AI",
        "DS", "CY", "BT", "CV", "MCA", "MBA", "PHD", "ARC",
    ];

    const deptPipeline = redis.pipeline();
    for (const dept of knownDepts) {
        deptPipeline.get(`analytics:dept:${dept}`);
    }
    const deptResults = await deptPipeline.exec();

    const departments = {};
    knownDepts.forEach((dept, i) => {
        const count = deptResults[i];
        if (count && parseInt(count) > 0) {
            departments[dept] = parseInt(count);
        }
    });

    // Get year breakdown (years 1-6)
    const yearPipeline = redis.pipeline();
    for (let y = 1; y <= 6; y++) {
        yearPipeline.get(`analytics:year:${y}`);
    }
    const yearResults = await yearPipeline.exec();

    const years = {};
    for (let y = 1; y <= 6; y++) {
        const count = yearResults[y - 1];
        if (count && parseInt(count) > 0) {
            years[`Year ${y}`] = parseInt(count);
        }
    }

    // Get last 7 days of daily counts
    const dailyPipeline = redis.pipeline();
    const dailyLabels = [];
    for (let d = 6; d >= 0; d--) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        const key = date.toISOString().split("T")[0];
        dailyLabels.push(key);
        dailyPipeline.get(`analytics:daily:${key}`);
    }
    const dailyResults = await dailyPipeline.exec();

    const daily = {};
    dailyLabels.forEach((label, i) => {
        daily[label] = parseInt(dailyResults[i]) || 0;
    });

    // Get recent accesses (last 50)
    const recentRaw = await redis.zrange("analytics:accesses", 0, 49, { rev: true });
    const recent = recentRaw.map((entry) => {
        const parts = entry.split(":");
        const ts = parseInt(parts.pop());
        const rollNumber = parts.join(":");
        const parsed = parseRollNumber(rollNumber);
        return {
            rollNumber,
            timestamp: new Date(ts).toISOString(),
            department: parsed?.department || "Unknown",
            yearOfStudy: parsed?.yearOfStudy || 0,
        };
    });

    return {
        totalAccesses: parseInt(total) || 0,
        uniqueUsers: uniqueCount || 0,
        departments,
        years,
        daily,
        recent,
    };
}

// ===== VERCEL HANDLER =====
module.exports = async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    // POST — internal logging (called by attendance endpoint)
    if (req.method === "POST") {
        try {
            const { rollNumber } = req.body || {};
            if (!rollNumber) return res.status(400).json({ error: "rollNumber required" });
            await logAccess(rollNumber);
            return res.status(200).json({ success: true });
        } catch (err) {
            // Don't expose internal errors for logging
            return res.status(200).json({ success: true });
        }
    }

    // GET — admin analytics dashboard data
    if (req.method === "GET") {
        const token = req.query.token;
        const secret = process.env.ANALYTICS_SECRET;

        if (!secret) {
            return res.status(500).json({ error: "ANALYTICS_SECRET not configured on server." });
        }
        if (!token || token !== secret) {
            return res.status(401).json({ error: "Unauthorized. Provide ?token=YOUR_SECRET" });
        }

        try {
            const data = await getAnalytics();
            return res.status(200).json({ success: true, data });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    return res.status(405).json({ error: "Method not allowed" });
};

// Export for use by attendance.js
module.exports.logAccess = logAccess;
module.exports.parseRollNumber = parseRollNumber;
