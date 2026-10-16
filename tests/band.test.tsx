import { expect, test } from 'claude-code/testing'

const BAND = { component: 'AbovePrompt' as const, props: {} as never }

test('the shield band is armed before any check, on every surface', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'privacy-guard', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /ARMED/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /0 checked · 0 blocked/ })).toBeDefined()
    await ui.unmount()
  }
})

test('Hide hides the band', async ($, on) => {
  // Stands for the engine's own band beneath the plugin.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine band</Text>
  })
  const ui = await $.ui.mount({ plugin: 'privacy-guard', surface: 'terminal', ...BAND })
  await ui.press({ key: 'hide' })
  expect(await ui.find({ type: 'Text', text: /ARMED/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /engine band/ })).toBeDefined()
  await ui.unmount()
})
