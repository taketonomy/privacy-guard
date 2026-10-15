import { describe, expect, test } from 'claude-code/testing'

import { gitAction, gitDirectory, scanDiff, scanLine } from '../hooks/scan'

describe('scanLine', () => {
  test('finds names with honorifics', async () => {
    expect(scanLine('Mods の作り方をタナカさんに。主催: 山田さん').map(h => h.match)).toEqual(['タナカさん', '山田さん'])
  })
  test('ignores honorifics that name nobody', async () => {
    expect(scanLine('皆さん、お疲れ様です。お客様へ')).toEqual([])
  })
  test('finds romanized names', async () => {
    expect(scanLine('talked with Yamada-san').map(h => h.match)).toEqual(['Yamada-san'])
  })
  test('finds and masks Slack tokens', async () => {
    const hits = scanLine('botToken: xoxb-1234567890-abcdefghij')
    expect(hits.length).toBe(1)
    expect(hits[0]?.kind).toBe('token')
    expect(hits[0]?.match.includes('1234567890')).toBe(false)
  })
})

describe('scanDiff', () => {
  test('reports file and line of added lines only', async () => {
    const diff = [
      'diff --git a/events/lt.md b/events/lt.md',
      '--- a/events/lt.md',
      '+++ b/events/lt.md',
      '@@ -3,0 +4,2 @@',
      '+the presenter spoke',
      '+主催: 山田さん',
      '@@ -9 +10 @@',
      '-タナカさん (removed)',
      '+the presenter',
    ].join('\n')
    expect(scanDiff(diff)).toEqual([{ kind: 'name', match: '山田さん', file: 'events/lt.md', line: 5 }])
  })
})

describe('gitAction', () => {
  test('spots commits, commit -a and pushes', async () => {
    expect(gitAction('git add x && git commit -m "x"')).toEqual({ kind: 'commit', isAll: false })
    expect(gitAction('git commit -am "x"')).toEqual({ kind: 'commit', isAll: true })
    expect(gitAction('git push -u origin main')).toEqual({ kind: 'push' })
    expect(gitAction('git status')).toBe(null)
  })
  test('finds the directory', async () => {
    expect(gitDirectory('cd /tmp/repo && git commit -m x')).toBe('/tmp/repo')
    expect(gitDirectory('git -C "/a b" push')).toBe('/a b')
  })
})
