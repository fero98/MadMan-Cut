//! Videos from YouTube links, through the same yt-dlp as music (`crate::youtube`). The whole video downloads into
//! the cache, picture and sound apart, for the user to watch and choose a part. Adding it joins the two into one
//! file in Nuzky's own folder, keeping only the part and up to 3 s around it, which a clip's edge can reveal later.
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use anyhow::{Result, anyhow, ensure};
use nuzky_engine::edit::new_id;
use nuzky_engine::model::{Asset, AssetKind, Part};
use serde::{Deserialize, Serialize};

use crate::youtube::{PICTURE, SOUND};

/// About an hour of 1080p.
const MAX_BYTES: u64 = 4 << 30;
/// The share of a download the picture takes; the sound is the rest.
const PICTURE_SHARE: f32 = 0.9;
// TikTok often supplies a single muxed file rather than separate video and audio streams.
const TIKTOK_FORMAT: &str = "best[height<=1080][ext=mp4]/best[height<=1080]/best";

fn tiktok_id(link: &str) -> Result<String> {
    let invalid = || anyhow!("INVALID_LINK: vložte odkaz na konkrétní video TikTok");
    let url = url::Url::parse(link.trim()).map_err(|_| invalid())?;
    ensure!(
        url.scheme() == "https" && url.username().is_empty() && url.password().is_none() && url.port().is_none(),
        invalid()
    );
    ensure!(matches!(url.host_str(), Some("tiktok.com" | "www.tiktok.com" | "m.tiktok.com")), invalid());
    let parts: Vec<_> = url.path_segments().ok_or_else(invalid)?.filter(|p| !p.is_empty()).collect();
    let id = match parts.as_slice() {
        [user, "video", id] if user.starts_with('@') && user.len() > 1 => *id,
        ["embed" | "v", id] => *id,
        ["share", "video", id] => *id,
        _ => return Err(invalid()),
    };
    ensure!((15..=22).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_digit()), invalid());
    Ok(format!("tt-{id}"))
}

/// Resolve a TikTok share link without following a redirect to another service.
fn resolve_tiktok(link: &str, cancel: &AtomicBool) -> Result<String> {
    if let Ok(id) = tiktok_id(link) {
        return Ok(id);
    }
    let mut url = url::Url::parse(link.trim()).map_err(|_| anyhow!("INVALID_LINK: vložte odkaz na video TikTok"))?;
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .https_only(true)
        .proxy(None)
        .max_redirects(0)
        .timeout_global(Some(Duration::from_secs(15)))
        .build()
        .into();
    for _ in 0..5 {
        ensure!(!cancel.load(Ordering::Relaxed), "CANCELLED: the lookup stopped");
        ensure!(
            url.scheme() == "https"
                && url.username().is_empty()
                && url.password().is_none()
                && url.port().is_none()
                && matches!(url.host_str(), Some("vm.tiktok.com" | "vt.tiktok.com")),
            "INVALID_LINK: neplatný krátký odkaz TikTok"
        );
        let token = url.path().trim_matches('/');
        ensure!(
            !token.is_empty() && token.len() <= 64 && token.bytes().all(|b| b.is_ascii_alphanumeric()),
            "INVALID_LINK: neplatný krátký odkaz TikTok"
        );
        // Build the request from the checked host and token; tracking query parameters are not sent.
        let address = format!("https://{}/{token}/", url.host_str().unwrap());
        let response = agent
            .get(&address)
            .call()
            .map_err(|e| anyhow!("SOURCE_FAILED: krátký odkaz TikTok nelze otevřít ({e})"))?;
        ensure!(response.status().is_redirection(), "INVALID_LINK: krátký odkaz nevede na video TikTok");
        let location = response
            .headers()
            .get("location")
            .and_then(|h| h.to_str().ok())
            .ok_or_else(|| anyhow!("INVALID_LINK: chybí cíl odkazu TikTok"))?;
        url = url.join(location).map_err(|_| anyhow!("INVALID_LINK: neplatný cíl odkazu TikTok"))?;
        if let Ok(id) = tiktok_id(url.as_str()) {
            return Ok(id);
        }
    }
    Err(anyhow!("INVALID_LINK: příliš mnoho přesměrování odkazu TikTok"))
}

#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(rename = "YoutubeVideo"))]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Video {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub duration_us: i64,
}

/// The video a YouTube link points at. `cancel` stops the lookup.
pub fn link(url: &str, cancel: &AtomicBool) -> Result<Video> {
    let id = match crate::youtube::video_id(url) {
        Ok(id) => id,
        Err(error) if error.to_string().starts_with("PLAYLIST") => return Err(error),
        Err(_) => resolve_tiktok(url, cancel)?,
    };
    let format = if id.starts_with("tt-") { TIKTOK_FORMAT } else { PICTURE };
    let video = crate::youtube::video(&id, format, MAX_BYTES, cancel)?;
    let text =
        |t: Option<&str>| t.map(|t| t.split_whitespace().collect::<Vec<_>>().join(" ")).filter(|t| !t.is_empty());
    let channel = [&video.channel, &video.uploader, &video.artist].into_iter().find_map(|a| text(a.as_deref()));
    Ok(Video {
        id,
        title: text(video.title.as_deref()).unwrap_or_else(|| "Untitled".into()),
        channel: channel.unwrap_or_else(|| "Unknown".into()),
        duration_us: (video.duration.unwrap_or(0.0).max(0.0) * 1e6) as i64,
    })
}

