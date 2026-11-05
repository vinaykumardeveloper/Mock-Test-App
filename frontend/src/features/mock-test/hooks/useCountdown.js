import { useEffect, useState } from 'react'

export function useCountdown(initialSeconds, isRunning, onComplete) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)

  useEffect(() => {
    if (!isRunning) {
      return undefined
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isRunning, onComplete])

  function reset(newValue = initialSeconds) {
    setSecondsLeft(newValue)
  }

  return {
    secondsLeft,
    reset,
  }
}
