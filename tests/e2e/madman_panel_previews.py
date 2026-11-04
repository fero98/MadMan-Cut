"""Check the real editor's empty and actionable filter/transition panels."""
from e2e.harness import FIXTURES, WINDOWS, flow, wait, webdriver


@flow('madman_panel_previews', 'Show filter examples and transitions before a clip or cut is selected')
def madman_panel_previews(r):
    r.s.run("window.__nuzky.store.setState({panelTab:'transitions'})")
    visible = wait(lambda: r.s.run("return document.body.innerText.includes('Náhledy přechodů')"), 5)
    count = r.s.run("return [...document.querySelectorAll('button[title=\"Nejprve vytvořte střih mezi dvěma klipy\"]')].length")
    r.check('the empty timeline lists all 13 unavailable transitions with guidance', visible and count == 13, count)
    r.shot('transitions-empty')
    r.s.run("window.__nuzky.store.setState({panelTab:'filters'})")
    r.check('the filter panel explains the illustrative preview', wait(lambda: r.s.run("return document.body.innerText.includes('Ukázkové náhledy')"), 5))
    r.check('the example filter image has a valid CSS background', r.s.run("""const b = [...document.querySelectorAll('button')].find(x => x.title === 'Nejprve vyberte video nebo obrázek');
        const layers = b ? [...b.querySelectorAll('span')] : []; return layers.some(x => getComputedStyle(x).backgroundImage.startsWith('url('));"""))
    r.shot('filters-empty')
    if WINDOWS:
        webdriver('POST', r.s.path + '/window/rect', {'width': 1024, 'height': 640})
        r.shot('filters-empty-small')
        webdriver('POST', r.s.path + '/window/rect', {'width': 1440, 'height': 900})
    r.import_media(FIXTURES / 'talk.mp4', FIXTURES / 'wide.mp4')
    r.add_clip('talk.mp4')
    r.add_clip('wide.mp4')
    clips = r.track()
    r.s.run("window.__nuzky.store.setState({selection:[arguments[0]],panelTab:'filters'})", clips[0]['id'])
    applied = r.s.run("const b=[...document.querySelectorAll('button')].find(x=>x.title==='Použít filtr Teplý'); if(!b||b.disabled)return false; b.click(); return true")
    r.check('a selected clip enables the warm filter', applied)
    r.check('the warm filter changes the clip', wait(lambda: r.s.run("const a=window.__nuzky.store.getState().snap.project.tracks.flatMap(t=>t.clips).find(c=>c.id===arguments[0])?.content?.adjust; return !!a && a.temperature > 0", clips[0]['id']), 5))
    r.s.run("window.__nuzky.store.setState({panelTab:'transitions',selection:[],cut:arguments[0]})", clips[1]['id'])
    r.check('a real cut enables transition choices', wait(lambda: r.s.run("return [...document.querySelectorAll('button')].some(b=>b.textContent.includes('Prolnutí')&&!b.disabled)"), 5))
    r.shot('transitions-available')
