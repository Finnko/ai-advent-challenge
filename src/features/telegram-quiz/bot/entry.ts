import { requireEnv } from '@lib/llm.server'
import { createQuizBot } from '../server/bot.server'
import {
  parseAllowedUserIds,
  resolveQuizEndpoint,
} from '../server/config.server'
import { createLocalQuestionGenerator } from '../server/generator.server'

const token = requireEnv('TELEGRAM_BOT_TOKEN')
const allowedUserIds = parseAllowedUserIds(
  process.env.TELEGRAM_ALLOWED_USER_IDS,
)

const bot = createQuizBot({
  token,
  allowedUserIds,
  generator: createLocalQuestionGenerator({ endpoint: resolveQuizEndpoint() }),
})

process.once('SIGINT', () => bot.stop())
process.once('SIGTERM', () => bot.stop())

await bot.start()
