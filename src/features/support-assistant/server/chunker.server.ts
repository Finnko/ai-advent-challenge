import { createMarkdownChunker } from '@lib/chunking/markdown.server'
import { SUPPORT_STRATEGY } from '../domain/constants'

export const supportChunker = createMarkdownChunker({ id: SUPPORT_STRATEGY })
