use anyhow::{Result, bail};
use madman_discovery::{Store, api_key, root};
use std::sync::atomic::AtomicBool;

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let root = root()?;
    match args.first().map(String::as_str) {
        Some("daily") => {
            let key =
                api_key(&root)?.ok_or_else(|| anyhow::anyhow!("YOUTUBE_KEY_MISSING: configure it in Viral Lab"))?;
            let store = Store::open(&root)?;
            let count = store.discover(&key, &AtomicBool::new(false))?;
            println!("Discovery complete: {count} candidates. Report is available in Viral Lab.");
        }
        Some("report") => println!("{}", Store::open(&root)?.report()?),
        _ => bail!("Usage: madman-discovery daily | report (NUZKY_DATA_DIR isolates storage)"),
    }
    Ok(())
}
