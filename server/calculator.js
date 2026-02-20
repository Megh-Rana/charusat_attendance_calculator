/**
 * Skip Calculator
 *
 * Calculates how many lectures a student can skip while maintaining
 * the required attendance percentage.
 *
 * Formula: skippable = floor((present - threshold * total) / (1 - threshold))
 *   - If result >= 0: student can skip that many lectures
 *   - If result < 0: student needs to attend |result| more consecutive lectures to recover
 */

/**
 * Calculate how many lectures can be skipped for a given attendance record
 * @param {number} present - Number of lectures attended
 * @param {number} total - Total number of lectures held
 * @param {number} threshold - Minimum attendance percentage (0.70 or 0.75)
 * @returns {number} Positive = can skip, Negative = must attend to recover
 */
function calculateSkippable(present, total, threshold) {
    if (total === 0) return 0;

    // How many we can skip: (present - threshold * total) / (1 - threshold)
    const skippable = Math.floor(
        (present - threshold * total) / (1 - threshold)
    );

    return skippable;
}

/**
 * Determine severity level based on percentage
 * @param {number} percentage
 * @returns {{ level: string, color: string }}
 */
function getSeverity(percentage) {
    if (percentage >= 85) {
        return { level: "safe", color: "green", label: "Safe" };
    } else if (percentage >= 75) {
        return { level: "caution", color: "yellow", label: "Caution" };
    } else if (percentage >= 70) {
        return { level: "warning", color: "orange", label: "Warning" };
    } else {
        return { level: "critical", color: "red", label: "Critical" };
    }
}

/**
 * Process raw attendance data and enrich with skip calculations
 * @param {Object} attendanceData - Raw attendance data from scraper
 * @returns {Object} Enriched attendance data
 */
function processAttendance(attendanceData) {
    const SUBJECT_THRESHOLD = 0.7; // 70% per subject
    const OVERALL_THRESHOLD = 0.75; // 75% overall

    // Enrich each subject with skip info
    const enrichedData = attendanceData.data.map((subject) => {
        const pct =
            subject.total > 0 ? (subject.present / subject.total) * 100 : 0;
        const skippable = calculateSkippable(
            subject.present,
            subject.total,
            SUBJECT_THRESHOLD
        );
        const severity = getSeverity(pct);

        return {
            ...subject,
            percentageNum: parseFloat(pct.toFixed(2)),
            skippable,
            severity,
        };
    });

    // Calculate overall stats (all types combined — as per user: everything counts in total)
    const totalPresent = attendanceData.data.reduce(
        (sum, s) => sum + s.present,
        0
    );
    const totalLectures = attendanceData.data.reduce(
        (sum, s) => sum + s.total,
        0
    );
    const overallPercentage =
        totalLectures > 0
            ? parseFloat(((totalPresent / totalLectures) * 100).toFixed(2))
            : 0;
    const overallSkippable = calculateSkippable(
        totalPresent,
        totalLectures,
        OVERALL_THRESHOLD
    );
    const overallSeverity = getSeverity(overallPercentage);

    // Also compute lecture-only and lab-only stats
    const lectData = attendanceData.data.filter((d) => d.classType === "LECT");
    const labData = attendanceData.data.filter((d) => d.classType === "LAB");

    const lectPresent = lectData.reduce((s, d) => s + d.present, 0);
    const lectTotal = lectData.reduce((s, d) => s + d.total, 0);
    const labPresent = labData.reduce((s, d) => s + d.present, 0);
    const labTotal = labData.reduce((s, d) => s + d.total, 0);

    return {
        subjects: enrichedData,
        overall: {
            present: totalPresent,
            total: totalLectures,
            percentage: overallPercentage,
            skippable: overallSkippable,
            severity: overallSeverity,
        },
        lectureGross: {
            present: lectPresent,
            total: lectTotal,
            percentage:
                lectTotal > 0
                    ? parseFloat(((lectPresent / lectTotal) * 100).toFixed(2))
                    : 0,
        },
        labGross: {
            present: labPresent,
            total: labTotal,
            percentage:
                labTotal > 0
                    ? parseFloat(((labPresent / labTotal) * 100).toFixed(2))
                    : 0,
        },
        semester: attendanceData.semester,
        thresholds: {
            perSubject: SUBJECT_THRESHOLD * 100 + "%",
            overall: OVERALL_THRESHOLD * 100 + "%",
        },
    };
}

module.exports = { calculateSkippable, getSeverity, processAttendance };
