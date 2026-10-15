# privacy-guard

A Claude Code Mod that stops Claude from committing personal names or Slack tokens.

Before Claude runs `git commit` or `git push`, it scans the lines the commit or push would add. If it finds any of these, it blocks the command and tells Claude each hit's file and line:

- Japanese names with an honorific: `山田さん`, `タナカ様`, `佐藤先生`, `鈴木氏` (kanji or katakana)
- Romanized forms: `Yamada-san`, `Sato-sensei`
- Slack tokens: `xoxb-…`, `xoxp-…`, `xapp-…` (shown masked)

You also get a toast (`⚠️ blocked` or `🛡️ clean`) and a pane listing each hit. `/privacy-guard` reopens the pane.

Words that name nobody (`皆さん`, `お客様`, `ご苦労様`, `先生` on its own) are ignored. To commit a name on purpose, put `PRIVACY_GUARD_ALLOW=1` in the command. If the check itself fails (for example, outside a git repo), the command runs as normal.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install privacy-guard --marketplace taketonomy/privacy-guard
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install privacy-guard --marketplace taketonomy/privacy-guard
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `taketonomy/privacy-guard`, then Add plugin.

## Try it

1. Stage a file containing `主催: 山田さん` and ask Claude to commit it. The commit is blocked and the pane lists `山田さん`.
2. Ask Claude to replace the name with a role ("the organizer") and commit again. It goes through.

## Develop

```
claude --plugin-dir /path/to/privacy-guard
claude plugin validate .
claude plugin test .
```

The detection rules are in `hooks/scan.ts`; the blocking, toast and pane are in `hooks/register.tsx`.

## License

MIT. See [LICENSE](LICENSE).
