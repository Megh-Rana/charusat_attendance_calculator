/**
 * Scraper test — requires real credentials in .env
 * Run: node test-scraper.js
 */

require("dotenv").config();
const { login, fetchAttendance } = require("./scraper");
const { processAttendance } = require("./calculator");

async function main() {
    const username = process.env.EGOV_USERNAME;
    const password = process.env.EGOV_PASSWORD;

    if (!username || !password) {
        console.error("❌ Missing credentials. Fill in server/.env file first.");
        console.error("   EGOV_USERNAME=your_id");
        console.error("   EGOV_PASSWORD=your_password");
        process.exit(1);
    }

    console.log(`\n🔐 Logging in as: ${username}...`);

    try {
        const session = await login(username, password);
        console.log("✅ Login successful!\n");

        console.log("📊 Fetching attendance data...");
        const rawAttendance = await fetchAttendance(session);
        console.log(
            `✅ Fetched ${rawAttendance.data.length} subject entries (Semester ${rawAttendance.semester})\n`
        );

        console.log("🧮 Processing skip calculations...");
        const processed = processAttendance(rawAttendance);

        console.log("\n" + "=".repeat(80));
        console.log(
            `  SEMESTER ${processed.semester} — ATTENDANCE SUMMARY`
        );
        console.log("=".repeat(80));

        console.log(
            `\n  Overall: ${processed.overall.present}/${processed.overall.total} (${processed.overall.percentage}%) — ${processed.overall.severity.label}`
        );

        if (processed.overall.skippable >= 0) {
            console.log(
                `  ✅ You can skip ${processed.overall.skippable} more lectures overall (maintaining 75%)`
            );
        } else {
            console.log(
                `  ⚠️  You need to attend ${Math.abs(processed.overall.skippable)} more lectures to reach 75%`
            );
        }

        console.log(
            `\n  Lecture Gross: ${processed.lectureGross.percentage}%`
        );
        console.log(`  Lab Gross: ${processed.labGross.percentage}%`);

        console.log("\n" + "-".repeat(80));
        console.log(
            "  Subject                          | Type | Present/Total |   %   | Skip | Status"
        );
        console.log("-".repeat(80));

        for (const s of processed.subjects) {
            const name = (s.courseName || s.courseCode).substring(0, 34).padEnd(34);
            const type = s.classType.padEnd(4);
            const att = `${s.present}/${s.total}`.padStart(6).padEnd(13);
            const pct = `${s.percentageNum}%`.padStart(6);
            const skip =
                s.skippable >= 0
                    ? `+${s.skippable}`.padStart(4)
                    : `${s.skippable}`.padStart(4);
            const status = s.severity.label;

            console.log(`  ${name} | ${type} | ${att} | ${pct} | ${skip} | ${status}`);
        }

        console.log("-".repeat(80));
        console.log("\n✅ Test complete!\n");
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
        }
        process.exit(1);
    }
}

main();
