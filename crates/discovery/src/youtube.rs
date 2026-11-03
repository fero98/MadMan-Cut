use super::{Store, Video, now};
use anyhow::{Result, bail, ensure};
use serde_json::Value;
use std::collections::BTreeSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

pub(crate) fn valid_id(id: &str) -> bool {
    id.len() == 11 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
pub(crate) fn duration(text: &str) -> Option<u64> {
    let rest = text.strip_prefix("PT")?;
    if rest.is_empty() {
        return None;
    }
    let mut number = String::new();
    let mut total = 0u64;
    let mut last = 0;
    for ch in rest.chars() {
        if ch.is_ascii_digit() {
            number.push(ch);
            continue;
        }
        let (rank, multiplier) = match ch {
            'H' => (1, 3600),
            'M' => (2, 60),
            'S' => (3, 1),
            _ => return None,
        };
        if rank <= last {
            return None;
        }
        last = rank;
        total = total.checked_add(number.parse::<u64>().ok()?.checked_mul(multiplier)?)?;
        number.clear();
    }
    if !number.is_empty() {
        return None;
    }
    Some(total)
}
fn check(cancel: &AtomicBool) -> Result<()> {
    ensure!(!cancel.load(Ordering::Relaxed), "CANCELLED");
    Ok(())
}

fn get(store: &Store, key: &str, method: &str, pairs: &[(&str, &str)], cancel: &AtomicBool) -> Result<Value> {
    let mut url = url::Url::parse(&format!("https://www.googleapis.com/youtube/v3/{method}"))?;
    url.query_pairs_mut().extend_pairs(pairs.iter().copied()).append_pair("key", key);
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(3)))
        .max_redirects(0)
        .http_status_as_error(false)
        .build()
        .into();
    for attempt in 0..3 {
        check(cancel)?;
        store.reserve(if method == "search" { "search" } else { "statistics" })?;
        // Do not propagate ureq errors: they may contain the secret-bearing request URL.
        let response = agent.get(url.as_str()).call();
        if let Ok(mut response) = response {
            let status = response.status().as_u16();
            if status == 200 {
                let text = response
                    .body_mut()
                    .with_config()
                    .limit(4 * 1024 * 1024)
                    .read_to_string()
                    .map_err(|_| anyhow::anyhow!("YOUTUBE_RESPONSE_READ_FAILED"))?;
                return serde_json::from_str(&text).map_err(|_| anyhow::anyhow!("YOUTUBE_INVALID_RESPONSE"));
            }
            if status == 403 {
                bail!("YOUTUBE_FORBIDDEN: check API key restrictions, enabled API and quota in Google Cloud");
            }
            if status == 400 || status == 401 {
                bail!("YOUTUBE_AUTH_OR_REQUEST_REJECTED");
            }
            if status != 429 && status < 500 {
                bail!("YOUTUBE_HTTP_{status}");
            }
        }
        if attempt < 2 {
            for _ in 0..(5 << attempt) {
                check(cancel)?;
                std::thread::sleep(Duration::from_millis(100));
            }
        }
    }
    bail!("YOUTUBE_TEMPORARILY_UNAVAILABLE")
}

