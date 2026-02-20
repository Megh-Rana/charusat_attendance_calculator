import { useState } from 'react'
import LoginForm from './components/LoginForm'
import AttendanceDashboard from './components/AttendanceDashboard'

function App() {
    const [attendanceData, setAttendanceData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleLogin = async (username, password) => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            })

            const result = await response.json()

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch attendance')
            }

            setAttendanceData(result.data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        setAttendanceData(null)
        setError(null)
    }

    return (
        <div className="app">
            <header className="app-header">
                <h1>CHARUSAT Attendance Manager</h1>
                <p className="subtitle">Check your attendance & see how many lectures you can skip</p>
            </header>

            <main className="app-main">
                {!attendanceData ? (
                    <LoginForm
                        onLogin={handleLogin}
                        loading={loading}
                        error={error}
                    />
                ) : (
                    <AttendanceDashboard
                        data={attendanceData}
                        onLogout={handleLogout}
                    />
                )}
            </main>

            <footer className="app-footer">
                <p>Not affiliated with CHARUSAT. Use responsibly.</p>
            </footer>
        </div>
    )
}

export default App
