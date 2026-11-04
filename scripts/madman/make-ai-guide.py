"""Render the Czech, silent AI setup guide with Pillow and the local FFmpeg."""
import os
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[2]
ffmpeg = Path(os.environ["FFMPEG_DIR"]) / "bin" / "ffmpeg.exe"
font = lambda size, bold=False: ImageFont.truetype(f'C:/Windows/Fonts/{"arialbd" if bold else "arial"}.ttf', size)
slides = [
    ("Připojení AI", ["Pro střih s AI stačí jeden podporovaný agent.", "Tento návod ukazuje připojení Codex CLI.", "Aplikaci můžete používat i bez AI."]),
    ("1  Nainstalujte Node.js", ["Otevřete oficiální stránku nodejs.org", "a nainstalujte doporučenou verzi LTS.", "Pak zavřete a znovu otevřete PowerShell."]),
    ("2  Nainstalujte Codex CLI", ["V PowerShellu spusťte příkaz:", "npm.cmd install -g @openai/codex", "Počkejte na dokončení instalace."]),
    ("3  Přihlaste se", ["V PowerShellu spusťte: codex.cmd login", "Dokončete přihlášení v prohlížeči.", "Heslo ani přihlašovací kód nikomu neposílejte."]),
    ("4  Propojte MadMan Cut", ["V Nastavení aplikace otevřete Připojení AI.", "Klikněte na Zkontrolovat znovu a pak Připojit.", "Pokud nástroj není nalezen, restartujte aplikaci."]),
    ("Desktopová aplikace a další agenti", ["Samotná desktopová aplikace Codex nemusí obsahovat CLI.", "Claude Code a Gemini mají vlastní instalační postup.", "Řiďte se odkazem Návod k instalaci u vybraného agenta."]),
    ("Hotovo", ["Otevřete projekt a v panelu AI vyberte připojeného agenta.", "Napište například: Odstraň dlouhé pauzy a přidej titulky.", "Dostupnost a případné poplatky závisí na poskytovateli."]),
]
with tempfile.TemporaryDirectory() as temp:
    temp = Path(temp)
    for i, (title, lines) in enumerate(slides):
        im = Image.new("RGB", (1280, 720), "#111115")
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, 1280, 8), fill="#c54b12")
        d.text((70, 55), "MADMAN CUT  /  NÁVOD K AI", font=font(24, True), fill="#ffa661")
        d.text((70, 145), title, font=font(50, True), fill="#ffffff")
        for n, line in enumerate(lines):
            d.text((70, 270 + n * 75), line, font=font(29), fill="#e2e2e6")
        d.text((70, 655), f"{i + 1} / {len(slides)}    •    Video je bez zvuku", font=font(20), fill="#a3a3ad")
        im.save(temp / f"{i:02}.png")
    entries = []
    for i in range(len(slides)):
        entries += [f"file '{(temp / f'{i:02}.png').as_posix()}'", "duration 8"]
    entries += [f"file '{(temp / f'{len(slides)-1:02}.png').as_posix()}'"]
    listing = temp / "slides.txt"
    listing.write_text("\n".join(entries), encoding="utf-8")
    subprocess.run([str(ffmpeg), "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-vf", "fps=24,format=yuv420p", "-c:v", "libx264", "-preset", "fast", "-movflags", "+faststart", str(root / "assets/madman/ai-guide.mp4")], check=True)
