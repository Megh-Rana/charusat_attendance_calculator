const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");
const { logAccess } = require("./analytics");

// ===== SCRAPER =====
const agent = new https.Agent({ rejectUnauthorized: false });
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

function createSession() {
    const cookies = {};
    const session = axios.create({
        httpsAgent: agent,
        maxRedirects: 10,
        headers: {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    });
    session.interceptors.response.use((res) => {
        const sc = res.headers["set-cookie"];
        if (sc) sc.forEach((c) => {
            const [nv] = c.split(";");
            const eq = nv.indexOf("=");
            if (eq > 0) cookies[nv.substring(0, eq).trim()] = nv.substring(eq + 1).trim();
        });
        return res;
    });
    session.interceptors.request.use((config) => {
        const cs = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
        if (cs) config.headers.Cookie = cs;
        return config;
    });
    session.getCookies = () => ({ ...cookies });
    return session;
}

async function login(username, password) {
    const session = createSession();
    const loginPage = await session.get(`${BASE_URL}/`);
    const pv = extractPayloadValues(loginPage.data);
    if (!pv.__VIEWSTATE) throw new Error("Failed to reach eGovernance login page.");

    const form = new URLSearchParams({
        ScriptManager1: "up1|btnLogin", __EVENTTARGET: "btnLogin", __EVENTARGUMENT: "",
        __LASTFOCUS: "", __VIEWSTATE: pv.__VIEWSTATE,
        __VIEWSTATEGENERATOR: pv.__VIEWSTATEGENERATOR || "",
        __EVENTVALIDATION: pv.__EVENTVALIDATION || "",
        txtUserName: username, txtPassword: String(password),
        hdnGPLevel: "", txtUserID: "", txtName: "", hdnPassword: "",
        txtAccountType: "", txtEmail: "", hdnPasswordFlg: "-1",
        hdnAuthorizedPerson: "", hdnUserType: "", __ASYNCPOST: "true",
    });

    const loginRes = await session.post(`${BASE_URL}/Home.aspx`, form.toString(), {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Origin: "https://support.charusat.edu.in",
            Referer: `${BASE_URL}/`, "X-MicrosoftAjax": "Delta=true",
        },
    });

    const text = loginRes.data || "";
    if (text.includes("pageRedirect")) {
        const m = text.match(/pageRedirect\|\|([^|]+)/);
        if (m) await session.get(decodeURIComponent(m[1]));
    }

    const c = session.getCookies();
    if (!c[".EGovWebApp"] && !c["ASP.NET_SessionId"]) {
        try {
            const t = await session.get(`${BASE_URL}/frmAppSelection.aspx`);
            if (t.data.includes("lnkLogout") || t.data.includes("Welcome")) return session;
        } catch (e) { }
        throw new Error("Login failed. Check your credentials.");
    }
    return session;
}

async function fetchAttendance(session) {
    const dash = await session.get(`${BASE_URL}/frmAppSelection.aspx`);
    const pv = extractPayloadValues(dash.data);
    if (!pv.__VIEWSTATE) throw new Error("Session expired. Please try again.");

    const form = new URLSearchParams({
        ScriptManager1: "UpGrossAtt|grdGrossAtt$ctl01$lnkRequestViewTT",
        __EVENTTARGET: "", __EVENTARGUMENT: "",
        __VIEWSTATE: pv.__VIEWSTATE,
        __VIEWSTATEGENERATOR: pv.__VIEWSTATEGENERATOR || "",
        __EVENTVALIDATION: pv.__EVENTVALIDATION || "",
        __ASYNCPOST: "true",
        "grdGrossAtt$ctl01$lnkRequestViewTT.x": "242",
        "grdGrossAtt$ctl01$lnkRequestViewTT.y": "80",
    });

    const res = await session.post(`${BASE_URL}/frmAppSelection.aspx`, form.toString(), {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Origin: "https://support.charusat.edu.in",
            Referer: `${BASE_URL}/frmAppSelection.aspx`, "X-MicrosoftAjax": "Delta=true",
        },
    });
    return parseAttendanceHtml(res.data);
}

