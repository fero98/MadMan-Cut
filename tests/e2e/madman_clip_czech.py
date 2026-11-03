"""Czech clip actions and functioning MadMan film grading in an isolated project."""
from e2e.harness import FIXTURES, flow, wait

@flow('madman_clip_czech', 'Czech clip menu and real film filter')
def madman_clip_czech(r):
    r.import_media(FIXTURES / 'talk.mp4')
    r.add_clip('talk.mp4')
    clip_id = r.track()[0]['id']
    r.s.run('window.__nuzky.store.getState().select([arguments[0]])', clip_id)
    r.seek(1_000_000)
    r.s.run('''const c = document.querySelector(`[data-clip-id="${arguments[0]}"]`); const b = c.getBoundingClientRect();
      c.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true,cancelable:true,clientX:b.left+4,clientY:b.top+4}));''', clip_id)
    labels = r.s.run("return [...document.querySelectorAll('[role=menu] [role=menuitem]')].map(i => i.children[1].textContent)")
    r.check('clip menu is Czech', all(x in labels for x in ['Rozdělit v místě přehrávání', 'Zmrazit snímek', 'Oddělit zvuk', 'Nahradit média…', 'Odstranit']), labels)
    r.shot('czech-clip-menu')
    r.s.run("document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}))")
    r.s.run("window.__nuzky.store.setState({panelTab:'filters'})")
    button = wait(lambda: r.s.run("return [...document.querySelectorAll('button')].find(b => b.title === 'Použít filtr Filmový kontrast') != null"), 10)
    r.check('film filter appears', button)
    if button:
        r.s.run("[...document.querySelectorAll('button')].find(b => b.title === 'Použít filtr Filmový kontrast').click()")
        adjust = wait(lambda: r.s.run("const c = window.__nuzky.store.getState().snap.project.tracks.flatMap(t => t.clips).find(c => c.id === arguments[0]); return c?.content?.adjust?.contrast === 0.25 ? c.content.adjust : null", clip_id), 10)
        r.check('filter changes the actual clip adjustment', bool(adjust) and abs(adjust['saturation'] + 0.12) < 0.001, adjust)
        r.shot('film-filter')
    r.check('no errors reported', not r.errors(), r.errors())
