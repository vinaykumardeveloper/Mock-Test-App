export function TestTitle({ name }) {
  const displayName = String(name || '').replace(/^Mock Test\s*[•:|-]\s*/i, '')
  const separatorIndex = displayName.indexOf(' • ')
  if (separatorIndex === -1) {
    return displayName
  }

  return (
    <>
      {displayName.slice(0, separatorIndex)}
      {' • '}
      <span className="previous-test-chapters">{displayName.slice(separatorIndex + 3)}</span>
    </>
  )
}
