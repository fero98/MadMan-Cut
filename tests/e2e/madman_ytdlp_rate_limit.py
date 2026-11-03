"""Rate-limit recovery in the Czech setup, without contacting GitHub."""
from e2e.harness import flow, wait

@flow('madman_ytdlp_rate_limit', 'Explain a GitHub rate limit and offer a safe retry path', home=True)
def madman_ytdlp_rate_limit(r):
    r.s.run("window.__nuzky.setup.getState().openSetup(); window.__nuzky.setup.getState().showStep('music'); window.__nuzky.sounds.setState({installError:'RATE_LIMITED: GitHub gets too many requests from this network. Try again in an hour.',installing:false})")
    alert = wait(lambda: r.s.run("return document.querySelector('#setup-panel [role=alert]')?.innerText || ''"), 10)
    r.check('rate-limit guidance is in Czech and names the wait and skip option', bool(alert) and 'GitHub' in alert and 'hodin' in alert and 'Přeskočit' in alert, alert)
    r.check('retry and skip remain available', r.s.run("const p=document.querySelector('#setup-panel'); return !!p && p.innerText.includes('Zkusit znovu') && p.innerText.includes('Přeskočit')"))
    r.shot('ytdlp-rate-limit')

    r.s.run("window.__nuzky.setup.getState().showStep('ai')")
    text = wait(lambda: r.s.run("return document.querySelector('#setup-panel')?.innerText || ''"), 10)
    r.check('AI setup explains that installing one agent comes before connecting', bool(text) and 'Karty se neoznačují' in text and 'příkazový nástroj' in text and 'desktopová aplikace' in text and 'Zkontrolovat znovu' in text, text)
    card = wait(lambda: r.s.run("return document.querySelector('[role=group][aria-label=Codex]')?.innerText || ''"), 10)
    if card and 'Není nainstalován' in card:
        r.check('Codex guide distinguishes desktop and CLI and includes login and check steps', all(x in card for x in ['Node.js', 'codex.cmd login', 'Zkontrolovat znovu']), card)
    r.shot('ai-agent-guidance')
