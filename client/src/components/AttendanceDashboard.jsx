import SubjectRow from './SubjectRow'

function getLectureGrossSeverity(percentage) {
    if (percentage >= 85) return 'safe'
    if (percentage >= 75) return 'caution'
    if (percentage >= 70) return 'warning'
    return 'critical'
}

function AttendanceDashboard({ data, onLogout }) {
    const { subjects, overall, lectureGross, labGross, semester, thresholds } = data

    const lectSeverity = getLectureGrossSeverity(lectureGross.percentage)

    return (
        <div className="dashboard">
            {/* Header bar */}
            <div className="dashboard-header">
                <div>
                    <h2>Semester {semester} Attendance</h2>
                    <p className="thresholds-info">
                        Required: {thresholds.overall} overall · {thresholds.perSubject} per subject
                    </p>
                </div>
                <button className="btn-logout" onClick={onLogout}>
                    ← Back to Login
                </button>
            </div>

            {/* Summary Cards */}
            <div className="summary-cards">
                <div className={`summary-card primary severity-${lectSeverity}`}>
                    <div className="card-badge">Shown on eGov</div>
                    <div className="card-label">Lecture Gross Attendance</div>
                    <div className="card-value">{lectureGross.percentage}%</div>
                    <div className="card-detail">{lectureGross.present} / {lectureGross.total} lectures</div>
                </div>

                <div className="summary-card">
                    <div className="card-label">Lab Gross</div>
                    <div className="card-value">{labGross.percentage}%</div>
                    <div className="card-detail">{labGross.present} / {labGross.total} labs</div>
                </div>

                <div className={`summary-card severity-${overall.severity.level}`}>
                    <div className="card-label">Overall (Lectures + Labs)</div>
                    <div className="card-value">{overall.percentage}%</div>
                    <div className="card-detail">{overall.present} / {overall.total} total</div>
                    <div className="card-skip">
                        {overall.skippable >= 0 ? (
                            <span className="skip-positive">Can skip {overall.skippable} more</span>
                        ) : (
                            <span className="skip-negative">Attend {Math.abs(overall.skippable)} more to reach 75%</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Skip Explainer */}
            <div className="skip-explainer">
                <strong>How to read "Can Skip":</strong>{' '}
                <span className="skip-positive">+5</span> = you can safely skip 5 more lectures &nbsp;·&nbsp;{' '}
                <span className="skip-negative">Attend 7</span> = you need to attend 7 consecutive lectures to reach the minimum
            </div>

            {/* Subject Table */}
            <div className="table-container">
                <table className="attendance-table">
                    <thead>
                        <tr>
                            <th>Subject</th>
                            <th>Type</th>
                            <th>Present / Total</th>
                            <th>Percentage</th>
                            <th>Can Skip</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subjects.map((subject, index) => (
                            <SubjectRow key={index} subject={subject} index={index} />
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="legend">
                <span className="legend-item">
                    <span className="dot green"></span> Safe (≥85%)
                </span>
                <span className="legend-item">
                    <span className="dot yellow"></span> Caution (75-84%)
                </span>
                <span className="legend-item">
                    <span className="dot orange"></span> Warning (70-74%)
                </span>
                <span className="legend-item">
                    <span className="dot red"></span> Critical (&lt;70%)
                </span>
            </div>
        </div>
    )
}

export default AttendanceDashboard
