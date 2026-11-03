"""Exercise the sound-library preview on the machine's default audio output."""
import time
from e2e.harness import flow, wait


@flow('madman_preview_sound', 'Play and stop the built-in music preview and check the output device')
def madman_preview_sound(r):
    r.s.run("window.__nuzky.store.setState({panelTab:'audio'})")
    r.s.run("document.querySelector('#audio-tab-music')?.click()")
    button = '[data-sound="nuzky:dancing"] button[aria-label^="Play"]'
    r.check('the built-in song has a preview button', wait(lambda: r.s.run('return !!document.querySelector(arguments[0])', button), 15))
    r.check('all three offline songs are listed', r.s.run("return ['nuzky:dancing','nuzky:duru-rondo','nuzky:duru-roomscene-lofi'].every(id=>!!document.querySelector(`[data-sound=\"${id}\"]`))"))
    r.check('the preview offset is explained', r.s.run("return document.querySelector('[data-sound=\"nuzky:dancing\"]')?.innerText.includes('Náhled od 0:20')"))
    r.s.run("""const a=window.__nuzky.api, old=a.soundPreview; a.soundPreview=(id)=>old(id).then(x=>{window.previewTest=x;return x});""")
    r.s.run('document.querySelector(arguments[0])?.click()', button)
    playing = wait(lambda: r.s.run("const p=window.__nuzky.sounds.getState().preview; return p?.id==='nuzky:dancing' && !p.loading"), 30)
    r.check('music preview starts', playing, r.s.run('return window.__nuzky.sounds.getState().preview'))
    r.check('the music preview begins at the audible section', wait(lambda: r.s.run('return window.previewTest?.startUs') == 20_000_000, 5))
    time.sleep(2)
    log = (r.work / 'app.log').read_text(encoding='utf-8', errors='replace')
    r.check('the default audio device opened without an output error', not any(s in log for s in ('No audio output', 'Cannot open audio output', 'Cannot start audio output', 'Audio device does not offer f32')), log[-800:])
    r.s.run('document.querySelector(\'[data-sound="nuzky:dancing"] button[aria-label^="Stop"]\')?.click()')
    r.check('the preview stops on request', wait(lambda: r.s.run('return window.__nuzky.sounds.getState().preview === null'), 5))
    other = '[data-sound="nuzky:duru-roomscene-lofi"] button[aria-label^="Play"]'
    r.s.run('window.previewTest=null; document.querySelector(arguments[0])?.click()', other)
    r.check('the new offline song plays from its start', wait(lambda: r.s.run('return window.previewTest?.startUs') == 0, 15))
    r.s.run('document.querySelector(\'[data-sound="nuzky:duru-roomscene-lofi"] button[aria-label^="Stop"]\')?.click()')
    r.s.run("document.querySelector('#audio-tab-effects')?.click(); window.previewTest=null")
    effect = '[data-sound="nuzky:whoosh"] button[aria-label^="Play"]'
    r.check('a built-in effect has a preview button', wait(lambda: r.s.run('return !!document.querySelector(arguments[0])', effect), 10))
    r.s.run('document.querySelector(arguments[0])?.click()', effect)
    r.check('the effect preview starts at the beginning', wait(lambda: r.s.run('return window.previewTest?.startUs') == 0, 15))
    r.check('no editor errors', not r.errors(), r.errors())
