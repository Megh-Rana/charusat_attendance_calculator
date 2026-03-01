import { useState } from 'react'
import LoginForm from './components/LoginForm'
import AttendanceDashboard from './components/AttendanceDashboard'

function App() {
    const [attendanceData, setAttendanceData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [transitioning, setTransitioning] = useState(false)

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

            setTransitioning(true)
            setTimeout(() => {
                setAttendanceData(result.data)
                setTransitioning(false)
            }, 300)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        setTransitioning(true)
        setTimeout(() => {
            setAttendanceData(null)
            setError(null)
            setTransitioning(false)
        }, 300)
    }

    return (
        <div className="app">
            {/* Floating background shapes */}
            <div className="bg-shapes">
                <div className="bg-shape bg-shape-1" />
                <div className="bg-shape bg-shape-2" />
                <div className="bg-shape bg-shape-3" />
            </div>

            <header className="app-header">
                <h1>CHARUSAT Attendance Manager</h1>
                <p className="subtitle">Check your attendance & see how many lectures you can skip</p>
            </header>

            <main className="app-main" style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 0.3s ease' }}>
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
