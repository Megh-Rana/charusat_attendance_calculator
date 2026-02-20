const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");

// Allow self-signed/mismatched certs
const agent = new https.Agent({ rejectUnauthorized: false });

// The :912 port redirects here, so use this directly
const BASE_URL = "https://support.charusat.edu.in/egov";

/**
 * Extract ASP.NET __VIEWSTATE, __VIEWSTATEGENERATOR, __EVENTVALIDATION from HTML
 */
function extractPayloadValues(html) {
    const values = {};

    // Pattern 1: name before value
    const p1 =
        /name="(__VIEWSTATE|__VIEWSTATEGENERATOR|__EVENTVALIDATION)"[^>]*value="([^"]*)"/g;
    let match;
    while ((match = p1.exec(html)) !== null) {
        values[match[1]] = match[2];
    }

    // Pattern 2: value before name (common in ASP.NET)
    const p2 =
        /value="([^"]*)"[^>]*name="(__VIEWSTATE|__VIEWSTATEGENERATOR|__EVENTVALIDATION)"/g;
    while ((match = p2.exec(html)) !== null) {
        if (!values[match[2]]) {
            values[match[2]] = match[1];
        }
    }

    // Pattern 3: id-based (sometimes ASP.NET uses id instead of name)
    const p3 =
        /id="(__VIEWSTATE|__VIEWSTATEGENERATOR|__EVENTVALIDATION)"[^>]*value="([^"]*)"/g;
    while ((match = p3.exec(html)) !== null) {
        if (!values[match[1]]) {
            values[match[1]] = match[2];
        }
    }

    return values;
}

/**
 * Create a session with automatic cookie management
 */
function createSession() {
    const cookies = {};

    const session = axios.create({
        httpsAgent: agent,
        maxRedirects: 10,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-IN,en;q=0.9",
        },
    });

    // Capture cookies from responses
    session.interceptors.response.use((response) => {
        const setCookies = response.headers["set-cookie"];
        if (setCookies) {
            setCookies.forEach((cookieStr) => {
                const [nameValue] = cookieStr.split(";");
                const eqIdx = nameValue.indexOf("=");
                if (eqIdx > 0) {
                    const name = nameValue.substring(0, eqIdx).trim();
                    const value = nameValue.substring(eqIdx + 1).trim();
                    cookies[name] = value;
                }
            });
        }
        return response;
    });

    // Send cookies with requests
    session.interceptors.request.use((config) => {
        const cookieStr = Object.entries(cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");
        if (cookieStr) {
            config.headers.Cookie = cookieStr;
        }
        return config;
    });

    session.getCookies = () => ({ ...cookies });

    return session;
}

/**
 * Login to eGovernance
 * The flow:
 *   1. GET the login page → extract __VIEWSTATE
 *   2. POST credentials via ASP.NET AJAX → get pageRedirect URL
 *   3. Follow the redirect → session cookies are now set
 */
async function login(username, password) {
    const session = createSession();

    // Step 1: GET login page
    console.log("  [scraper] Getting login page...");
    const loginPageRes = await session.get(`${BASE_URL}/`);
    const payloadValues = extractPayloadValues(loginPageRes.data);

    if (!payloadValues.__VIEWSTATE) {
        throw new Error(
            "Failed to extract __VIEWSTATE from login page. The site may be down."
        );
    }

    // Step 2: POST login via ASP.NET AJAX
    console.log("  [scraper] Posting credentials...");
    const formData = new URLSearchParams({
        ScriptManager1: "up1|btnLogin",
        __EVENTTARGET: "btnLogin",
        __EVENTARGUMENT: "",
        __LASTFOCUS: "",
        __VIEWSTATE: payloadValues.__VIEWSTATE,
        __VIEWSTATEGENERATOR: payloadValues.__VIEWSTATEGENERATOR || "",
        __EVENTVALIDATION: payloadValues.__EVENTVALIDATION || "",
        txtUserName: username,
        txtPassword: String(password),
        hdnGPLevel: "",
        txtUserID: "",
        txtName: "",
        hdnPassword: "",
        txtAccountType: "",
        txtEmail: "",
        hdnPasswordFlg: "-1",
        hdnAuthorizedPerson: "",
        hdnUserType: "",
        __ASYNCPOST: "true",
    });

    const loginRes = await session.post(
        `${BASE_URL}/Home.aspx`,
        formData.toString(),
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                Origin: "https://support.charusat.edu.in",
                Referer: `${BASE_URL}/`,
                "X-MicrosoftAjax": "Delta=true",
            },
        }
    );

    // The response body contains an ASP.NET AJAX delta response
    // On success: contains "pageRedirect||<url>"
    // On failure: contains error message or no redirect
    const responseText = loginRes.data || "";

    if (responseText.includes("pageRedirect")) {
        // Extract redirect URL
        const redirectMatch = responseText.match(/pageRedirect\|\|([^|]+)/);
        if (redirectMatch) {
            const redirectUrl = decodeURIComponent(redirectMatch[1]);
            console.log(`  [scraper] Following redirect: ${redirectUrl}`);

            // Step 3: Follow the redirect — this sets the actual auth cookies
            await session.get(redirectUrl);
        }
    }

    // Verify we have the necessary cookies
    const sessionCookies = session.getCookies();
    const hasAuth =
        sessionCookies[".EGovWebApp"] || sessionCookies["ASP.NET_SessionId"];

    if (!hasAuth) {
        // Check if we can access the dashboard anyway (maybe cookies were set differently)
        try {
            const testRes = await session.get(`${BASE_URL}/frmAppSelection.aspx`);
            if (
                testRes.data.includes("lnkLogout") ||
                testRes.data.includes("Welcome")
            ) {
                console.log("  [scraper] Auth confirmed via page content.");
                return session;
            }
        } catch (e) {
            // fall through
        }

        throw new Error(
            "Login failed. Could not obtain session cookies. Check credentials."
        );
    }

    console.log("  [scraper] Auth cookies obtained.");
    return session;
}

