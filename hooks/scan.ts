import type { Hit } from '../types'

// A kanji or katakana name followed by an honorific: 山田さん, タナカさん, 坂口先生.
const NAME = /([\p{sc=Han}\p{sc=Katakana}ー]{1,6})(さん|様|先生|氏)/gu
// A romanized one: Yamada-san, Sakaguchi-sensei.
const NAME_LATIN = /\b[A-Z][a-z]+-(san|sama|sensei)\b/g
// Slack bot, user and app tokens.
const TOKEN = /\bxox[abprs]-[0-9A-Za-z-]{10,}|\bxapp-[0-9A-Za-z-]{10,}/g

// Honorifics that name nobody.
const NOT_A_NAME = new Set(['皆さん', '皆様', '客様', '客さん', '神様', '王様', '苦労様', '世話様', '奥さん', '旦那さん', '先生'])

const maskToken = (token: string) => `${token.slice(0, 5)}…${token.slice(-4)}`

export const scanLine = (text: string): Pick<Hit, 'kind' | 'match'>[] => {
  const found: Pick<Hit, 'kind' | 'match'>[] = []

  for (const m of text.matchAll(NAME)) {
    if (!NOT_A_NAME.has(m[0]) && !NOT_A_NAME.has(m[2] ?? '')) found.push({ kind: 'name', match: m[0] })
  }
  for (const m of text.matchAll(NAME_LATIN)) found.push({ kind: 'name', match: m[0] })
  for (const m of text.matchAll(TOKEN)) found.push({ kind: 'token', match: maskToken(m[0]) })

  return found
}

// Reads `git diff -U0` output and scans only the lines it adds.
export const scanDiff = (diff: string): Hit[] => {
  const hits: Hit[] = []
  let file = ''
  let line = 0

  for (const row of diff.split('\n')) {
    if (row.startsWith('+++ ')) {
      file = row.replace(/^\+\+\+ (b\/)?/, '')
      continue
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(row)
    if (hunk) {
      line = Number(hunk[1])
      continue
    }
    if (row.startsWith('+')) {
      for (const one of scanLine(row.slice(1))) hits.push({ ...one, file, line })
      line += 1
    }
  }

  return hits
}

export type GitAction = { kind: 'commit'; isAll: boolean } | { kind: 'push' } | null

// Which git write a Bash command runs, if any.
export const gitAction = (command: string): GitAction => {
  if (/\bgit\s+(-C\s+\S+\s+)?commit\b/.test(command)) {
    const isAll = /\bgit\s+(-C\s+\S+\s+)?commit\b[^;&|]*\s(-a\w*|-\w*a\w*|--all)\b/.test(command)
    return { kind: 'commit', isAll }
  }
  if (/\bgit\s+(-C\s+\S+\s+)?push\b/.test(command)) return { kind: 'push' }

  return null
}

// The directory the command runs git in: `git -C <dir>`, or a leading `cd <dir> &&`.
export const gitDirectory = (command: string): string | undefined =>
  /\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/.exec(command)?.[1]?.replace(/^["']|["']$/g, '') ??
  /^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*&&/.exec(command)?.[1]?.replace(/^["']|["']$/g, '')
