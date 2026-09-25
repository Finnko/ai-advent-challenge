import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { cityNames } from '../../domain/jobs/cities.ts'
import {
  MAX_INTERVAL_MINUTES,
  MAX_WINDOW_HOURS,
  MIN_INTERVAL_MINUTES,
  MIN_WINDOW_HOURS,
} from '../../domain/jobs/types.ts'
import type { JobToolResult, JobsToolkit } from './tools.ts'

type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

function toResponse(result: JobToolResult): ToolResponse {
  if (result.ok) {
    return { content: [{ type: 'text', text: result.text }] }
  }
  return {
    content: [{ type: 'text', text: result.text }],
    isError: true,
  }
}

export function registerJobsTools(
  server: McpServer,
  toolkit: JobsToolkit,
): void {
  server.registerTool(
    'schedule_weather_report',
    {
      title: 'Запланировать погодный отчёт',
      description:
        'Создаёт периодический сбор погоды по городу: интервал в минутах и окно ' +
        'агрегации в часах. Расписание можно создать для любого города из списка, ' +
        'даже если расписания по нему ещё нет — это и есть способ добавить новый ' +
        'город. При первом расписании для города сразу загружается ' +
        'история за 7 дней. На один город — одно расписание: повторный вызов ' +
        'вернёт уже существующее. Фоновый сбор запускает планировщик, агенту ' +
        'запускать его не нужно. Изменяющий инструмент.',
      inputSchema: {
        city: z.string().describe(`Город из списка: ${cityNames()}`),
        intervalMinutes: z
          .number()
          .int()
          .min(MIN_INTERVAL_MINUTES)
          .max(MAX_INTERVAL_MINUTES)
          .describe(
            `Интервал сбора, минуты (${MIN_INTERVAL_MINUTES}–${MAX_INTERVAL_MINUTES})`,
          ),
        windowHours: z
          .number()
          .int()
          .min(MIN_WINDOW_HOURS)
          .max(MAX_WINDOW_HOURS)
          .describe(
            `Окно агрегации, часы (${MIN_WINDOW_HOURS}–${MAX_WINDOW_HOURS})`,
          ),
      },
    },
    async (args) => toResponse(await toolkit.scheduleWeatherReport(args)),
  )

  server.registerTool(
    'cancel_schedule',
    {
      title: 'Отменить расписание',
      description:
        'Отключает расписание по id. Изменяющий инструмент.',
      inputSchema: {
        id: z.number().int().positive().describe('id расписания из list_schedules'),
      },
    },
    async (args) => toResponse(await toolkit.cancelSchedule(args)),
  )

  server.registerTool(
    'list_schedules',
    {
      title: 'Список расписаний',
      description:
        'Показывает существующие расписания, последний и следующий прогон, а ' +
        'также начало покрытия по городам. Это не список доступных городов: ' +
        'доступные города перечислены в schedule_weather_report, а отсутствие ' +
        'города в расписаниях не мешает создать для него новое расписание. ' +
        'Справочный инструмент.',
    },
    async () => toResponse(await toolkit.listSchedules()),
  )

  server.registerTool(
    'get_weather_report',
    {
      title: 'Сводка погоды',
      description:
        'Агрегированная сводка (мин/сред/макс температуры, влажности, ветра) ' +
        'по городу за окно в часах. Без города — по всем городам с расписаниями ' +
        '(это не список городов, доступных для новых расписаний). ' +
        'Если данных нет, честно сообщает, с какого момента есть покрытие.',
      inputSchema: {
        city: z
          .string()
          .optional()
          .describe(`Город (необязательно): ${cityNames()}`),
        windowHours: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Окно агрегации в часах (необязательно)'),
      },
    },
    async (args) => toResponse(await toolkit.getWeatherReport(args)),
  )

  server.registerTool(
    'get_weather_at',
    {
      title: 'Погода на момент времени',
      description:
        'Возвращает ближайший сохранённый сэмпл в пределах половины интервала ' +
        'расписания. Если рядом данных нет — сообщает о покрытии.',
      inputSchema: {
        city: z.string().describe(`Город: ${cityNames()}`),
        datetime: z
          .string()
          .describe('Дата и время в формате ISO 8601 (например 2026-09-24T15:00:00Z)'),
      },
    },
    async (args) => toResponse(await toolkit.getWeatherAt(args)),
  )

  server.registerTool(
    'run_due_jobs',
    {
      title: 'Выполнить готовые задачи',
      description:
        'Системный тик: запускает все расписания, у которых наступило время, ' +
        'сохраняет прогоны и обновляет сводки. Вызывается планировщиком и ' +
        'кнопкой «Выполнить сейчас», агенту не предлагается.',
    },
    async () => toResponse(await toolkit.runDueJobs()),
  )
}