function parseAttendanceHtml(html) {
    const $ = cheerio.load(html);
    const data = [];
    const grossTable = $("#gvGrossAttPop");
    const courseTable = $("#gvGAttSubjectsPop");
    if (!grossTable.length) throw new Error("Attendance data not found. Try again.");

    grossTable.find("tr").slice(1).each((_, row) => {
        const cols = $(row).find("td");
        if (cols.length >= 4) {
            const courseCode = $(cols[0]).find("span").text().trim();
            const classType = $(cols[1]).find("span").text().trim();
            const pt = $(cols[2]).text().replace(/\s+/g, "").trim();
            const percentage = $(cols[3]).text().trim();
            let courseName = "";
            if (courseTable.length) courseTable.find("td").each((_, td) => {
                if ($(td).text().trim() === courseCode) { courseName = $(td).next("td").text().trim(); return false; }
            });
            const parts = pt.split("/");
            data.push({ courseCode, courseName, classType, present: parseInt(parts[0]) || 0, total: parseInt(parts[1]) || 0, percentage });
        }
    });

    const header = $("#lblHeadAnnouncement").text() || "";
    const semMatch = header.match(/Semester\s*(\d+)/i);
    const grossMatch = header.match(/-\s*([\d.]+)\s*%/);
    const calcGross = (items) => {
        const tp = items.reduce((s, i) => s + i.present, 0), tt = items.reduce((s, i) => s + i.total, 0);
        return tt > 0 ? ((tp / tt) * 100).toFixed(2) + "%" : "0%";
    };

    return {
        data,
        lectureGross: (grossMatch ? grossMatch[1] + "%" : calcGross(data.filter(d => d.classType === "LECT"))),
        labGross: calcGross(data.filter(d => d.classType === "LAB")),
        semester: semMatch ? semMatch[1] : "",
    };
}

// ===== CALCULATOR =====
function calculateSkippable(present, total, threshold) {
    if (total === 0) return 0;
    return Math.floor((present - threshold * total) / (1 - threshold));
}

function getSeverity(pct) {
    if (pct >= 85) return { level: "safe", color: "green", label: "Safe" };
    if (pct >= 75) return { level: "caution", color: "yellow", label: "Caution" };
    if (pct >= 70) return { level: "warning", color: "orange", label: "Warning" };
    return { level: "critical", color: "red", label: "Critical" };
}

function processAttendance(raw) {
    const ST = 0.7, OT = 0.75;
    const subjects = raw.data.map((s) => {
        const pct = s.total > 0 ? (s.present / s.total) * 100 : 0;
        return { ...s, percentageNum: parseFloat(pct.toFixed(2)), skippable: calculateSkippable(s.present, s.total, ST), severity: getSeverity(pct) };
    });
    const tp = raw.data.reduce((s, d) => s + d.present, 0), tt = raw.data.reduce((s, d) => s + d.total, 0);
    const op = tt > 0 ? parseFloat(((tp / tt) * 100).toFixed(2)) : 0;
    const lect = raw.data.filter(d => d.classType === "LECT"), lab = raw.data.filter(d => d.classType === "LAB");
    const lp = lect.reduce((s, d) => s + d.present, 0), lt = lect.reduce((s, d) => s + d.total, 0);
    const bp = lab.reduce((s, d) => s + d.present, 0), bt = lab.reduce((s, d) => s + d.total, 0);

    return {
        subjects, semester: raw.semester,
        overall: { present: tp, total: tt, percentage: op, skippable: calculateSkippable(tp, tt, OT), severity: getSeverity(op) },
        lectureGross: { present: lp, total: lt, percentage: lt > 0 ? parseFloat(((lp / lt) * 100).toFixed(2)) : 0 },
        labGross: { present: bp, total: bt, percentage: bt > 0 ? parseFloat(((bp / bt) * 100).toFixed(2)) : 0 },
        thresholds: { perSubject: ST * 100 + "%", overall: OT * 100 + "%" },
    };
}

// ===== VERCEL HANDLER =====
module.exports = async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

    try {
        const { username, password } = req.body || {};
        if (!username || !password) return res.status(400).json({ success: false, error: "Username and password are required." });

        const session = await login(username, password);
        const raw = await fetchAttendance(session);
        const processed = processAttendance(raw);

        // Fire-and-forget analytics logging (non-blocking)
        try {
            await logAccess(username);
        } catch (e) {
            // Silently ignore analytics errors — never affect user experience
        }

        return res.status(200).json({ success: true, data: processed });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};
