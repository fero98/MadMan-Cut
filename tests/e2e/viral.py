"""Viral Lab's offline workflow in the real desktop app, without a key or external requests."""
import json
from e2e.harness import flow, wait


@flow('madman_viral', 'Viral Lab creates, reviews and exports only approved original plan revisions', home=True)
def madman_viral(r):
    def call(op, value=None):
        return r.s.call('window.__nuzky.api.viralLab(arguments[0], arguments[1]).then(JSON.stringify)', op, value or {})

    def state():
        result = call('state')
        if not result['ok']:
            raise RuntimeError(result['error'])
        return json.loads(result['value'])

    def click(text):
        r.s.run("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === arguments[0])?.click()", text)

    click('MADMAN Viral Lab')
    r.check('Viral Lab opens from the existing home sidebar', wait(lambda: r.s.run("return !!document.querySelector('[aria-label=\"MADMAN Viral Lab\"]')"), 5))
    r.check('the new backend command is reachable', call('state')['ok'])
    r.check('all six navigation labels are Czech', r.s.run("return ['OBJEVOVÁNÍ','TRENDY','NÁMĚTY','SCÉNÁŘE','AI PRODUKCE','PŘIPRAVENO K VÝROBĚ'].every(label => [...document.querySelectorAll('nav[aria-label=\"Sekce Viral Lab\"] button')].some(b => b.textContent === label))"))
    r.check('concurrent workspace initialization shows no database error', not r.s.run("return !!document.querySelector('[role=alert]')"))
    r.check('no key or source metadata appears in an isolated workspace', not state()['keyConfigured'] and state()['dashboard']['videos'] == [])
    r.check('discovery is disabled without a key', r.s.run("return [...document.querySelectorAll('button')].find(b => b.textContent.includes('Vyhledat videa'))?.disabled"))
    r.check('no key fails with a clear setup error', 'YOUTUBE_KEY_MISSING' in call('discover').get('error', ''))
    dummy = 'MADMAN_TEST_KEY_NOT_A_REAL_GOOGLE_CREDENTIAL'
    r.check('key setup requires accepting the data notice', 'POLICY_ACCEPTANCE_REQUIRED' in call('key', {'key': dummy, 'acceptedPolicies': False}).get('error', ''))
    try:
        saved = call('key', {'key': dummy, 'acceptedPolicies': True})
        r.check('a test key is saved in the isolated keychain entry', saved['ok'] and state()['keyConfigured'], saved if not saved['ok'] else None)
        r.check('the saved credential never returns in a state response', dummy not in json.dumps(state()))
    finally:
        call('key', {'key': '', 'acceptedPolicies': True})
    r.check('removing the test key disconnects discovery', not state()['keyConfigured'])
    r.shot('viral-discover-empty')
    click('NÁMĚTY')
    r.check('series names are translated without changing their stored values', r.s.run("const select = [...document.querySelectorAll('select')].find(s => s.value === 'Zombie in America'); return select?.selectedOptions[0].textContent === 'Zombie v Americe';"))
    click('Vytvořit ukázkový námět')
    r.check('a real stored production plan appears', wait(lambda: len(state()['dashboard']['projects']) == 1, 5))
    p = state()['dashboard']['projects'][0]
    r.check('production content remains US English', p['plan']['language'] == 'en-US' and 'One brain, please.' in p['plan']['script'])
    r.check('the plan has four timed shots and honest template provenance', len(p['plan']['shots']) == 4 and 'not AI-generated' in p['plan']['generator'])
    r.check('the score stays unavailable until editorial review', p['plan']['rubric'] is None)
    r.check('approval requires an explicit manual review', 'MANUAL_REVIEW_REQUIRED' in call('decide', {'id': p['id'], 'revision': 1, 'approve': True, 'reviewed': False}).get('error', ''))
    r.check('drafts cannot be exported', 'APPROVED_REVISION_REQUIRED' in call('export', {'id': p['id'], 'revision': 1, 'parent': str(r.work)}).get('error', ''))
    r.s.run("const input = document.querySelector('[aria-label=\"Anglický název\"]'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, 'The Zombie Has a New Job'); input.dispatchEvent(new Event('input', { bubbles: true }));")
    click('Uložit novou verzi')
    r.check('editing saves an actual new revision', wait(lambda: state()['dashboard']['projects'][0]['revision'] == 2, 5))
    r.check('the edited title persists', state()['dashboard']['projects'][0]['plan']['title'] == 'The Zombie Has a New Job')
    r.s.run("const box = [...document.querySelectorAll('input[type=checkbox]')].find(x => x.parentElement.textContent.includes('Zkontroloval/a jsem')); box.click();")
    click('Schválit uloženou verzi')
    r.check('the exact reviewed revision is approved', wait(lambda: state()['dashboard']['projects'][0]['approvedRevision'] == 2, 5))
    click('PŘIPRAVENO K VÝROBĚ')
    r.check('the approved project appears in the production queue', wait(lambda: r.s.run("return document.body.innerText.includes('The Zombie Has a New Job') && [...document.querySelectorAll('button')].some(b => b.textContent.includes('Exportovat balíček'))"), 5))
    result = call('export', {'id': p['id'], 'revision': 2, 'parent': str(r.work)})
    r.check('the approved production package is written', result['ok'], result)
    package = r.work / f"madman-{p['id']}-v2"
    r.check('export includes script, prompts and subtitles', all((package / name).exists() for name in ('production.json', 'script.txt', 'prompts.txt', 'captions.srt', 'youtube.txt')))
    r.check('a repeated export cannot overwrite the package', 'OUTPUT_EXISTS' in call('export', {'id': p['id'], 'revision': 2, 'parent': str(r.work)}).get('error', ''))
    r.shot('viral-approved-export')
    click('Zkontrolovat')
    r.s.run("const field = document.querySelector('[aria-label=\"Anglický název\"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, 'A Further Original Revision'); field.dispatchEvent(new Event('input', { bubbles: true }));")
    click('Uložit novou verzi')
    r.check('a subsequent edit invalidates approval', wait(lambda: state()['dashboard']['projects'][0]['revision'] == 3 and state()['dashboard']['projects'][0]['approvedRevision'] is None, 5))
    click('PŘIPRAVENO K VÝROBĚ')
    r.check('the invalidated project leaves the ready queue', wait(lambda: r.s.run("return document.body.innerText.includes('Zatím nemáte schválený produkční plán')"), 5))
    click('TRENDY')
    r.check('analytics are visibly unavailable rather than invented', r.s.run("return document.body.innerText.includes('Pokročilá analytika není aktivní')"))
    click('Vytvořit denní přehled')
    r.check('the report is generated from stored data', wait(lambda: r.s.run("return !!document.querySelector('[aria-label=\"Denní přehled\"]')?.value.includes('MADMAN STUDIO')"), 5))
    # The browser window is resized through the harness's WebDriver rather than desktop input.
    from e2e.harness import webdriver
    webdriver('POST', r.s.path + '/window/rect', {'width': 1024, 'height': 720})
    r.check('the workspace remains within the smaller viewport', wait(lambda: r.s.run("const el = document.querySelector('[aria-label=\"MADMAN Viral Lab\"]'); const b = el.getBoundingClientRect(); return b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;"), 5))
    r.shot('viral-small-window')
