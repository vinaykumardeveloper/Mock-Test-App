export function LoginScreen({ user, error, isSubmitting, onSubmit, onBack }) {
  function handleSubmit(event) {
    event.preventDefault()
    if (!isSubmitting) {
      onSubmit()
    }
  }

  return (
    <section className="card user-select-card">
      <span className="user-avatar">{user.name}</span>
      <h2>Welcome, {user.name}</h2>
      <p className="sub-text">Do you want to login as {user.name}?</p>

      <form className="login-form" onSubmit={handleSubmit}>
        {error && <p className="upload-status error">{error}</p>}
        <div className="actions">
          <button type="button" className="secondary-btn" onClick={onBack} disabled={isSubmitting}>
            No
          </button>
          <button type="submit" className="primary-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Yes'}
          </button>
        </div>
      </form>
    </section>
  )
}
