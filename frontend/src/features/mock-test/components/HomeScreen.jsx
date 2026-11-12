export function HomeScreen({
  userIcon,
  onLogout,
  onViewPausedTests,
  onPrepareTest,
  onViewPreviousTests,
  onViewAllTests,
}) {
  return (
    <section className="card home-card">
      <div className="home-hero-top">
        {userIcon}
        <div className="home-user-bar">
          <button type="button" className="secondary-btn small-btn" onClick={onLogout}>
            Switch User
          </button>
        </div>
      </div>
      <h1 className="home-brand">VH TESTS</h1>

      <div className="home-main-action">
        <button type="button" className="primary-btn" onClick={onPrepareTest}>
          Create Test
        </button>
      </div>

      <div className="home-actions">
        <button type="button" className="secondary-btn" onClick={onViewPausedTests}>
          Paused Tests
        </button>
        <button type="button" className="secondary-btn" onClick={onViewPreviousTests}>
          Previous Tests
        </button>
        <button type="button" className="secondary-btn" onClick={onViewAllTests}>
          All Tests
        </button>
      </div>
    </section>
  )
}
