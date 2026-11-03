"""Czech speech setup keeps language options legible in a native Windows list."""
import re
from e2e.harness import MACOS, flow, wait, webdriver


def contrast(foreground, background):
    def luminance(color):
        values = [int(x) / 255 for x in re.findall(r'\d+', color)[:3]]
        if len(values) != 3:
            return 0
        linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values]
        return sum(a * b for a, b in zip(linear, (0.2126, 0.7152, 0.0722)))
    light, dark = sorted((luminance(foreground), luminance(background)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


@flow('madman_speech_ui', 'The speech setup has readable, Czech language and model labels', home=True)
def madman_speech_ui(r):
    r.s.run("window.__nuzky.setup.getState().showStep('captions'); window.__nuzky.setup.getState().openSetup()")
    ready = wait(lambda: r.s.run("return !!document.querySelector('#setup-panel select') && document.querySelectorAll('#setup-panel [role=radiogroup] label').length >= 3"), 10)
    r.check('speech setup opens', ready)
    if not ready:
        return
    data = r.s.run("""const s=document.querySelector('#setup-panel select');
      return {labels:[...s.options].map(o=>o.textContent.trim()),
        styles:[...s.options].map(o=>({fg:getComputedStyle(o).color,bg:getComputedStyle(o).backgroundColor})),
        cards:[...document.querySelectorAll('#setup-panel [role=radiogroup] label')].map(e=>e.innerText)};""")
    r.check('language names are in Czech', data['labels'][:4] == ['Rozpoznat automaticky', 'Čeština', 'Slovenština', 'Angličtina'], data['labels'])
    r.check('native options have explicit contrasting foreground and background',
            all(x['bg'] != 'rgba(0, 0, 0, 0)' and contrast(x['fg'], x['bg']) >= 4.5 for x in data['styles']), data['styles'])
    r.check('model labels are in Czech', any('Rychlý' in x for x in data['cards']) and any('Vyvážený' in x for x in data['cards']) and any('Výkonný · Turbo' in x for x in data['cards']), data['cards'])
    r.check('the optional full Large v3 appears without being downloaded',
            any('Rozšířený · Large v3' in x and 'Nestaženo' in x for x in data['cards']), data['cards'])
    r.s.run("document.querySelector('#setup-panel input[value=\"large-v3-q5_0\"]')?.click()")
    r.check('the model is selectable without starting a download', wait(lambda: r.s.run("return window.__nuzky.speech.getState().model === 'large-v3-q5_0'"), 5)
            and r.s.run("return !window.__nuzky.store.getState().jobs['speech-model:setup']"))
    visible = """const e=document.querySelector('#setup-panel input[value="large-v3-q5_0"]')?.closest('label');
        const p=e?.closest('.overflow-y-auto'); if(!p)return false; const a=e.getBoundingClientRect(), b=p.getBoundingClientRect();
        return a.top>=b.top-1 && a.bottom<=b.bottom+1;"""
    r.check('the chosen model card scrolls into view', wait(lambda: r.s.run(visible), 5))
    r.s.run("const s=document.querySelector('#setup-panel select'); s.value='cs'; s.dispatchEvent(new Event('change',{bubbles:true}))")
    r.check('language selection keeps its stable code', wait(lambda: r.s.run("return window.__nuzky.speech.getState().language === 'cs'"), 5))
    r.shot('speech-setup')
    if not MACOS:
        webdriver('POST', r.s.path + '/window/rect', {'width': 1024, 'height': 640})
        # Re-select the model after resize, as a person using the smaller window would.
        r.s.run("document.querySelector('#setup-panel input[value=\"base\"]')?.click(); document.querySelector('#setup-panel input[value=\"large-v3-q5_0\"]')?.click()")
        r.check('the selected model stays visible in a small window', wait(lambda: r.s.run(visible), 5))
        r.shot('speech-setup-small')


@flow('madman_speech_popup', 'Open the native language list for visual inspection', home=True)
def madman_speech_popup(r):
    r.s.run("window.__nuzky.setup.getState().showStep('captions'); window.__nuzky.setup.getState().openSetup()")
    ready = wait(lambda: r.s.run("return !!document.querySelector('#setup-panel select')"), 10)
    r.check('speech-language selector is available', ready)
    if not ready or MACOS:
        return
    element = webdriver('POST', r.s.path + '/element', {'using': 'css selector', 'value': '#setup-panel select'})
    element_id = element['element-6066-11e4-a52e-4f735466cecf']
    webdriver('POST', r.s.path + '/element/' + element_id + '/click', {})
    r.shot('native-language-popup')
    webdriver('POST', r.s.path + '/element/' + element_id + '/value', {'text': '\ue00c'})
