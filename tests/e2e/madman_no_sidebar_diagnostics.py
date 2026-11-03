"""The home sidebar omits the diagnostics row; editor diagnostics remain accessible."""
from e2e.harness import flow, wait

@flow('madman_no_sidebar_diagnostics', 'Hide diagnostics in the home sidebar', home=True)
def madman_no_sidebar_diagnostics(r):
    r.check('home has no diagnostics button', r.s.run("const p=document.querySelector('[aria-label=\"MadMan Cut\"]')?.closest('.pane'); return !!p && !p.querySelector('[data-feedback]')"))
    r.check('social links remain available', r.s.run("return ['youtube','tiktok','facebook'].every(id => !!document.querySelector(`[data-social=\"${id}\"]`))"))
    r.shot('home-without-diagnostics')
    r.s.run("window.__nuzky.store.setState({view:'editor'})")
    r.check('editor diagnostics remain available', wait(lambda: r.s.run("return !!document.querySelector('[data-feedback]')"), 5))
    r.check('no error', not r.errors(), r.errors())
