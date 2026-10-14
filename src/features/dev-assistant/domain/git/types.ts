export type GitCommit = {
  hash: string
  date: string
  author: string
  subject: string
}

export type GitChangedFile = {
  status: string
  path: string
}

export type GitDiff = {
  base: string | null
  text: string
  truncated: boolean
  lines: number
}

export type GitStatus = {
  text: string
  clean: boolean
}

export type GitSource = {
  branch(): Promise<string>
  status(): Promise<GitStatus>
  log(limit: number): Promise<GitCommit[]>
  changedFiles(base?: string | null): Promise<GitChangedFile[]>
  diff(options: {
    base?: string | null
    path?: string | null
    maxLines: number
  }): Promise<GitDiff>
}
