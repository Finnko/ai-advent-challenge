import type { SourceFile } from './sources'
import {
  baseName,
  dirName,
  isCodeFile,
  isComponentFile,
  isTestFile,
  location,
} from './sources'

export type StaticStatus = 'pass' | 'fail' | 'not_checked'

export type StaticCheckOutcome = {
  code: string
  status: StaticStatus
  evidence: string[]
  findings: string[]
}

const MAX_EVIDENCE = 12

function cap(values: string[]): string[] {
  return values.slice(0, MAX_EVIDENCE)
}

function declaredNames(content: string): Set<string> {
  const names = new Set<string>()
  const re =
    /(?:^|\n)\s*(?:export\s+)?(?:const|let|function)\s+([A-Za-z_$][\w$]*)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    names.add(match[1])
  }
  return names
}

const SAFE_HANDLER_PREFIX = /^(handle|use[A-Z]|dispatch|set[A-Z])/
const HANDLED_PROP =
  /(?:^|\n)\s*([A-Za-z_$][\w$]*)\s*[?]?\s*:\s*\([^)]*\)\s*=>/g
const ALLOWED_PROP = new Set(['children', 'className', 'style', 'ref'])

function candidateFiles(files: SourceFile[]): SourceFile[] {
  return files.filter((file) => isCodeFile(file.path) && !isTestFile(file.path))
}

function checkHandleNaming(files: SourceFile[]): StaticCheckOutcome {
  const sources = candidateFiles(files)
  if (sources.length === 0) {
    return { code: 'Д2', status: 'not_checked', evidence: [], findings: [] }
  }
  const evidence: string[] = []
  const findings: string[] = []
  for (const file of sources) {
    const declared = declaredNames(file.content)
    const re = /\bon[A-Z][A-Za-z]*\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/g
    let match: RegExpExecArray | null
    while ((match = re.exec(file.content)) !== null) {
      const name = match[1]
      if (!declared.has(name) || SAFE_HANDLER_PREFIX.test(name)) {
        continue
      }
      evidence.push(`${location(file, match.index)} — ${name}`)
      findings.push(
        `следует переименовать обработчик ${name} так, чтобы имя начиналось с handle`,
      )
    }
  }
  return {
    code: 'Д2',
    status: findings.length > 0 ? 'fail' : 'pass',
    evidence: cap(evidence),
    findings: cap(findings),
  }
}

function checkOnProps(files: SourceFile[]): StaticCheckOutcome {
  const sources = files.filter((file) => isComponentFile(file.path))
  if (sources.length === 0) {
    return { code: 'Д9', status: 'not_checked', evidence: [], findings: [] }
  }
  const evidence: string[] = []
  const findings: string[] = []
  const propsType =
    /(?:type|interface)\s+([A-Za-z_$][\w$]*Props)\b[^{]*\{([\s\S]*?)\n\}/g
  for (const file of sources) {
    let block: RegExpExecArray | null
    while ((block = propsType.exec(file.content)) !== null) {
      const typeName = block[1]
      const body = block[2]
      HANDLED_PROP.lastIndex = 0
      let prop: RegExpExecArray | null
      while ((prop = HANDLED_PROP.exec(body)) !== null) {
        const name = prop[1]
        if (ALLOWED_PROP.has(name) || name.startsWith('on')) {
          continue
        }
        evidence.push(`${file.path} — ${typeName}.${name}`)
        findings.push(
          `следует переименовать колбэк ${name} в ${typeName} так, чтобы он начинался с on`,
        )
      }
    }
  }
  return {
    code: 'Д9',
    status: findings.length > 0 ? 'fail' : 'pass',
    evidence: cap(evidence),
    findings: cap(findings),
  }
}

const ACTION_TYPE_UPPER = /^[A-Z][A-Z0-9_]*$/

function checkActionTypes(files: SourceFile[]): StaticCheckOutcome {
  const sources = candidateFiles(files)
  if (sources.length === 0) {
    return { code: 'Д19', status: 'not_checked', evidence: [], findings: [] }
  }
  const constants = new Map<string, string>()
  for (const file of sources) {
    const re = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*'([^']*)'/g
    let match: RegExpExecArray | null
    while ((match = re.exec(file.content)) !== null) {
      constants.set(match[1], match[2])
    }
  }
  const evidence: string[] = []
  const findings: string[] = []
  const seen = new Set<string>()
  for (const file of sources) {
    const re = /\btype\s*:\s*(?:'([^']*)'|"([^"]*)"|([A-Za-z_$][\w$]*))/g
    let match: RegExpExecArray | null
    while ((match = re.exec(file.content)) !== null) {
      const literal = match[1] ?? match[2]
      const value = literal ?? constants.get(match[3] ?? '')
      if (!value || seen.has(value)) {
        continue
      }
      seen.add(value)
      if (!ACTION_TYPE_UPPER.test(value)) {
        continue
      }
      evidence.push(`${location(file, match.index)} — ${value}`)
      findings.push(
        `следует переименовать тип действия ${value} по шаблону домен/действие`,
      )
    }
  }
  return {
    code: 'Д19',
    status: findings.length > 0 ? 'fail' : 'pass',
    evidence: cap(evidence),
    findings: cap(findings),
  }
}

