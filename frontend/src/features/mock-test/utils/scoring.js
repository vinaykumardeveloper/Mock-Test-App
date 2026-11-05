export function getScoreSummary(questions, answers, markingScheme = {}) {
  const questionList = Array.isArray(questions) ? questions : []
  const answerMap = answers && typeof answers === 'object' ? answers : {}
  let correct = 0
  let answered = 0
  questionList.forEach((question) => {
    const answer = answerMap[question.id]
    if (Number.isInteger(answer)) {
      answered += 1
    }
    if (answer === question.correctOption) {
      correct += 1
    }
  })

  const total = questionList.length
  const incorrect = answered - correct
  const correctMarks = Number.isFinite(Number(markingScheme?.correct))
    ? Number(markingScheme.correct)
    : 1
  const incorrectMarks = Number.isFinite(Number(markingScheme?.incorrect))
    ? Number(markingScheme.incorrect)
    : 0
  const roundMarks = (value) => Math.round(value * 100) / 100

  return {
    total,
    correct,
    incorrect,
    notAnswered: total - answered,
    correctMarks,
    incorrectMarks,
    score: roundMarks(correct * correctMarks + incorrect * incorrectMarks),
    maxScore: roundMarks(total * correctMarks),
  }
}
