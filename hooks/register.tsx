import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Check, Hit } from '../types'
import { gitAction, gitDirectory, scanDiff, stagesBeforeCommit } from './scan'
import type { GitAction } from './scan'

const PANE = 'privacy-guard'
const last = atom({ plugin: 'privacy-guard', key: 'last' } as const, null as Check | null)
const checked = atom({ plugin: 'privacy-guard', key: 'checked' } as const, 0)
const blocked = atom({ plugin: 'privacy-guard', key: 'blocked' } as const, 0)
const isHidden = atom({ plugin: 'privacy-guard', key: 'isHidden' } as const, false)

// Only the person can let names through: Claude cannot answer this dialog.
// Tokens are never let through.
const ALLOW = 'Commit anyway'
const BLOCK = 'Block it'

const git = async ($: EngineInterface, cwd: string | undefined, args: string[]) => {
  const ran = await $.process.run(['git', ...args], { cwd })
  return ran.exitCode === 0 ? ran.stdout : undefined
}

// The lines this commit or push would add.
const pendingDiff = async ($: EngineInterface, cwd: string | undefined, action: NonNullable<GitAction>) => {
  if (action.kind === 'commit') return git($, cwd, ['diff', action.isAll ? 'HEAD' : '--cached', '-U0', '--no-color'])

  for (const base of ['@{upstream}', 'origin/HEAD', 'origin/main']) {
    const diff = await git($, cwd, ['diff', '-U0', '--no-color', `${base}...HEAD`])
    if (diff !== undefined) return diff
  }
  return undefined
}

const statusText = (n: number, b: number) => `🛡️ privacy-guard · ${n} checked · ${b} blocked`

// Asks the person whether these names may be committed. Dismissed, or no one
// to ask (a -p run), counts as no.
const askPerson = async ($: EngineInterface, kind: string, hits: Hit[]) => {
  const list = hits.slice(0, 5).map(hit => hit.match).join(', ')
  try {
    const answer = await $.ui.ask(`privacy-guard found personal names in this git ${kind}: ${list}. Commit them anyway?`, {
      options: [BLOCK, ALLOW],
      header: 'Privacy',
    })
    return answer === ALLOW
  } catch {
    return false
  }
}

const describe = (hits: Hit[]) =>
  hits.map(hit => `  ${hit.file}:${hit.line}  ${hit.kind === 'token' ? 'token' : 'name'}  ${hit.match}`).join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'privacy-guard', description: 'Show the last privacy check in a pane' })
    $.ui.status(statusText(await read($, checked), await read($, blocked)))
    return next(e)
  })

  on('command.run', { command: 'privacy-guard' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Privacy guard' })
    return { text: 'Privacy guard pane opened.' }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const action = gitAction(e.command)
    if (action === null) return next(e)

    if (action.kind === 'commit' && stagesBeforeCommit(e.command)) {
      $.ui.toast('🛡️ privacy-guard: stage first, then commit in a separate command')
      return {
        deny:
          'privacy-guard checks the staged changes before a command runs, so it cannot see what ' +
          '`git add` in this same command would stage. Run the `git add` (or rm/mv) on its own first, ' +
          'then run `git commit` as a separate command.',
      }
    }

    const diff = await pendingDiff($, gitDirectory(e.command), action)
    const hits = diff === undefined ? [] : scanDiff(diff)
    const names = hits.filter(hit => hit.kind === 'name').length
    const tokens = hits.length - names
    const isAllowed = hits.length > 0 && tokens === 0 && (await askPerson($, action.kind, hits))
    const isBlocked = hits.length > 0 && !isAllowed

    await update($, last, () => ({ command: e.command, hits, isBlocked, isAllowed }))
    await update($, isHidden, () => false)
    const n = await update($, checked, c => c + 1)
    const b = isBlocked ? await update($, blocked, c => c + 1) : await read($, blocked)
    $.ui.status(statusText(n, b))

    if (hits.length === 0) {
      $.ui.toast(`🛡️ privacy-guard: git ${action.kind} is clean`)
      return next(e)
    }
    if (isAllowed) {
      $.ui.toast(`⚠️ privacy-guard: you allowed ${names} name(s) in this git ${action.kind}`)
      return next(e)
    }

    $.ui.toast(`⚠️ privacy-guard: blocked git ${action.kind} — ${names} name(s), ${tokens} token(s)`)
    void $.ui.open({ id: PANE, title: 'Privacy guard' })

    return {
      deny:
        `privacy-guard blocked this git ${action.kind}: the changes add personal names or secrets.\n` +
        `${describe(hits)}\n` +
        (tokens > 0
          ? 'Remove the tokens; they are never committed. '
          : 'The user was asked and did not allow it. ') +
        'Replace names with roles ("the presenter", "the organizer") and try again. ' +
        'Do not retry the same changes or try to get around this check.',
    }
    // A failed check (git missing, not a repo) lets the command through rather than wedging it.
  }).catch(($, e, next) => next(e))

  // The shield band above the prompt: armed before any check, then the last verdict.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const check = await read($, last)
    const n = await read($, checked)
    const b = await read($, blocked)

    const [color, head, body] =
      check === null
        ? ['cyan', '🛡️ ARMED', 'watching git commit / push for names and Slack tokens']
        : check.isAllowed
          ? ['yellow', '⚠️ ALLOWED', `you let ${check.hits.length} name(s) through: ${check.hits.slice(0, 3).map(hit => hit.match).join(', ')}`]
          : check.isBlocked
          ? ['red', '⛔ BLOCKED', `${check.hits.length} hit(s): ${check.hits.slice(0, 3).map(hit => hit.match).join(', ')}`]
          : ['green', '✅ CLEAN', 'last git write had no names or tokens']

    return (
      <Box>
        <Text color={color} bold>
          {head}{' '}
        </Text>
        <Text>{body} </Text>
        <Text dimColor>
          · {n} checked · {b} blocked{' '}
        </Text>
        {check === null ? null : (
          <Button key="details" label="Details" onPress={() => $.ui.open({ id: PANE, title: 'Privacy guard' })} />
        )}
        <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const check = await read($, last)

    if (check === null) return <Text dimColor>No git commit or push checked yet.</Text>

    return (
      <Box flexDirection="column">
        <Text bold color={check.isAllowed ? 'yellow' : check.isBlocked ? 'red' : 'green'}>
          {check.isAllowed
            ? `Allowed by you: ${check.hits.length} hit(s)`
            : check.isBlocked
              ? `Blocked: ${check.hits.length} hit(s)`
              : 'Clean: nothing found'}
        </Text>
        <Text dimColor>{check.command.slice(0, 60)}</Text>
        {check.hits.map(hit => (
          <Box flexDirection="column" marginTop={1}>
            <Text>
              <Text color={hit.kind === 'token' ? 'magenta' : 'yellow'}>{hit.kind === 'token' ? 'TOKEN' : 'NAME '}</Text>{' '}
              <Text bold>{hit.match}</Text>
            </Text>
            <Text dimColor>
              {hit.file}:{hit.line}
            </Text>
          </Box>
        ))}
      </Box>
    )
  })
}
