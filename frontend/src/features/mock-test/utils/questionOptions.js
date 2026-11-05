const OPTION_LABELS = ['A', 'B', 'C', 'D']

function parseLabeledOption(value) {
  const option = String(value || '').trim()
  const match = option.match(/^[\(\[]?\s*([A-D])\s*[\)\].:\-]?\s+(.+)$/i)
  if (!match) {
    return null
  }

  return {
    label: match[1].toUpperCase(),
    text: match[2].trim(),
  }
}

function findLabeledOptionSequence(options) {
  const selected = []

  function findNext(labelIndex, startIndex) {
    if (labelIndex === OPTION_LABELS.length) {
      return [...selected]
    }

    for (let index = startIndex; index < options.length; index += 1) {
      if (options[index].label !== OPTION_LABELS[labelIndex]) {
        continue
      }

      selected.push(options[index])
      const sequence = findNext(labelIndex + 1, index + 1)
      selected.pop()
      if (sequence) {
        return sequence
      }
    }

    return null
  }

  return findNext(0, 0)
}

export function normalizeQuestionOptionTexts(optionsRaw) {
  if (Array.isArray(optionsRaw)) {
    const options = optionsRaw.map((option) => String(option || '').trim()).filter(Boolean)
    const labeledOptions = options.map(parseLabeledOption).filter(Boolean)

    if (labeledOptions.length >= OPTION_LABELS.length) {
      const sequence = findLabeledOptionSequence(labeledOptions)
      if (sequence) {
        return sequence.map((option) => option.text)
      }

      const optionsByLabel = new Map(labeledOptions.map((option) => [option.label, option.text]))
      if (OPTION_LABELS.every((label) => optionsByLabel.has(label))) {
        return OPTION_LABELS.map((label) => optionsByLabel.get(label))
      }
    }

    return options.slice(0, OPTION_LABELS.length)
  }

  if (optionsRaw && typeof optionsRaw === 'object') {
    return OPTION_LABELS.map((label) => {
      const option = String(optionsRaw[label] || '').trim()
      const labeledOption = parseLabeledOption(option)
      return labeledOption?.label === label ? labeledOption.text : option
    }).filter(Boolean)
  }

  return []
}

export function normalizeQuestionList(questionsRaw) {
  const questions = Array.isArray(questionsRaw) ? questionsRaw : []
  return questions.map((question, index) => {
    const normalizedOptions = normalizeQuestionOptionTexts(question?.options)
    return {
      ...question,
      id: String(question?.id || index + 1),
      options: normalizedOptions,
    }
  })
}