const HOOK_CALL =
  /\buse(?:State|Effect|Ref|Memo|Callback|Reducer|Context|Selector|Dispatch|LayoutEffect|Id)\s*\(/
const TOP_DECL = /^(?:export\s+)?(?:const|function)\s+([A-Za-z_$][\w$]*)/gm

function checkHookPrefix(files: SourceFile[]): StaticCheckOutcome {
  const sources = candidateFiles(files)
  const withHooks = sources.filter((file) => HOOK_CALL.test(file.content))
  if (withHooks.length === 0) {
    return { code: 'Д21', status: 'not_checked', evidence: [], findings: [] }
  }
  const evidence: string[] = []
  const findings: string[] = []
  for (const file of withHooks) {
    const decls: { name: string; index: number }[] = []
    TOP_DECL.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = TOP_DECL.exec(file.content)) !== null) {
      decls.push({ name: match[1], index: match.index })
    }
    decls.forEach((decl, position) => {
      const end = decls[position + 1]?.index ?? file.content.length
      const body = file.content.slice(decl.index, end)
      if (!HOOK_CALL.test(body)) {
        return
      }
      if (/^use[A-Z]/.test(decl.name) || /^[A-Z]/.test(decl.name)) {
        return
      }
      evidence.push(`${location(file, decl.index)} — ${decl.name}`)
      findings.push(
        `следует переименовать хук ${decl.name} так, чтобы имя начиналось с use`,
      )
    })
  }
  return {
    code: 'Д21',
    status: findings.length > 0 ? 'fail' : 'pass',
    evidence: cap(evidence),
    findings: cap(findings),
  }
}

const STYLE_IMPORT = /from\s+['"]([^'"]+\.(?:css|scss|sass|less|styl))['"]/g

function checkComponentAssets(files: SourceFile[]): StaticCheckOutcome {
  const sources = files.filter((file) => isComponentFile(file.path))
  if (sources.length === 0) {
    return { code: 'Д11', status: 'not_checked', evidence: [], findings: [] }
  }
  const evidence: string[] = []
  const findings: string[] = []
  let styleImports = 0
  for (const file of sources) {
    STYLE_IMPORT.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = STYLE_IMPORT.exec(file.content)) !== null) {
      styleImports += 1
      const target = match[1]
      if (target.startsWith('./') && !target.includes('../')) {
        continue
      }
      evidence.push(`${location(file, match.index)} — ${target}`)
      findings.push(
        `следует перенести ресурс ${target} в директорию с компонентом ${baseName(file.path)}`,
      )
    }
  }
  if (styleImports === 0) {
    return { code: 'Д11', status: 'not_checked', evidence: [], findings: [] }
  }
  return {
    code: 'Д11',
    status: findings.length > 0 ? 'fail' : 'pass',
    evidence: cap(evidence),
    findings: cap(findings),
  }
}

const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js']
const TEST_MARKER = /\.(test|spec)\.tsx?$/

function siblingCandidates(testPath: string): string[] {
  const dir = dirName(testPath)
  const base = baseName(testPath).replace(TEST_MARKER, '')
  const prefix = dir.length > 0 ? `${dir}/` : ''
  return SOURCE_EXTENSIONS.map((extension) => `${prefix}${base}${extension}`)
}

function checkTestPlacement(files: SourceFile[]): StaticCheckOutcome {
  const tests = files.filter((file) => isTestFile(file.path))
  if (tests.length === 0) {
    return { code: 'Д24', status: 'not_checked', evidence: [], findings: [] }
  }
  const paths = new Set(files.map((file) => file.path))
  const evidence: string[] = []
  const findings: string[] = []
  for (const test of tests) {
    if (!baseName(test.path).includes('.test.')) {
      evidence.push(test.path)
      findings.push(
        `следует переименовать тест ${test.path} так, чтобы имя заканчивалось на .test.ts или .test.tsx`,
      )
      continue
    }
    if (test.path.includes('__tests__/')) {
      evidence.push(test.path)
      findings.push(
        `следует перенести тест ${test.path} рядом с тестируемым файлом`,
      )
      continue
    }
    const hasSibling = siblingCandidates(test.path).some((candidate) =>
      paths.has(candidate),
    )
    if (!hasSibling) {
      evidence.push(test.path)
      findings.push(
        `следует положить тест ${test.path} рядом с тестируемым файлом`,
      )
    }
  }
  return {
    code: 'Д24',
    status: findings.length > 0 ? 'fail' : 'pass',
    evidence: cap(evidence),
    findings: cap(findings),
  }
}

const DOM_ACCESS =
  /\bdocument\s*\.\s*(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)\b/g

function isEntryFile(path: string): boolean {
  return (
    /\/(main|index)\.tsx?$/.test(`/${path}`) && !path.includes('/components/')
  )
}

function checkNoDomAccess(files: SourceFile[]): StaticCheckOutcome {
  const sources = files.filter(
    (file) => isComponentFile(file.path) && !isEntryFile(file.path),
  )
  if (sources.length === 0) {
    return { code: 'Д28', status: 'not_checked', evidence: [], findings: [] }
  }
  const evidence: string[] = []
  const findings: string[] = []
  for (const file of sources) {
    DOM_ACCESS.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = DOM_ACCESS.exec(file.content)) !== null) {
      evidence.push(`${location(file, match.index)} — document.${match[1]}`)
      findings.push(
        `следует заменить document.${match[1]} в ${file.path} на ссылку через ref`,
      )
    }
  }
  return {
    code: 'Д28',
    status: findings.length > 0 ? 'fail' : 'pass',
    evidence: cap(evidence),
    findings: cap(findings),
  }
}

export function runStaticChecks(files: SourceFile[]): StaticCheckOutcome[] {
  return [
    checkHandleNaming(files),
    checkOnProps(files),
    checkActionTypes(files),
    checkHookPrefix(files),
    checkComponentAssets(files),
    checkTestPlacement(files),
    checkNoDomAccess(files),
  ]
}
