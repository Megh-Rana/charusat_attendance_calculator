import { useState } from 'react'

function LoginForm({ onLogin, loading, error, captcha, onRefreshCaptcha, captchaLoading }) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [captchaText, setCaptchaText] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        if (username && password && captchaText && captcha?.token) {
            onLogin(username, password, captcha.token, captchaText)
        }
    }

    // Clear captcha input whenever a new captcha image arrives
    const handleRefresh = () => {
        setCaptchaText('')
        onRefreshCaptcha()
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <h2>eGovernance Login</h2>
                <p className="login-desc">Enter your CHARUSAT eGovernance credentials</p>

                {error && (
                    <div className="error-alert">
                        <span className="error-icon">⚠</span>
                        {error}
                        {error.toLowerCase().includes('captcha') && (
                            <button
                                type="button"
                                className="btn-refresh-inline"
                                onClick={handleRefresh}
                                disabled={captchaLoading}
                            >
                                Refresh captcha
                            </button>
                        )}
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

                    <div className="form-group">
                        <label>Captcha</label>
                        <div className="captcha-row">
                            {captchaLoading ? (
                                <div className="captcha-placeholder">Loading captcha...</div>
                            ) : captcha?.image ? (
                                <img
                                    src={captcha.image}
                                    alt="Captcha"
                                    className="captcha-image"
                                />
                            ) : (
                                <div className="captcha-placeholder captcha-error">
                                    Failed to load
                                </div>
                            )}
                            <button
                                type="button"
                                className="btn-refresh-captcha"
                                onClick={handleRefresh}
                                disabled={captchaLoading || loading}
                                title="Refresh captcha"
                                aria-label="Refresh captcha"
                            >
                                ↻
                            </button>
                        </div>
                        <input
                            id="captcha"
                            type="text"
                            value={captchaText}
                            onChange={(e) => setCaptchaText(e.target.value)}
                            placeholder="Type the characters above"
                            disabled={loading || captchaLoading}
                            autoComplete="off"
                            maxLength={6}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-login"
                        disabled={loading || captchaLoading || !captcha?.token}
                    >
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
