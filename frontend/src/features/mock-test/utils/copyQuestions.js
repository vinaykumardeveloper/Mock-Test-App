function formatOption(options, index) {
  if (!Number.isInteger(index) || index < 0 || index >= options.length) {
    throw new Error('A question has an invalid answer.')
  }
  return `${String.fromCharCode(65 + index)}. ${options[index]}`
}

export function formatQuestionsForCopy(questions) {
  return questions.map((question, index) => {
    const options = question.options.map((option, optionIndex) =>
      formatOption(question.options, optionIndex),
    )
    return [
      `Question ${index + 1}: ${question.question}`,
      ...options,
      `Correct answer: ${formatOption(question.options, question.correctOption)}`,
    ].join('\n')
  }).join('\n\n')
}

export async function copyQuestions(questions, clipboard) {
  if (!clipboard?.writeText) {
    throw new Error('Clipboard access is unavailable. Use HTTPS or localhost.')
  }
  await clipboard.writeText(formatQuestionsForCopy(questions))
}
