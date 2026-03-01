import { useState } from 'react'

function LoginForm({ onLogin, loading, error }) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        if (username && password) {
            onLogin(username, password)
        }
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <h2>eGovernance Login</h2>
                <p className="login-desc">Enter your CHARUSAT eGovernance credentials</p>

                {error && (
                    <div className="error-alert">
                        <span className="error-icon">⚠️</span>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="username">Student ID</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="e.g. 25CE099"
                            disabled={loading}
                            autoComplete="username"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Your eGov password"
                            disabled={loading}
                            autoComplete="current-password"
                            required
                        />
                    </div>

                    <button type="submit" className="btn-login" disabled={loading}>
                        {loading ? (
                            <span className="loading-text">
                                <span className="spinner"></span>
                                Fetching attendance...
                            </span>
                        ) : (
                            'Check Attendance'
                        )}
                    </button>
                </form>

                <p className="login-note">
                    🔒 Credentials are sent directly to CHARUSAT's servers. Nothing is stored.
                </p>
            </div>
        </div>
    )
}

export default LoginForm
