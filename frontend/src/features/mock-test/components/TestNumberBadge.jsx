export function TestNumberBadge({ number, nickname = '', size = 'normal' }) {
  if (!number && !nickname) {
    return null
  }

  return (
    <>
      {number && <span className={`test-number-badge ${size}`}>Test No: {number}</span>}
      {nickname && (
        <>
          {number && ' '}
          <span className={`test-number-badge nickname ${size}`}>{nickname}</span>
        </>
      )}
    </>
  )
}
