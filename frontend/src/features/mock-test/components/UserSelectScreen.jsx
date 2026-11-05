export function UserSelectScreen({ users, onSelectUser }) {
  return (
    <section className="card user-select-card">
      <div className="badge">Mock Test Platform</div>
      <h1 className="home-title">Who is taking the test?</h1>
      <p className="sub-text">Select your profile to continue.</p>

      <div className="user-icons">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            className="user-icon-btn"
            onClick={() => onSelectUser(user)}
            aria-label={`Select user ${user.name}`}
          >
            <span className="user-avatar">{user.name}</span>
            <span className="user-icon-label">User {user.name}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
