require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3001;

// CORS — allow local dev + production Vercel domain
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
];

// Add production frontend URL if set
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (curl, mobile apps, etc.)
            if (!origin) return callback(null, true);
            if (allowedOrigins.some((o) => origin.startsWith(o))) {
                return callback(null, true);
            }
            // Also allow any *.vercel.app domain
            if (origin.endsWith(".vercel.app")) {
                return callback(null, true);
            }
            callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", routes);

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `[SERVER] Attendance Manager API running on http://0.0.0.0:${PORT}`
    );
    console.log(`[SERVER] Health check: http://localhost:${PORT}/api/health`);
});
