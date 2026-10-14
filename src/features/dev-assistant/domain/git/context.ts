export type GitContextSection = {
  tool: string
  title: string
  text: string
}

export type GitContext = {
  available: boolean
  error: string | null
  branch: string | null
  sections: GitContextSection[]
  block: string | null
}
