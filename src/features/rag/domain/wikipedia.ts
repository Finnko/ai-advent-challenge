import {
  findSectionIndex,
  parseSections,
  WIKI_HEADING_RE,
  type DocSection,
} from './sections'

export type WikiSection = DocSection

export { findSectionIndex }

export function parseWikiSections(text: string): WikiSection[] {
  return parseSections(text, WIKI_HEADING_RE)
}
