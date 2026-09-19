import type { ReactNode } from 'react'
import type { ChatMessage } from './Chat'
import UserBubble from './UserBubble'
import AssistantBubble from './AssistantBubble'

export default function ChatMessageView({
  message,
  renderAssistant,
}: {
  message: ChatMessage
  renderAssistant?: (message: ChatMessage) => ReactNode
}) {
  if (message.role === 'user') {
    return <UserBubble content={message.content} />
  }
  return <AssistantBubble message={message} renderAssistant={renderAssistant} />
}
