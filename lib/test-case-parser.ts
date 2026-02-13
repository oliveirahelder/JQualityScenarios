export type ParsedScenario = {
  title: string
  steps: string
  expected: string
  notes?: string
}

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .trim()

const splitTableRow = (row: string) =>
  row
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())

const parseScenariosFromHeadings = (text: string): ParsedScenario[] => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const scenarios: ParsedScenario[] = []
  let current: ParsedScenario | null = null
  let mode: 'steps' | 'expected' | 'notes' | null = null

  const pushCurrent = () => {
    if (!current) return
    const hasContent = current.title || current.steps || current.expected || current.notes
    if (hasContent) {
      scenarios.push(current)
    }
    current = null
    mode = null
  }

  const startScenario = (title: string) => {
    pushCurrent()
    current = {
      title: title.trim() || 'Scenario',
      steps: '',
      expected: '',
    }
    mode = null
  }

  for (const line of lines) {
    const scenarioMatch = line.match(
      /^(FT-\d+|Scenario|Test Scenario|Cen[aÃ¡]rio)\s*[:\-]?\s*(.*)$/i
    )
    if (scenarioMatch) {
      const title = scenarioMatch[2] || scenarioMatch[1]
      startScenario(title)
      continue
    }

    const stepsMatch = line.match(/^(Steps?|Execution Steps?)\s*[:\-]?\s*(.*)$/i)
    if (stepsMatch) {
      if (!current) startScenario('Scenario')
      mode = 'steps'
      const value = stepsMatch[2]?.trim()
      if (value) {
        current!.steps = [current!.steps, value].filter(Boolean).join('\n')
      }
      continue
    }

    const expectedMatch = line.match(
      /^(Expected Result|Expected|Resultado esperado)\s*[:\-]?\s*(.*)$/i
    )
    if (expectedMatch) {
      if (!current) startScenario('Scenario')
      mode = 'expected'
      const value = expectedMatch[2]?.trim()
      if (value) {
        current!.expected = [current!.expected, value].filter(Boolean).join(' ')
      }
      continue
    }

    const notesMatch = line.match(/^(Notes?|Observa[cÃ§][oÃµ]es?|Obs)\s*[:\-]?\s*(.*)$/i)
    if (notesMatch) {
      if (!current) startScenario('Scenario')
      mode = 'notes'
      const value = notesMatch[2]?.trim()
      if (value) {
        current!.notes = [current!.notes, value].filter(Boolean).join(' ')
      }
      continue
    }

    const bulletMatch = line.match(/^(\d+\.\s+|-+\s+)(.*)$/)
    if (bulletMatch && current) {
      const value = bulletMatch[2]?.trim()
      if (value) {
        current.steps = [current.steps, value].filter(Boolean).join('\n')
      }
      continue
    }

    if (current) {
      if (line.startsWith('(!)') || line.startsWith('(x)')) {
        current.notes = [current.notes, line.replace(/^\((!|x)\)\s*/, '')]
          .filter(Boolean)
          .join(' ')
        continue
      }
      if (mode === 'expected') {
        current.expected = [current.expected, line].filter(Boolean).join(' ')
        continue
      }
      if (mode === 'notes') {
        current.notes = [current.notes, line].filter(Boolean).join(' ')
        continue
      }
      if (mode === 'steps') {
        current.steps = [current.steps, line].filter(Boolean).join('\n')
        continue
      }
    }
  }

  pushCurrent()
  return scenarios
}

const parseScenariosFromTable = (text: string): ParsedScenario[] => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const scenarios: ParsedScenario[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.startsWith('||')) continue

    const headerCells = line
      .split('||')
      .map((cell) => cell.trim())
      .filter(Boolean)
    if (headerCells.length < 3) continue

    const headerMap = headerCells.map(normalizeHeader)
    const headerIndex: Record<string, number> = {}
    headerMap.forEach((header, idx) => {
      headerIndex[header] = idx
    })

    i += 1
    for (; i < lines.length; i += 1) {
      const row = lines[i]
      if (!row.startsWith('|') || row.startsWith('||')) {
        i -= 1
        break
      }
      const cells = splitTableRow(row)
      if (cells.length < 3) continue

      const title =
        cells[headerIndex.testscenario ?? headerIndex.scenario ?? headerIndex.testcase ?? 1] ||
        cells[1] ||
        'Scenario'
      const steps =
        cells[headerIndex.executionsteps ?? headerIndex.steps ?? headerIndex.execution ?? 2] ||
        cells[2] ||
        ''
      const expected =
        cells[headerIndex.expectedresult ?? headerIndex.expected ?? 3] ||
        cells[3] ||
        ''
      const notes =
        cells[headerIndex.notes ?? headerIndex.note ?? headerIndex.comments ?? 5] ||
        undefined

      if (!title && !steps && !expected) continue
      scenarios.push({
        title,
        steps,
        expected,
        notes,
      })
    }
  }

  if (scenarios.length > 0) return scenarios

  const fallbackRows = lines.filter((row) => row.startsWith('|') && row.endsWith('|'))
  for (const row of fallbackRows) {
    const cells = splitTableRow(row)
    if (cells.length < 3) continue
    scenarios.push({
      title: cells[1] || cells[0] || 'Scenario',
      steps: cells[2] || '',
      expected: cells[3] || '',
      notes: cells[4] || undefined,
    })
  }

  return scenarios
}

export const parseScenariosFromContent = (text: string): ParsedScenario[] => {
  if (!text) return []
  const tableScenarios = parseScenariosFromTable(text)
  if (tableScenarios.length > 0) return tableScenarios
  return parseScenariosFromHeadings(text)
}

const ACCEPTANCE_HEADERS = [
  'acceptance criteria',
  'acceptance criterion',
  'criterios de aceitacao',
  'critério de aceitação',
  'criterio de aceitacao',
  'criterios de aceitação',
  'ac',
]

const STOP_HEADERS = [
  'user story',
  'background',
  'scenario',
  'test scenario',
  'steps',
  'execution steps',
  'expected result',
  'expected',
  'notes',
  'description',
  'summary',
]

const isHeading = (line: string, headers: string[]) => {
  const normalized = line.toLowerCase().replace(/[:\-]+$/, '').trim()
  return headers.some((header) => normalized === header)
}

export const extractAcceptanceCriteria = (text: string): string[] => {
  if (!text) return []
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  const criteria: string[] = []
  let inSection = false

  const pushCriteria = (value: string) => {
    const cleaned = value.replace(/^\d+\.\s*/, '').replace(/^[-*•]\s*/, '').trim()
    if (cleaned) {
      criteria.push(cleaned)
    }
  }

  for (const line of lines) {
    if (!line) {
      if (inSection) {
        inSection = false
      }
      continue
    }

    const inlineMatch = line.match(/^(Acceptance Criteria|Crit[eé]rios de aceita[cç][aã]o|AC)\s*[:\-]\s*(.*)$/i)
    if (inlineMatch) {
      const remainder = inlineMatch[2]?.trim()
      if (remainder) {
        remainder
          .split(/(?:\s*;\s*|\s*\|\s*|\s*•\s*)/)
          .map((entry) => entry.trim())
          .filter(Boolean)
          .forEach(pushCriteria)
      }
      inSection = true
      continue
    }

    if (isHeading(line, ACCEPTANCE_HEADERS)) {
      inSection = true
      continue
    }

    if (inSection && isHeading(line, STOP_HEADERS)) {
      inSection = false
      continue
    }

    if (inSection) {
      pushCriteria(line)
    }
  }

  const unique = Array.from(new Set(criteria.map((item) => item.trim()).filter(Boolean)))
  return unique
}
