/**
 * Unit test for the calculator module
 * Run: node test-calculator.js
 */

const { calculateSkippable, getSeverity, processAttendance } = require("./calculator");

let passed = 0;
let failed = 0;

function test(name, actual, expected) {
    if (actual === expected) {
        console.log(`  ✅ ${name}: ${actual}`);
        passed++;
    } else {
        console.log(`  ❌ ${name}: expected ${expected}, got ${actual}`);
        failed++;
    }
}

console.log("\n📊 Calculator Unit Tests\n");

// --- Test calculateSkippable ---
console.log("1. calculateSkippable():");

// 33/37 = 89% → at 70% threshold: floor((33 - 0.7*37) / 0.3) = floor((33 - 25.9) / 0.3) = floor(23.67) = 23
test("  89% attendance, 70% threshold", calculateSkippable(33, 37, 0.7), 23);

// 27/39 = 69% → at 70% threshold: floor((27 - 0.7*39) / 0.3) = floor((27 - 27.3) / 0.3) = floor(-1) = -1
test("  69% attendance, 70% threshold", calculateSkippable(27, 39, 0.7), -1);

// 40/54 = 74% → at 70% threshold: floor((40 - 0.7*54) / 0.3) = floor((40 - 37.8) / 0.3) = floor(7.33) = 7
test("  74% attendance, 70% threshold", calculateSkippable(40, 54, 0.7), 7);

// 8/11 = 72% → at 70% threshold: floor((8 - 0.7*11) / 0.3) = floor((8 - 7.7) / 0.3) = floor(1) = 1
test("  72% attendance, 70% threshold", calculateSkippable(8, 11, 0.7), 1);

// Overall: 234/317 = 73.8% → at 75% threshold: floor((234 - 0.75*317) / 0.25) = floor((234 - 237.75) / 0.25) = floor(-15) = -15
test("  73.8% overall, 75% threshold", calculateSkippable(234, 317, 0.75), -15);

// 0/0 edge case
test("  0/0 edge case", calculateSkippable(0, 0, 0.7), 0);

// --- Test getSeverity ---
console.log("\n2. getSeverity():");
test("  90% → safe", getSeverity(90).level, "safe");
test("  80% → caution", getSeverity(80).level, "caution");
test("  72% → warning", getSeverity(72).level, "warning");
test("  65% → critical", getSeverity(65).level, "critical");
test("  75% → caution", getSeverity(75).level, "caution");
test("  70% → warning", getSeverity(70).level, "warning");
test("  85% → safe", getSeverity(85).level, "safe");

// --- Test processAttendance ---
console.log("\n3. processAttendance() integration:");

const mockData = {
    data: [
        { courseCode: "CE391 / PDA", courseName: "PYTHON FOR DATA ANALYTICS", classType: "LECT", present: 33, total: 37, percentage: "89%" },
        { courseCode: "CE391 / PDA", courseName: "PYTHON FOR DATA ANALYTICS", classType: "LAB", present: 12, total: 16, percentage: "75%" },
        { courseCode: "EE342 / SDCM", courseName: "SYNCHRONOUS AND DC MACHINES", classType: "LECT", present: 40, total: 54, percentage: "74%" },
        { courseCode: "EE351 / EPTD", courseName: "ELECTRICAL POWER TRANSMISSION", classType: "LECT", present: 27, total: 39, percentage: "69%" },
    ],
    lectureGross: "76.92%",
    labGross: "75.00%",
    semester: "5",
};

const result = processAttendance(mockData);

test("  subject count", result.subjects.length, 4);
test("  semester", result.semester, "5");
test("  PDA LECT skippable at 70%", result.subjects[0].skippable, 23);
test("  PDA LECT severity", result.subjects[0].severity.level, "safe");
test("  EPTD skippable (deficit)", result.subjects[3].skippable, -1);
test("  EPTD severity", result.subjects[3].severity.level, "critical");
test("  overall present", result.overall.present, 112);
test("  overall total", result.overall.total, 146);

console.log(`\n📋 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
