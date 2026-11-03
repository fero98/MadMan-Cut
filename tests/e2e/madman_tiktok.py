"""Import a TikTok link with muxed picture and audio, using an offline yt-dlp stand-in."""
import json, subprocess
from pathlib import Path
from e2e.harness import flow, program, wait

VIDEO = '7123456789012345678'
DIALOG = '[role=dialog][aria-labelledby="youtube-title"]'
FIELD = 'input[aria-label="Odkaz na video z YouTube nebo TikToku"]'

def prepare(r):
    videos = r.work / 'videos'
    videos.mkdir()
    subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=25:duration=4',
                    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-shortest', str(videos / f'{VIDEO}.mp4')], check=True)
    r.log = r.work / 'ytdlp.jsonl'
    r.log.touch()
    r.env.update(NUZKY_YTDLP=str(program(r, Path(__file__).with_name('fake_ytdlp'))), NUZKY_FAKE_YTDLP_VIDEOS=str(videos),
                 NUZKY_FAKE_YTDLP_AUDIO=str(videos / f'{VIDEO}.mp4'), NUZKY_FAKE_YTDLP_LOG=str(r.log))

@flow('madman_tiktok', 'TikTok video link downloads and imports its picture and sound', before=prepare)
def madman_tiktok(r):
    r.s.run("window.__nuzky.store.setState({panelTab:'media'})")
    selector = 'button[aria-label="Video z YouTube nebo TikToku"]'
    r.check('media offers a video link', wait(lambda: r.s.run('return !!document.querySelector(arguments[0])', selector), 5))
    r.s.run('document.querySelector(arguments[0]).click()', selector)
    r.check('Czech link dialog opens', wait(lambda: r.s.run('return !!document.querySelector(arguments[0])', FIELD), 5))
    r.shot('tiktok-link')
    url = f'https://www.tiktok.com/@madmanstudio/video/{VIDEO}?tracking=ignored'
    r.s.run('''const input = document.querySelector(arguments[0]); input.focus();
const e = new Event('paste', {bubbles:true,cancelable:true});
Object.defineProperty(e, 'clipboardData', {value:{getData:()=>arguments[1]}}); input.dispatchEvent(e);''', FIELD, url)
    notice = wait(lambda: r.s.run("return !!document.querySelector('[data-agree]')"), 5)
    r.check('rights are confirmed before any download', notice and r.log.read_text() == '')
    if not notice: return
    r.s.run("document.querySelector('[data-agree]').click()")
    ready = wait(lambda: r.s.run('return !!document.querySelector(arguments[0] + " canvas")', DIALOG), 40)
    r.check('muxed video opens in preview', ready, r.s.run('return document.querySelector(arguments[0])?.innerText', DIALOG))
    if not ready: return
    drawn = wait(lambda: r.s.run('''const c = document.querySelector(arguments[0] + " canvas");
if (!c || !c.width || !c.height) return false;
const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
let lit = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i+1] + pixels[i+2] > 60) lit++;
return lit > 1000;''', DIALOG), 20)
    r.check('the preview actually draws the picture', drawn)
    r.shot('tiktok-preview')
    calls = [json.loads(line) for line in r.log.read_text().splitlines()]
    r.check('only the canonical video URL reaches yt-dlp', len(calls) == 2 and all(c[c.index('--')+1:] == [f'https://www.tiktok.com/embed/{VIDEO}'] for c in calls), calls)
    r.s.run("[...document.querySelectorAll(arguments[0] + ' button')].find(b => b.textContent.trim() === 'Importovat celé video').click()", DIALOG)
    asset = wait(lambda: r.s.run("return window.__nuzky.store.getState().snap.project.assets.find(a => a.name === arguments[0]) || null", f'Test video {VIDEO}'), 40)
    r.check('video is added to project with audio', bool(asset) and asset['hasAudio'], asset)
    if asset:
        probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', asset['path']], capture_output=True, text=True)
        r.check('imported media contains picture and sound', probe.returncode == 0 and 'video' in probe.stdout and 'audio' in probe.stdout, probe.stdout + probe.stderr)
    r.check('no error toast', not r.errors(), r.errors())
