"""The fork identifies itself and never offers an upstream installer over the local build."""
import time
import subprocess
from pathlib import Path
from e2e.harness import MACOS, export, flow, wait, webdriver


@flow('madman_identity', 'MadMan Cut shows its own title and version with upstream updates disabled', home=True)
def madman_identity(r):
    identity = """const updates = window.__nuzky.updates.getState();
    return {title: document.title, enabled: updates.enabled, version: updates.version,
            text: document.body.innerText};"""
    r.check('fork identity finished loading', wait(lambda: r.s.run(identity)['version'], 10))
    current = r.s.run(identity)
    r.check('the page identifies the fork', current['title'] == 'MadMan Cut', current['title'])
    r.check('the sidebar identifies the fork', 'MadMan Cut ' + current['version'] in current['text'])
    r.check('upstream updates are disabled', current['enabled'] is False)
    r.check('the fork offers no upstream update menu',
            not r.s.run("return !!document.querySelector('[data-version], [data-update-button]')"))
    r.check('the home screen offers the primary media action',
            r.s.run("return !![...document.querySelectorAll('button')].find(b => b.textContent.includes('Otevřít video'))"))
    r.check('the home screen displays the MadMan Cut brand',
            r.s.run("return !!document.querySelector('[aria-label=\"MadMan Cut\"]')"))
    r.check('all three social profile buttons appear',
            r.s.run("return ['youtube','tiktok','facebook'].every(x => !!document.querySelector(`[data-social=\"${x}\"]`))"))
    social_urls = r.s.run("""const api = window.__nuzky.api, old = api.openSoundPage, urls = [];
        api.openSoundPage = (url) => { urls.push(url); return Promise.resolve(); };
        for (const id of ['youtube', 'tiktok', 'facebook']) document.querySelector(`[data-social="${id}"]`).click();
        api.openSoundPage = old; return urls;""")
    r.check('social buttons send the requested HTTPS addresses to the browser opener', social_urls == [
        'https://www.youtube.com/channel/UCA1TBCfRRP9GlgSTVgg6ZOw',
        'https://www.tiktok.com/@madmanstudio',
        'https://www.facebook.com/profile.php?id=61596274764276'], social_urls)
    r.check('the home sidebar does not show diagnostics',
            r.s.run("const p=document.querySelector('[aria-label=\"MadMan Cut\"]')?.closest('.pane'); return !!p && !p.querySelector('[data-feedback]')"))
    r.check('the editor uses the warm MadMan accent',
            r.s.run("return getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim().toLowerCase()") == '#ffb16e')
    r.check('no startup error', not r.errors(), r.errors())
    r.shot('madman-home')
    r.s.run("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Váš styl')?.click()")
    r.check('style page shows Czech controls', wait(lambda: r.s.run("""const s = document.querySelector('main');
        return s?.innerText.includes('MadMan Cut se učí váš styl střihu') &&
               s.innerText.includes('Upravit jako text') && s.innerText.includes('Naučit můj styl') &&
               !!s.querySelector('input[placeholder="Napište AI, co má nebo nemá dělat"]');"""), 10))
    r.shot('madman-style-czech')
    r.s.run("window.__nuzky.library.setState({page: 'projects', filter: 'all'})")
    r.check('returns to projects', wait(lambda: r.s.run("return window.__nuzky.library.getState().page === 'projects'"), 5))
    previous = r.s.run("return window.__nuzky.store.getState().snap.path")
    r.s.run("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Přehrát návod'))?.click()")
    r.check('the guide opens without changing project', wait(lambda: r.s.run("return !!document.querySelector('dialog[open][aria-labelledby=guide-title]')"), 10)
            and r.s.run("return window.__nuzky.store.getState().snap.path") == previous)
    r.check('the subtitled guide loads and plays', wait(lambda: r.s.run("const v = document.querySelector('dialog[open] video'); return !!v && v.readyState >= 2 && v.duration > 130 && v.currentTime > 0"), 15))
    r.shot('madman-guide')
    r.s.run("document.querySelector('dialog[open] button[aria-label=\"Zavřít průvodce\"]')?.click()")
    r.check('the guide closes without changing project', wait(lambda: r.s.run("return !document.querySelector('dialog[open][aria-labelledby=guide-title]')"), 5)
            and r.s.run("return window.__nuzky.store.getState().snap.path") == previous)
    if not MACOS:
        webdriver('POST', r.s.path + '/window/rect', {'width': 1024, 'height': 640})
        visible = """const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Otevřít video'));
        if (!b) return false; const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;"""
        r.check('the media action is visible in the smallest window', wait(lambda: r.s.run(visible), 5))
        r.shot('madman-home-small')
        r.s.run("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Váš styl')?.click()")
        r.check('Czech style controls fit in the smallest window', wait(lambda: r.s.run("""const b = [...document.querySelectorAll('main button')].find(x => x.textContent.includes('Naučit můj styl'));
            if (!b) return false; const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;"""), 5))
        r.shot('madman-style-czech-small')
        r.s.run("window.__nuzky.library.setState({page: 'projects', filter: 'all'})")
        r.s.run("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Přehrát návod'))?.click()")
        r.check('the guide fits in the smallest window', wait(lambda: r.s.run("""const d = document.querySelector('dialog[open][aria-labelledby=guide-title]');
            if (!d) return false; const b = d.getBoundingClientRect();
            return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight;"""), 5))
        r.shot('madman-guide-small')
        r.s.run("document.querySelector('dialog[open] button[aria-label=\"Zavřít průvodce\"]')?.click()")
    r.s.run("document.querySelector('header button[title^=\"Back to the editor\"]')?.click()")
    r.check('the editor opens from the home screen', wait(lambda: r.s.run("return window.__nuzky.store.getState().view === 'editor'"), 5))
    r.check('the editor library has its own labelled header',
            r.s.run("return document.querySelector('[data-tour=library]')?.textContent.includes('Média a tvorba')"))
    r.check('the editor uses its new split icon rather than scissors',
            r.s.run("return !!document.querySelector('svg.lucide-split') && !document.querySelector('svg.lucide-scissors, svg.lucide-scissors-line-dashed')"))
    r.check('editor tabs are labelled in Czech',
            r.s.run("return ['Média','Zvuk','Titulky','Přepis','Přechody'].every(t => [...document.querySelectorAll('[role=tab]')].some(b => b.textContent.trim() === t))"))
    r.check('empty editor guides the user in Czech',
            r.s.run("return document.body.innerText.includes('Importovat média') && document.body.innerText.includes('Zde se zobrazí vaše video')"))
    r.shot('madman-editor-small')
    r.s.run("window.__nuzky.store.setState({panelTab: 'text'})")
    for platform, url in [('youtube', 'https://www.youtube.com/channel/UCA1TBCfRRP9GlgSTVgg6ZOw'),
                          ('tiktok', 'https://www.tiktok.com/@madmanstudio'),
                          ('facebook', 'https://www.facebook.com/profile.php?id=61596274764276')]:
        r.check(f'{platform} text preset is visible', wait(lambda: r.s.run("return !!document.querySelector(`[data-social-text=\"${arguments[0]}\"]`)", platform), 5))
        r.s.run("document.querySelector(`[data-social-text=\"${arguments[0]}\"]`)?.click()", platform)
        r.check(f'{platform} address is added to the actual project', wait(lambda: r.s.run("return window.__nuzky.store.getState().snap.project.tracks.some(t => t.clips.some(c => c.content.type === 'text' && c.content.text === arguments[0]))", url), 10))
    r.s.call("window.__nuzky.store.getState().undo().then(() => window.__nuzky.store.getState().undo()).then(() => window.__nuzky.store.getState().undo())")
    r.check('social text edits can be undone', wait(lambda: r.s.run("return !window.__nuzky.store.getState().snap.project.tracks.some(t => t.clips.some(c => c.content.type === 'text' && c.content.text.includes('madmanstudio')))"), 10))
    r.s.run("document.querySelector('header button[title*=\"AI (Ctrl+J)\"]')?.click()")
    r.check('AI editing ideas are available', wait(lambda: r.s.run("return !!document.querySelector('[aria-label=\"AI edit ideas\"] button')"), 10))
    r.s.run("document.querySelector('aside[aria-label=AI] button[title=\"Choose the agent\"]')?.click()")
    r.check('agent selection opens', wait(lambda: r.s.run("return !!document.querySelector('[role=menu][aria-label=Agent]')"), 5))
    r.shot('madman-agent-menu')
    r.s.run("document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}))")
    r.s.run("document.querySelector('[aria-label=\"AI edit ideas\"] button')?.click()")
    r.check('an AI idea fills the editable draft without sending',
            r.s.run("const a = window.__nuzky.agent.getState(); return a.draft.includes('odstraň dlouhé pauzy') && a.status === 'idle'"))
    r.shot('madman-ai-example')
    r.s.run("window.__nuzky.store.setState({panelTab: 'audio'}); window.__nuzky.sounds.setState({tab: 'effects'})")
    r.check('sound search ideas are visible', wait(lambda: r.s.run("return !!document.querySelector('[aria-label=\"Search sound ideas\"] button')"), 10))
    r.shot('madman-sounds-example')
    r.s.run("document.querySelector('[aria-label=\"Search sound ideas\"] button')?.click()")
    r.check('sound idea starts the intended search',
            wait(lambda: r.s.run("return window.__nuzky.sounds.getState().search.effect.query === 'footsteps'"), 5))
    r.s.run("window.__nuzky.store.setState({panelTab: 'captions'})")
    r.check('captions panel opens', wait(lambda: r.s.run("return document.querySelector('[data-tab=captions]')?.getAttribute('aria-selected') === 'true'"), 5))
    r.shot('madman-captions-example')
    r.s.run("window.__nuzky.setup.getState().showStep('ai'); window.__nuzky.setup.getState().openSetup()")
    r.check('AI setup opens', wait(lambda: r.s.run("return !!document.querySelector('#setup-panel')"), 5))
    r.check('AI setup uses the MadMan Cut identity',
            r.s.run("return !document.querySelector('#setup-panel')?.innerText.includes('Nuzky')"))
    time.sleep(1)
    r.shot('madman-agent-setup')
    r.s.run("[...document.querySelectorAll('#setup-panel button')].find(b => b.textContent.includes('Přehrát návod'))?.click()")
    r.check('setup also opens the same guide', wait(lambda: r.s.run("return !!document.querySelector('dialog[open][aria-labelledby=guide-title] video') && !document.querySelector('#setup-panel')"), 5))


