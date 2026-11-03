"""Use the optional Large v3 model for Czech captions in an isolated editor."""
import os
import shutil
import subprocess
from e2e.harness import FIXTURES, MODELS, flow, wait


def before(r):
    models = r.work / 'data/nuzky/models'
    models.mkdir(parents=True, exist_ok=True)
    # Test fixtures are separate from the user's installed models and projects.
    model = MODELS / 'ggml-large-v3-q5_0.bin'
    try:
        os.link(model, models / model.name)
    except OSError:
        shutil.copy2(model, models / model.name)
    shutil.copy2(MODELS / 'ggml-silero-v5.1.2.bin', models / 'ggml-silero-v5.1.2.bin')
    align = MODELS / 'wav2vec2-xls-r-300m-cs-250-q8_0.gguf'
    shutil.copy2(align, models / align.name)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x26313b:s=640x360:r=25:d=12',
                    '-i', str(FIXTURES / 'krysar-cs.wav'), '-t', '12', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', str(r.work / 'czech-speech.mp4')], check=True)


@flow('madman_large_v3', 'Generate Czech captions using the optional Large v3 model', before=before)
def madman_large_v3(r):
    r.import_media(r.work / 'czech-speech.mp4')
    r.add_clip('czech-speech.mp4')
    r.s.run("window.__nuzky.speech.setState({model:'large-v3-q5_0',language:'cs'}); window.__nuzky.store.setState({panelTab:'captions'})")
    button = wait(lambda: r.s.run("return !!document.querySelector('[data-generate-captions]:not(:disabled)')"), 15)
    r.check('the caption action is available', button)
    if not button:
        return
    r.s.run("document.querySelector('[data-generate-captions]').click()")
    job = wait(lambda: next((j for j in r.state()['jobs'] if j['kind'] == 'captions' and j['status'] != 'running'), None), 480, 1)
    r.check('Large v3 completes Czech caption generation', job and job['status'] == 'done', job)
    if not job or job['status'] != 'done':
        return
    texts = [c['text'] or '' for t in r.state()['tracks'] if t['kind'] == 'text' for c in t['clips']]
    words = ' '.join(texts).lower()
    r.check('captions contain recognisable Czech speech', 'slunce' in words and 'prchala' in words, texts)
    r.check('the editor reports no errors', not r.errors(), r.errors())
    r.shot('czech-large-v3-captions')
