"""Build and export an isolated video with media, transitions, text, music and an effect."""
import subprocess
import time
import re
from e2e.harness import export, ffprobe, flow, wait


def make_footage(r):
    # Locally generated footage keeps the demonstration independent of personal or third-party video.
    colors = ('0x101922', '0x241710', '0x111b1b')
    for n, color in enumerate(colors, 1):
        picture = (f'color=c={color}:s=1280x720:r=30:d=3,'
                   f'drawgrid=w=80:h=80:t=1:c=0x43515a@0.28,'
                   f'drawbox=x=0:y=0:w=1280:h=9:color=0xe8782e:t=fill,'
                   f'drawbox=x={130*n}:y=240:w=480:h=220:color=0xf18a3d@0.12:t=fill')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', picture,
                        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(r.work / f'scene-{n}.mp4')], check=True)


@flow('madman_quality', 'Create and export an edited video with transitions, music, sound and Czech titles', before=make_footage, home=True)
def madman_quality(r):
    paths = [str(r.work / f'scene-{n}.mp4') for n in range(1, 4)]
    r.s.run('window.__nuzky.newProjectFromMedia(arguments[0])', paths)
    imported = wait(lambda: len(r.track()) == 3 and len(r.state()['assets']) == 3, 30)
    r.check('three locally stored videos open and appear on the timeline', imported, r.state())
    if not imported:
        return
    clips = r.track()
    for i, kind in ((1, 'slideRight'), (2, 'wipeDown')):
        result = r.s.call("window.__nuzky.store.getState().edit({type:'setTransition',clipId:arguments[0],transition:{kind:arguments[1],durationUs:600000}})", clips[i]['id'], kind)
        applied = wait(lambda: r.s.run("return window.__nuzky.store.getState().snap.project.tracks.flatMap(t=>t.clips).find(c=>c.id===arguments[0])?.transitionIn?.kind", clips[i]['id']) == kind, 5)
        r.check(f'the {kind} transition is applied', result['ok'] and applied, result)
    texts = ('MADMAN CUT', 'STŘIH PODLE VÁS', 'OBRAZ · HUDBA · ZVUK')
    for i, text in enumerate(texts):
        result = r.s.call("window.__nuzky.store.getState().edit({type:'addText',startUs:arguments[0],text:arguments[1],style:{fontSize:80,color:'#ffffff',bold:true}})", i * 3_000_000, text)
        r.check(f'Czech title {i+1} is added', result['ok'], result)
    r.s.run("window.__nuzky.store.setState({panelTab:'audio'})")
    r.s.run("document.querySelector('#audio-tab-music')?.click()")
    music = wait(lambda: r.s.run('return !!document.querySelector(\'[data-sound="nuzky:dancing"] button[aria-label^="Add"]\')'), 15)
    r.check('built-in music is visible without an online search', music)
    if not music:
        return
    r.seek(0)
    r.s.run('document.querySelector(\'[data-sound="nuzky:dancing"] button[aria-label^="Add"]\').click()')
    song = wait(lambda: r.s.run("""const p=window.__nuzky.store.getState().snap.project;
        const a=p.assets.find(a=>a.credit?.id==='dancing');
        return a && p.tracks.flatMap(t=>t.clips).find(c=>c.content.assetId===a.id) || null;"""), 25)
    r.check('music is added to the project', song, song)
    if not song:
        return
    trimmed = r.s.call("window.__nuzky.store.getState().edit({type:'trimClip',clipId:arguments[0],startUs:0,durationUs:9000000,sourceInUs:20000000})", song['id'])
    r.check('music is trimmed to the video', trimmed['ok'], trimmed)
    r.s.run("document.querySelector('#audio-tab-effects')?.click()")
    effect = wait(lambda: r.s.run('return !!document.querySelector(\'[data-sound="nuzky:whoosh"] button[aria-label^="Add"]\')'), 10)
    r.check('built-in whoosh is visible', effect)
    r.seek(2_700_000)
    r.s.run('document.querySelector(\'[data-sound="nuzky:whoosh"] button[aria-label^="Add"]\')?.click()')
    added = wait(lambda: r.s.run("return window.__nuzky.store.getState().snap.project.assets.some(a=>a.credit?.id==='whoosh')"), 20)
    r.check('the whoosh is added near the first cut', added)
    r.shot('editing')
    video = export(r, 'MadMan-Cut-ukazka.mp4')
    if not video.exists():
        return
    duration, codecs = ffprobe(video)
    r.check('export contains video and sound of the expected length', {'h264', 'aac'} <= codecs and 8.8 <= duration <= 9.3, [duration, list(codecs)])
    sound = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(video), '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True)
    report = sound.stderr
    r.check('exported audio is not silent', 'mean_volume: -inf' not in report and 'mean_volume:' in report, report[-700:])
    opening = subprocess.run(['ffmpeg', '-hide_banner', '-t', '1', '-i', str(video), '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    mean = re.search(r'mean_volume: (-?[\d.]+) dB', opening)
    r.check('music is audible from the opening', bool(mean) and float(mean.group(1)) > -35, mean.group(1) if mean else opening[-500:])
    from PIL import Image
    frames = {}
    for label, timestamp in [('before1', 2.4), ('cut1', 3.0), ('after1', 3.6), ('before2', 5.4), ('cut2', 6.0), ('after2', 6.6)]:
        target = r.work / f'{label}.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(timestamp), '-i', str(video), '-frames:v', '1', '-y', str(target)], check=True)
        with Image.open(target) as frame:
            frames[label] = frame.convert('RGB').copy()
    difference = lambda a, b: sum(abs(x-y) for x, y in zip(a, b))
    sample = lambda name, x, y: frames[name].getpixel((x, y))
    right = difference(sample('cut1', 1100, 600), sample('before1', 1100, 600))
    left = difference(sample('cut1', 100, 600), sample('after1', 100, 600))
    top = difference(sample('cut2', 1100, 100), sample('after2', 1100, 100))
    bottom = difference(sample('cut2', 1100, 600), sample('before2', 1100, 600))
    r.check('exported transitions show both adjacent shots in the intended directions', max(right, left, top, bottom) < 50, [right, left, top, bottom])
    r.check('no editor errors', not r.errors(), r.errors())