@flow('madman_hide_samples', 'Hide the original sample and CapCut suggestions without deleting user files', home=True)
def madman_hide_samples(r):
    opened = r.s.call("window.__nuzky.api.openSample().then(async x => { window.__nuzky.store.setState({snap: x.snapshot, view: 'home'}); await window.__nuzky.refreshLibrary(); return x.snapshot.path; })")
    r.check('the original sample opened in an isolated profile', opened.get('ok') and bool(opened.get('value')), opened)
    path = opened.get('value') or ''
    if not path:
        return
    r.check('the sample project still exists', Path(path).exists(), path)
    r.check('the sample stays in the underlying project list', wait(lambda: r.s.run("return window.__nuzky.library.getState().projects?.some(p => p.path === arguments[0])", path), 10))
    r.check('the sample is not shown in the project grid', wait(lambda: r.s.run("return ![...document.querySelectorAll('[data-path]')].some(p => p.dataset.path === arguments[0])", path), 10))
    r.s.run("""const state = window.__nuzky.library.getState();
        const original = state.projects.find(p => p.path === arguments[0]);
        window.__nuzky.library.setState({projects: [...state.projects, {...original, path: original.path + '.own'}]});
        window.__nuzky.capcut.setState({drafts: [{path: 'user-draft', name: 'Private draft', modifiedMs: 0}]});""", path)
    r.check('a different project with the same name remains visible', wait(lambda: r.s.run("return [...document.querySelectorAll('[data-path]')].some(p => p.dataset.path === arguments[0] + '.own')", path), 5))
    r.check('CapCut draft suggestions are not shown', r.s.run("return !document.body.innerText.includes('Private draft') && !document.body.innerText.includes('CapCut drafts')"))