/// The picture and the sound of a downloaded video.
pub struct Download {
    pub picture: PathBuf,
    pub sound: PathBuf,
}

fn cache(cache_dir: &Path) -> PathBuf {
    cache_dir.join("youtube")
}

/// Deletes the downloaded videos, as the next app start does.
pub fn forget(cache_dir: &Path) {
    std::fs::remove_dir_all(cache(cache_dir)).ok();
}

/// Downloads the whole video into the cache, or finds it there. Only the latest video stays: a long one takes
/// gigabytes. `cancel` stops it within 100 ms and leaves nothing behind.
pub fn fetch(id: &str, cache_dir: &Path, cancel: &AtomicBool, mut progress: impl FnMut(f32)) -> Result<Download> {
    ensure!(
        crate::sounds::settings().youtube_rights,
        "RIGHTS_UNCONFIRMED: before the first video or song from a YouTube link, the user must agree that they are responsible for the rights to it and for following YouTube's terms"
    );
    crate::youtube::video_address(id)?;
    let dir = cache(cache_dir);
    let picture = dir.join(format!("{id}.picture"));
    let sound = if id.starts_with("tt-") { picture.clone() } else { dir.join(format!("{id}.sound")) };
    let download = Download { picture, sound };
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if !entry.file_name().to_string_lossy().starts_with(&format!("{id}.")) {
                std::fs::remove_file(entry.path()).ok();
            }
        }
    }
    if !download.picture.is_file() {
        let format = if id.starts_with("tt-") { TIKTOK_FORMAT } else { PICTURE };
        crate::youtube::download(id, format, &download.picture, MAX_BYTES, cancel, |p| progress(p * PICTURE_SHARE))?;
    }
    if !download.sound.is_file() {
        crate::youtube::download(id, SOUND, &download.sound, MAX_BYTES, cancel, |p| {
            progress(PICTURE_SHARE + p * (1.0 - PICTURE_SHARE))
        })?;
    }
    if id.starts_with("tt-") {
        progress(1.0);
    }
    Ok(download)
}

/// The video as a project asset: its `part`, or all of it, joined into a new file in Nuzky's own folder, since
/// a cache may be emptied while the project still needs the file.
pub fn asset(
    video: &Video,
    part: Option<Part>,
    cache_dir: &Path,
    cancel: &AtomicBool,
    progress: impl FnMut(f32),
) -> Result<Asset> {
    if let Some(part) = part {
        ensure!(
            0 <= part.start_us && part.start_us < part.end_us && part.start_us < video.duration_us,
            "INVALID_ARGUMENTS: the part must start before it ends, inside the video's {} s",
            video.duration_us / 1_000_000
        );
    }
    let download = fetch(&video.id, cache_dir, cancel, progress)?;
    let path = crate::sounds::data_dir().join("videos").join(format!("youtube-{}-{}.mp4", video.id, new_id()));
    std::fs::create_dir_all(path.parent().unwrap())?;
    let audio = (download.picture != download.sound).then_some(download.sound.as_path());
    let kept = nuzky_engine::join::join(&download.picture, audio, &path, part, cancel)?;
    let probed = nuzky_engine::media::probe(&path, new_id())
        .map_err(|e| anyhow!("SOUND_UNAVAILABLE: {} is not a video Nuzky can play ({e:#})", video.title))
        .and_then(|asset| {
            ensure!(asset.kind == AssetKind::Video, "SOUND_UNAVAILABLE: {} has no picture", video.title);
            Ok(asset)
        });
    let Ok(mut asset) = probed else {
        std::fs::remove_file(&path).ok();
        return probed;
    };
    asset.name = video.title.clone();
    asset.part = kept;
    Ok(asset)
}

#[cfg(test)]
mod tiktok_tests {
    use super::*;
    #[test]
    fn accepts_only_one_tiktok_video_and_builds_safe_address() {
        for link in [
            "https://www.tiktok.com/@madmanstudio/video/7123456789012345678?tracking=1",
            "https://www.tiktok.com/embed/7123456789012345678",
        ] {
            let id = tiktok_id(link).unwrap();
            assert_eq!(id, "tt-7123456789012345678");
            assert_eq!(
                crate::youtube::video_address(&id).unwrap().0,
                "https://www.tiktok.com/embed/7123456789012345678"
            );
        }
        for bad in [
            "https://tiktok.com.evil.test/@a/video/7123456789012345678",
            "https://tiktok.com@evil.test/@a/video/7123456789012345678",
            "https://www.tiktok.com/@a/video/../../file",
            "https://www.tiktok.com/@a",
            "http://www.tiktok.com/@a/video/7123456789012345678",
            "https://www.tiktok.com:444/@a/video/7123456789012345678",
        ] {
            assert!(tiktok_id(bad).is_err(), "{bad}");
        }
        for bad in ["tt-../test", "tt-1", "tt-7123456789012345678/evil"] {
            assert!(crate::youtube::video_address(bad).is_err());
        }
    }
}
