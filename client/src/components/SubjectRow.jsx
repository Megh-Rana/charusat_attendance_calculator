function SubjectRow({ subject, index }) {
    const { courseCode, courseName, classType, present, total, percentageNum, skippable, severity } = subject

    const displayName = courseName || courseCode

    return (
        <tr className={`subject-row severity-${severity.level}`}>
            <td className="subject-name">
                <span className="course-name">{displayName}</span>
                {courseName && <span className="course-code">{courseCode}</span>}
            </td>
            <td>
                <span className={`type-badge ${classType.toLowerCase()}`}>
                    {classType}
                </span>
            </td>
            <td className="attendance-fraction">
                {present} / {total}
            </td>
            <td className="percentage">
                <span className={`pct-value severity-text-${severity.level}`}>
                    {percentageNum}%
                </span>
            </td>
            <td className="skip-cell">
                {total === 0 ? (
                    <span className="skip-na">N/A</span>
                ) : skippable >= 0 ? (
                    <span className="skip-positive">Can skip {skippable}</span>
                ) : (
                    <span className="skip-negative">Attend {Math.abs(skippable)}</span>
                )}
            </td>
            <td>
                <span className={`status-badge severity-bg-${severity.level}`}>
                    {severity.label}
                </span>
            </td>
        </tr>
    )
}

export default SubjectRow
