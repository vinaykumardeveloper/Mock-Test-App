import { useState } from 'react'

export function LoginScreen({ user, error, isSubmitting, onSubmit, onBack }) {
  const [password, setPassword] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    if (password && !isSubmitting) {
      onSubmit(password)
    }
  }

  return (
    <section className="card user-select-card">
      <span className="user-avatar">{user.name}</span>
      <h2>Welcome, {user.name}</h2>
      <p className="sub-text">Enter your password to continue.</p>

      <form className="login-form" onSubmit={handleSubmit}>
        <label htmlFor="login-password" className="question-count-label">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isSubmitting}
        />
        {error && <p className="upload-status error">{error}</p>}
        <div className="actions">
          <button type="button" className="secondary-btn" onClick={onBack} disabled={isSubmitting}>
            Back
          </button>
          <button type="submit" className="primary-btn" disabled={!password || isSubmitting}>
            {isSubmitting ? 'Checking...' : 'Login'}
          </button>
        </div>
      </form>
    </section>
  )
}
