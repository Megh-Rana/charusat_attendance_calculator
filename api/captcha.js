const axios = require("axios");
const https = require("https");
const { randomUUID } = require("crypto");
const { Redis } = require("@upstash/redis");

const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
const BASE_URL = "https://support.charusat.edu.in/egov";

function extractPayloadValues(html) {
    const values = {};
    const p1 = /name="(__VIEWSTATE|__VIEWSTATEGENERATOR|__EVENTVALIDATION)"[^>]*value="([^"]*)"/g;
    let match;
    while ((match = p1.exec(html)) !== null) values[match[1]] = match[2];
    const p2 = /value="([^"]*)"[^>]*name="(__VIEWSTATE|__VIEWSTATEGENERATOR|__EVENTVALIDATION)"/g;
    while ((match = p2.exec(html)) !== null) if (!values[match[2]]) values[match[2]] = match[1];
    const p3 = /id="(__VIEWSTATE|__VIEWSTATEGENERATOR|__EVENTVALIDATION)"[^>]*value="([^"]*)"/g;
    while ((match = p3.exec(html)) !== null) if (!values[match[1]]) values[match[1]] = match[2];
    return values;
}

function getRedis() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    return new Redis({ url, token });
}

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });

    const redis = getRedis();
    if (!redis) {
        return res.status(500).json({ success: false, error: "Session storage not configured." });
    }

    try {
        // Build a minimal cookie jar for this request pair
        const cookies = {};

        const session = axios.create({
            httpsAgent: agent,
            maxRedirects: 10,
            headers: {
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        });

        session.interceptors.response.use((r) => {
            const sc = r.headers["set-cookie"];
            if (sc) sc.forEach((c) => {
                const [nv] = c.split(";");
                const eq = nv.indexOf("=");
                if (eq > 0) cookies[nv.substring(0, eq).trim()] = nv.substring(eq + 1).trim();
            });
            return r;
        });
        session.interceptors.request.use((config) => {
            const cs = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
            if (cs) config.headers.Cookie = cs;
            return config;
        });

        // 1. GET login page — establishes ASP.NET_SessionId
        const loginPageRes = await session.get(`${BASE_URL}/`);
        const payloadValues = extractPayloadValues(loginPageRes.data);
        if (!payloadValues.__VIEWSTATE) {
            return res.status(502).json({ success: false, error: "Could not reach eGovernance. Try again." });
        }

        // 2. Fetch captcha image (same session = same ASP.NET session cookie)
        const captchaRes = await session.get(
            `${BASE_URL}/Captcha.ashx?t=${Date.now()}`,
            { responseType: "arraybuffer" }
        );
        const captchaBase64 = Buffer.from(captchaRes.data).toString("base64");
        const captchaMime = captchaRes.headers["content-type"] || "image/png";

        // 3. Store session state in Redis with 5-minute TTL
        const token = randomUUID();
        await redis.set(
            `captcha:${token}`,
            JSON.stringify({ cookies, payloadValues }),
            { ex: 300 } // 5 minutes
        );

        return res.status(200).json({
            success: true,
            token,
            captchaImage: `data:${captchaMime};base64,${captchaBase64}`,
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: "Failed to load captcha. Try again." });
    }
};
