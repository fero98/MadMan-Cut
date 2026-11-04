"""Install the release gallery's real plugin files from an isolated local server."""
import json
from e2e.harness import FIXTURES, ROOT, flow, wait
from e2e.plugins_gallery import Gallery

IDS = ('vhs', 'remove-short-clips', 'follow-end-card')


def prepare(r):
    r.gallery = Gallery()
    r.env['NUZKY_GALLERY_URL'] = r.gallery.root
    base = ROOT / 'plugins'
    if not base.exists():
        base = ROOT / 'target/madman-release-014/plugins'
    for name in IDS:
        folder = base / name
        files = {p.relative_to(folder).as_posix(): p.read_bytes() for p in folder.rglob('*') if p.is_file()}
        r.gallery.add(json.loads(files['plugin.json']), files)


@flow('madman_gallery', 'Install and exercise the three Czech gallery plugins in an isolated project', before=prepare)
def madman_gallery(r):
    try:
        r.import_media(FIXTURES / 'talk.mp4')
        r.add_clip('talk.mp4')
        r.s.run("window.__nuzky.store.setState({panelTab:'plugins'}); window.__nuzky.gallery.setState({tab:'gallery'})")
        r.check('the gallery shows all three reviewed plugins', wait(lambda: all(r.s.run("return !!document.querySelector(`[data-gallery-plugin=\"${arguments[0]}\"]`)", name) for name in IDS), 15))
        for name in IDS:
            r.s.run("document.querySelector(`[data-gallery-plugin=\"${arguments[0]}\"]`)?.click()", name)
            ready = wait(lambda: r.s.run("return !!document.querySelector('[data-gallery-main]')"), 5)
            clicked = ready and r.s.run("const b=document.querySelector('[data-gallery-main]'); if(!b||b.disabled)return false; b.click(); return true")
            installed = wait(lambda: r.s.run("return window.__nuzky.gallery.getState().list?.find(p=>p.id===arguments[0])?.state === 'installed'", name), 20)
            r.check(f'{name} installs from verified files', clicked and installed)
        r.s.run("window.__nuzky.gallery.setState({tab:'installed'})")
        r.check('all three installed plugins load without errors', wait(lambda: r.s.run("const a=window.__nuzky.plugins.getState().list; return !!a && arguments[0].every(id=>a.some(p=>p.id===id && !p.error))", list(IDS)), 15))
        r.check('the VHS shader validates', r.s.run("const p=window.__nuzky.plugins.getState().list?.find(p=>p.id==='vhs'); return !!p?.effects?.length && p.effects.every(e=>!e.error)"))
        r.s.run("document.querySelector('[data-plugin=\"follow-end-card\"]')?.click()")
        r.check('the end card plugin opens', wait(lambda: r.s.run("return window.__nuzky.plugins.getState().open==='follow-end-card'"), 5))
        ran = wait(lambda: r.s.run("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Přidat text'); if(!b||b.disabled)return false; b.click(); return true"), 10)
        r.check('the end card adds Czech text to the project', ran and wait(lambda: r.s.run("return window.__nuzky.store.getState().snap.project.tracks.flatMap(t=>t.clips).some(c=>c.content?.text?.includes('Sledujte pro další videa'))"), 15))
        clip = r.track()[0]
        effect = r.s.call("window.__nuzky.store.getState().edit({type:'setEffects',clipId:arguments[0],effects:[{plugin:'vhs',effect:'vhs',name:'Filmové VHS',version:'1.0.0',params:{amount:0.6,lines:true,tint:'#FFC890'}}]})", clip['id'])
        r.check('the VHS effect is applied to a real video clip', effect['ok'] and wait(lambda: r.s.run("return window.__nuzky.store.getState().snap.project.tracks.flatMap(t=>t.clips).find(c=>c.id===arguments[0])?.effects?.[0]?.effect==='vhs'", clip['id']), 10))
        split = r.s.call("window.__nuzky.store.getState().edit({type:'splitClip',clipId:arguments[0],atUs:600000})", clip['id'])
        r.check('the test clip is split for the short-clips plugin', split['ok'] and wait(lambda: len(r.track()) == 2, 5))
        r.s.run("window.__nuzky.store.setState({panelTab:'plugins'}); document.querySelector('[data-plugin=\"remove-short-clips\"]')?.click()")
        remove = wait(lambda: r.s.run("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Odstranit klipy'); if(!b||b.disabled)return false; b.click(); return true"), 10)
        r.check('the short-clips plugin removes the short part', remove and wait(lambda: len(r.track()) == 1, 15))
        r.shot('madman-gallery-installed')
    finally:
        r.gallery.stop()
