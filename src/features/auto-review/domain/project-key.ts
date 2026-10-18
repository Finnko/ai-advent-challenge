const MAX_KEY_LENGTH = 120

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  і: 'i',
  ї: 'yi',
  є: 'ye',
  ґ: 'g',
  ў: 'u',
}

export function projectKeyFromSourceName(source: string): string {
  const path = source.trim().replace(/[\\/]+$/, '')
  const base = path.split(/[\\/]/).pop() ?? ''
  const name = base
    .replace(/\.zip$/i, '')
    .normalize('NFKC')
    .toLowerCase()
  const transliterated = Array.from(
    name,
    (char) => TRANSLIT[char] ?? char,
  ).join('')
  return transliterated
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}._@+-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, MAX_KEY_LENGTH)
    .replace(/[-.]+$/, '')
}