/**
 * Fetch attendance data from an authenticated session
 */
async function fetchAttendance(session) {
    // Step 1: GET dashboard to extract payload values
    console.log("  [scraper] Getting dashboard page...");
    const dashRes = await session.get(`${BASE_URL}/frmAppSelection.aspx`);
    const payloadValues = extractPayloadValues(dashRes.data);

    if (!payloadValues.__VIEWSTATE) {
        throw new Error(
            "Failed to extract __VIEWSTATE from dashboard. Session may have expired."
        );
    }

    // Step 2: POST to trigger attendance load (click the attendance image button)
    console.log("  [scraper] Requesting attendance data...");
    const formData = new URLSearchParams({
        ScriptManager1: "UpGrossAtt|grdGrossAtt$ctl01$lnkRequestViewTT",
        __EVENTTARGET: "",
        __EVENTARGUMENT: "",
        __VIEWSTATE: payloadValues.__VIEWSTATE,
        __VIEWSTATEGENERATOR: payloadValues.__VIEWSTATEGENERATOR || "",
        __EVENTVALIDATION: payloadValues.__EVENTVALIDATION || "",
        __ASYNCPOST: "true",
        "grdGrossAtt$ctl01$lnkRequestViewTT.x": "242",
        "grdGrossAtt$ctl01$lnkRequestViewTT.y": "80",
    });

    const attRes = await session.post(
        `${BASE_URL}/frmAppSelection.aspx`,
        formData.toString(),
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                Origin: "https://support.charusat.edu.in",
                Referer: `${BASE_URL}/frmAppSelection.aspx`,
                "X-MicrosoftAjax": "Delta=true",
            },
        }
    );

    return parseAttendanceHtml(attRes.data);
}

/**
 * Parse the attendance HTML response
 * Adapted from the Python parse_attendance_html function
 */
function parseAttendanceHtml(html) {
    const $ = cheerio.load(html);

    const data = [];

    // Find the attendance data table and course name lookup table
    const grossTable = $("#gvGrossAttPop");
    const courseNameTable = $("#gvGAttSubjectsPop");

    if (!grossTable.length) {
        throw new Error(
            "Attendance table (gvGrossAttPop) not found in response. The page structure may have changed or the session expired."
        );
    }

    // Parse each subject row (skip header)
    grossTable
        .find("tr")
        .slice(1)
        .each((_, row) => {
            const columns = $(row).find("td");
            if (columns.length >= 4) {
                const courseCode = $(columns[0]).find("span").text().trim();
                const classType = $(columns[1]).find("span").text().trim();
                const presentTotal = $(columns[2]).text().replace(/\s+/g, "").trim();
                const percentage = $(columns[3]).text().trim();

                // Look up course name from the second table
                let courseName = "";
                if (courseNameTable.length) {
                    courseNameTable.find("td").each((_, td) => {
                        if ($(td).text().trim() === courseCode) {
                            courseName = $(td).next("td").text().trim();
                            return false; // break
                        }
                    });
                }

                // Parse present/total
                const parts = presentTotal.split("/");
                const present = parseInt(parts[0], 10) || 0;
                const total = parseInt(parts[1], 10) || 0;

                data.push({
                    courseCode,
                    courseName,
                    classType,
                    present,
                    total,
                    percentage,
                });
            }
        });

    // Extract semester and gross from the header span
    const headerText = $("#lblHeadAnnouncement").text() || "";
    let semester = "";
    let lectureGross = "";

    const semMatch = headerText.match(/Semester\s*(\d+)/i);
    if (semMatch) semester = semMatch[1];

    const grossMatch = headerText.match(/-\s*([\d.]+)\s*%/);
    if (grossMatch) lectureGross = grossMatch[1] + "%";

    // Calculate lecture and lab gross from data
    const calcGross = (items) => {
        const tp = items.reduce((s, i) => s + i.present, 0);
        const tt = items.reduce((s, i) => s + i.total, 0);
        return tt > 0 ? ((tp / tt) * 100).toFixed(2) + "%" : "0%";
    };

    const lectItems = data.filter((d) => d.classType === "LECT");
    const labItems = data.filter((d) => d.classType === "LAB");

    return {
        data,
        lectureGross: lectureGross || calcGross(lectItems),
        labGross: calcGross(labItems),
        semester,
    };
}

module.exports = { login, fetchAttendance, extractPayloadValues };
