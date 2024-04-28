import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  render,
  createStreamableValue
} from 'ai/rsc'
import OpenAI from 'openai'

import {
  spinner,
  BotCard,
  BotMessage,
  SystemMessage,
  Stock,
  Purchase
} from '@/components/stocks'

import { z } from 'zod'
import { EventsSkeleton } from '@/components/stocks/events-skeleton'
import { Events } from '@/components/stocks/events'
import { StocksSkeleton } from '@/components/stocks/stocks-skeleton'
import { Stocks } from '@/components/stocks/stocks'
import { StockSkeleton } from '@/components/stocks/stock-skeleton'
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { Chat } from '@/lib/types'
import { auth } from '@/auth'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

async function confirmSession(student: name) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()


}

async function submitUserMessage(content: string) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content
      }
    ]
  })

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const ui = render({
    model: 'gpt-3.5-turbo',
    provider: openai,
    initial: <SpinnerMessage />,
    messages: [
      {
        role: 'system',
        content: `\
You are an AI tutor for grade 5 students and you can help them with their textbooks, step by step.
You and the student can discuss textbook topics and the student can ask questions or seek explanations in the UI.

Messages inside [] means that it's a UI element or a user event. For example:
- "[Question: What is photosynthesis?]" means that a question about photosynthesis is asked by the student.
- "[Student needs help with multiplication]" means that the student needs help with a multiplication problem in the UI.

If the student needs help with a topic, call \`show_topic_explanation\` to provide explanations.
If the student wants to practice a concept, call \`start_practice_session\` to initiate a practice session.
If you want to recommend additional resources, call \`list_additional_materials\`.
If the student wants to explore a new topic, or complete another learning task, respond with guidance and support.

Besides that, you can also chat with students and provide guidance on their learning journey.`
      },
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      }))
    ],
    text: ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue('')
        textNode = <BotMessage content={textStream.value} />
      }

      if (done) {
        textStream.done()
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content
            }
          ]
        })
      } else {
        textStream.update(delta)
      }

      return textNode
    },
    functions: {
      askQuestion: {
        description: 'Ask a question to ChatGPT for assistance.',
        parameters: z.object({
          question: z.string().describe('The question to ask ChatGPT')
        }),
        render: async function* ({ question }) {
          yield (
            <BotCard>
              <StockSkeleton />
            </BotCard>
          )

          await sleep(1000)

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'function',
                name: 'askQuestion',
                content: question
              }
            ]
          })

          return (
            <BotCard>
              <StockSkeleton question={question} />
            </BotCard>
          )
        }
      },
      provideExplanation: {
        description: 'Request ChatGPT to provide an explanation on a topic.',
        parameters: z.object({
          topic: z.string().describe('The topic for which explanation is needed')
        }),
        render: async function* ({ topic }) {
          yield (
            <BotCard>
              <StockSkeleton />
            </BotCard>
          )

          await sleep(1000)

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'function',
                name: 'provideExplanation',
                content: topic
              }
            ]
          })

          return (
            <BotCard>
              <StockSkeleton topic={topic} />
            </BotCard>
          )
        }
      },
      startPracticeSession: {
        description: 'Initiate a practice session with ChatGPT on a concept.',
        parameters: z.object({
          concept: z.string().describe('The concept to practice with ChatGPT')
        }),
        render: async function* ({ concept }) {
          yield (
            <BotCard>
              <StocksSkeleton />
            </BotCard>
          )

          await sleep(1000)

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'function',
                name: 'startPracticeSession',
                content: concept
              }
            ]
          })

          return (
            <BotCard>
              <StockSkeleton concept={concept} />
            </BotCard>
          )
        }
      },
      recommendResources: {
        description: 'Ask ChatGPT to recommend additional learning resources.',
        parameters: z.object({
          topic: z.string().describe('The topic for which additional resources are needed')
        }),
        render: async function* ({ topic }) {
          yield (
            <BotCard>
              <StockSkeleton />
            </BotCard>
          )

          await sleep(1000)

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'function',
                name: 'recommendResources',
                content: topic
              }
            ]
          })

          return (
            <BotCard>
              <StockSkeleton topic={topic} />
            </BotCard>
          )
        }
      }
    }
  })

  return {
    id: nanoid(),
    display: ui
  }
}

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool'
  content: string
  id: string
  name?: string
}

export type AIState = {
  chatId: string
  messages: Message[]
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    confirmSession
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  unstable_onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState()

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  },
  unstable_onSetAIState: async ({ state, done }) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const { chatId, messages } = state

      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`
      const title = messages[0].content.substring(0, 100)

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'function' ? (
          message.name === 'provideExplanation' ? (
            <BotCard>
              <StockSkeleton topic={JSON.parse(message.content)} />
            </BotCard>
          ) : message.name === 'startPracticeSession' ? (
            <BotCard>
              <StockSkeleton concept={JSON.parse(message.content)} />
            </BotCard>
          ) : message.name === 'recommendResources' ? (
            <BotCard>
              <StockSkeleton topic={JSON.parse(message.content)} />
            </BotCard>
          ) : message.name === 'exploreNewTopic' ? (
            <BotCard>
              <StockSkeleton />
            </BotCard>
          ) : null
        ) : message.role === 'user' ? (
          <UserMessage>{message.content}</UserMessage>
        ) : (
          <BotMessage content={message.content} />
        )
    }))
}