pub(crate) fn parse_video(item: &Value, at: i64) -> Option<Video> {
    let id = item["id"].as_str()?;
    if !valid_id(id) {
        return None;
    }
    if item["snippet"]["liveBroadcastContent"].as_str().is_some_and(|s| s != "none") {
        return None;
    }
    let stat = |key: &str| item["statistics"][key].as_str().and_then(|n| n.parse().ok());
    Some(Video {
        id: id.into(),
        title: item["snippet"]["title"].as_str()?.into(),
        author: item["snippet"]["channelTitle"].as_str()?.into(),
        channel_id: item["snippet"]["channelId"].as_str()?.into(),
        published_at: item["snippet"]["publishedAt"].as_str()?.into(),
        duration_seconds: item["contentDetails"]["duration"].as_str().and_then(duration),
        views: stat("viewCount"),
        likes: stat("likeCount"),
        comments: stat("commentCount"),
        checked_at: at,
        review: "unverified".into(),
        notes: String::new(),
    })
}
fn details(store: &Store, key: &str, ids: &[String], cancel: &AtomicBool, refresh: bool) -> Result<usize> {
    let mut found = 0;
    for chunk in ids.chunks(50) {
        let ids_text = chunk.join(",");
        let value =
            get(store, key, "videos", &[("part", "snippet,contentDetails,statistics"), ("id", &ids_text)], cancel)?;
        let items = value["items"].as_array().ok_or_else(|| anyhow::anyhow!("YOUTUBE_INVALID_RESPONSE"))?;
        let mut returned = BTreeSet::new();
        for item in items {
            if let Some(video) = parse_video(item, now()) {
                returned.insert(video.id.clone());
                // Unknown lengths are retained as unknown; known non-short candidates are excluded.
                if video.duration_seconds.is_none_or(|s| s > 0 && s < 240) {
                    store.upsert(&video)?;
                    found += 1;
                } else if refresh {
                    store.db.execute("DELETE FROM videos WHERE id=?1", [&video.id])?;
                }
            }
        }
        if refresh {
            for id in chunk.iter().filter(|id| !returned.contains(*id)) {
                store.db.execute("DELETE FROM videos WHERE id=?1", [id])?;
            }
        }
    }
    Ok(found)
}
pub(crate) fn discover(store: &Store, key: &str, cancel: &AtomicBool, found: &mut usize) -> Result<()> {
    let existing: Vec<String> = store
        .db
        .prepare("SELECT id FROM videos ORDER BY checked ASC LIMIT 1000")?
        .query_map([], |r| r.get(0))?
        .collect::<std::result::Result<_, _>>()?;
    details(store, key, &existing, cancel, true)?;
    let queries = [
        "absurd comedy shorts",
        "3d animation comedy shorts",
        "zombie comedy shorts",
        "funny animals shorts",
        "surreal ai comedy shorts",
    ];
    let mut seen = BTreeSet::new();
    for query in queries {
        for days in [7, 30] {
            let after = jiff::Timestamp::from_second(now() - days * 86400)?.to_string();
            for order in ["viewCount", "date"] {
                let value = get(
                    store,
                    key,
                    "search",
                    &[
                        ("part", "snippet"),
                        ("type", "video"),
                        ("q", query),
                        ("regionCode", "US"),
                        ("relevanceLanguage", "en"),
                        ("videoDuration", "short"),
                        ("publishedAfter", &after),
                        ("order", order),
                        ("maxResults", "50"),
                    ],
                    cancel,
                )?;
                let items = value["items"].as_array().ok_or_else(|| anyhow::anyhow!("YOUTUBE_INVALID_RESPONSE"))?;
                let ids: Vec<String> = items
                    .iter()
                    .filter_map(|i| i["id"]["videoId"].as_str())
                    .filter(|id| valid_id(id))
                    .filter(|id| seen.insert((*id).to_string()))
                    .map(str::to_owned)
                    .collect();
                *found += details(store, key, &ids, cancel, false)?;
            }
        }
    }
    check(cancel)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn iso_duration_and_unknown_statistics() {
        assert_eq!(duration("PT1M12S"), Some(72));
        assert_eq!(duration("PT30S"), Some(30));
        for invalid in ["PT", "P1D", "PT1M2M", "PT1.5S", "PT999999999999999999999H", "bad"] {
            assert_eq!(duration(invalid), None);
        }
        let item = serde_json::json!({"id":"abcdefghijk","snippet":{"title":"A","channelTitle":"B","channelId":"C","publishedAt":"2026-11-02T00:00:00Z"},"contentDetails":{"duration":"PT20S"},"statistics":{"viewCount":"0"}});
        let v = parse_video(&item, 123).unwrap();
        assert_eq!(v.views, Some(0));
        assert_eq!(v.likes, None);
        assert_eq!(v.comments, None);
    }
}