@flow('madman_social_export', 'A social address is a real text clip and appears in an exported video')
def madman_social_export(r):
    r.s.run("window.__nuzky.store.setState({panelTab: 'text'})")
    r.check('social title is available', wait(lambda: r.s.run("return !!document.querySelector('[data-social-text=youtube]')"), 5))
    r.s.run("document.querySelector('[data-social-text=youtube]')?.click()")
    r.check('the YouTube URL is in the timeline', wait(lambda: r.s.run("return window.__nuzky.store.getState().snap.project.tracks.some(t => t.clips.some(c => c.content.type === 'text' && c.content.text === 'https://www.youtube.com/channel/UCA1TBCfRRP9GlgSTVgg6ZOw'))"), 10))
    target = export(r, 'social-url.mp4')
    if not target.exists():
        return
    frame = r.work / 'social-url-frame.png'
    decoded = subprocess.run(['ffmpeg', '-v', 'error', '-ss', '1', '-i', str(target), '-frames:v', '1', '-y', str(frame)], capture_output=True)
    r.check('an export frame can be decoded', decoded.returncode == 0 and frame.exists(), decoded.stderr.decode(errors='replace'))
    if frame.exists():
        from PIL import Image
        with Image.open(frame) as image:
            bright = sum(1 for p in image.convert('RGB').getdata() if min(p) > 180)
        r.check('the text is visible in the exported frame', bright > 100, bright)
