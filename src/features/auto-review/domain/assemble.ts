import { CRITERIA, CRITERIA_BY_CODE } from '../data/criteria'
import type { CriterionDefinition } from '../data/criteria'
import type { CriterionResult, CriterionStatus } from '../types'
import { normalizeFinding } from './findings'
import type { StaticCheckOutcome } from './code-checks'
import type { ModelVerdict } from './contract'
import { verdictsByCode } from './contract'
import type { BasicResult } from './playwright'

export type AssembleInput = {
  at: string
  playwright: BasicResult[] | null
  static: StaticCheckOutcome[]
  model: ModelVerdict[]
  explanations: ModelVerdict[]
  modelError?: string | null
}

type Core = {
  status: CriterionStatus
  reason: string
  evidence: string[]
  findings: string[]
}

const NOT_CHECKED_REASON = 'Проверка не выполнена.'

function fromBasic(result: BasicResult | undefined): Core {
  if (!result) {
    return {
      status: 'not_checked',
      reason: NOT_CHECKED_REASON,
      evidence: [],
      findings: [],
    }
  }
  return {
    status: result.status,
    reason: result.reason,
    evidence: result.evidence,
    findings: [],
  }
}

function staticReason(status: CriterionStatus): string {
  if (status === 'pass') {
    return 'Замечаний не найдено.'
  }
  if (status === 'not_checked') {
    return 'Проверка не применима: подходящих файлов не найдено.'
  }
  return 'Найдены нарушения правила.'
}

function fromStatic(result: StaticCheckOutcome | undefined): Core {
  if (!result) {
    return {
      status: 'not_checked',
      reason: NOT_CHECKED_REASON,
      evidence: [],
      findings: [],
    }
  }
  return {
    status: result.status,
    reason: staticReason(result.status),
    evidence: result.evidence,
    findings: result.findings,
  }
}

function fromModel(
  verdict: ModelVerdict | undefined,
  error: string | null,
): Core {
  if (!verdict) {
    return {
      status: 'not_checked',
      reason: error
        ? `Модель не оценила критерий: ${error}`
        : 'Модель не оценила критерий.',
      evidence: [],
      findings: [],
    }
  }
  return {
    status: verdict.status ?? 'not_checked',
    reason: verdict.reason,
    evidence: [],
    findings: verdict.findings,
  }
}

function fallbackFindings(code: string, core: Core): string[] {
  if (core.findings.length > 0) {
    return core.findings
  }
  if (core.status !== 'fail') {
    return []
  }
  if (core.evidence.length > 0) {
    return [`следует исправить: ${core.evidence[0]}`].map(
      (item) => normalizeFinding(item) ?? item,
    )
  }
  return [`следует устранить замечания по критерию ${code}`]
}

function coreFor(
  evaluation: CriterionDefinition['evaluation'],
  code: string,
  sources: {
    basics: Map<string, BasicResult>
    statics: Map<string, StaticCheckOutcome>
    models: Map<string, ModelVerdict>
    modelError: string | null
  },
): Core {
  if (evaluation === 'playwright') {
    return fromBasic(sources.basics.get(code))
  }
  if (evaluation === 'static') {
    return fromStatic(sources.statics.get(code))
  }
  return fromModel(sources.models.get(code), sources.modelError)
}

function findingsFor(
  evaluation: CriterionDefinition['evaluation'],
  code: string,
  source: Core,
  explained: ModelVerdict | undefined,
): string[] {
  if (evaluation === 'model' && source.findings.length === 0) {
    return fallbackFindings(code, source)
  }
  if (explained && explained.findings.length > 0) {
    return explained.findings
  }
  return fallbackFindings(code, source)
}

export function assembleResults(input: AssembleInput): CriterionResult[] {
  const basics = new Map(
    (input.playwright ?? []).map((item) => [item.code, item]),
  )
  const statics = new Map(input.static.map((item) => [item.code, item]))
  const models = verdictsByCode(input.model)
  const explanations = verdictsByCode(input.explanations)

  return CRITERIA.map((criterion) => {
    const definition = CRITERIA_BY_CODE.get(criterion.code)
    const source = coreFor(criterion.evaluation, criterion.code, {
      basics,
      statics,
      models,
      modelError: input.modelError ?? null,
    })
    const explained = explanations.get(criterion.code)
    const findings = findingsFor(
      criterion.evaluation,
      criterion.code,
      source,
      explained,
    )
    const reason =
      explained && explained.reason.length > 0
        ? explained.reason
        : source.reason

    return {
      code: criterion.code,
      group: definition?.group ?? criterion.group,
      section: criterion.section,
      title: criterion.title,
      rule: criterion.rule,
      status: source.status,
      reason,
      findings,
      evidence: source.evidence,
      checkedAt: input.at,
    }
  })
}
