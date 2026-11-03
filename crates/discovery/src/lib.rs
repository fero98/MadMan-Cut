//! Metadata-only discovery. Never downloads source media or calls an AI provider.
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result, bail, ensure};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub mod production;
#[cfg(test)]
mod tests;
mod youtube;
pub use production::{Plan, Project, Shot};

pub const RETENTION: i64 = 30 * 24 * 60 * 60;
pub const SERIES: [&str; 5] =
    ["Zombie in America", "Animals Gone Crazy", "Humans vs Monsters", "AI World Gone Wrong", "MADMAN Dark Comedy"];
pub fn now() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64
}

/// Shares the editor's explicit test override, otherwise uses local (not roaming/OneDrive) storage.
pub fn root() -> Result<PathBuf> {
    if let Some(path) = std::env::var_os("NUZKY_DATA_DIR").filter(|p| !p.is_empty()) {
        return Ok(PathBuf::from(path).join("viral-lab"));
    }
    Ok(dirs::data_local_dir().context("LOCAL_STORAGE_UNAVAILABLE")?.join("madman-cut/viral-lab"))
}

fn credential(root: &Path) -> Result<keyring::Entry> {
    let id: String =
        Sha256::digest(root.as_os_str().to_string_lossy().as_bytes()).iter().map(|b| format!("{b:02x}")).collect();
    keyring::Entry::new("cz.madman.cut.youtube", &id).map_err(|_| anyhow::anyhow!("KEYCHAIN_UNAVAILABLE"))
}
pub fn api_key(root: &Path) -> Result<Option<String>> {
    match credential(root)?.get_secret() {
        Ok(bytes) => Ok(Some(String::from_utf8(bytes).context("INVALID_STORED_KEY")?)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => bail!("KEYCHAIN_UNAVAILABLE"),
    }
}
pub fn save_key(root: &Path, key: &str) -> Result<()> {
    let entry = credential(root)?;
    if key.is_empty() {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => return Ok(()),
            Err(_) => bail!("KEYCHAIN_UNAVAILABLE"),
        }
    }
    ensure!(
        (20..=200).contains(&key.len()) && key.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-'),
        "INVALID_KEY_FORMAT"
    );
    entry.set_secret(key.as_bytes()).map_err(|_| anyhow::anyhow!("KEYCHAIN_UNAVAILABLE"))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename = "ViralVideo"))]
#[serde(rename_all = "camelCase")]
pub struct Video {
    pub id: String,
    pub title: String,
    pub author: String,
    pub channel_id: String,
    pub published_at: String,
    pub duration_seconds: Option<u64>,
    pub views: Option<u64>,
    pub likes: Option<u64>,
    pub comments: Option<u64>,
    pub checked_at: i64,
    pub review: String,
    pub notes: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename = "ViralRun"))]
#[serde(rename_all = "camelCase")]
pub struct Run {
    pub id: i64,
    pub started_at: i64,
    pub finished_at: Option<i64>,
    pub status: String,
    pub found: i64,
    pub error: Option<String>,
}
#[derive(Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename = "ViralDashboard"))]
#[serde(rename_all = "camelCase")]
pub struct Dashboard {
    pub videos: Vec<Video>,
    pub projects: Vec<Project>,
    pub runs: Vec<Run>,
    pub searches_remaining: i64,
    pub analytics_enabled: bool,
}

pub struct Store {
    db: Connection,
}
impl Store {
    pub fn open(root: &Path) -> Result<Self> {
        std::fs::create_dir_all(root).context("CREATE_STORAGE_FAILED")?;
        Self::from_connection(Connection::open(root.join("discovery.sqlite3"))?)
    }
    pub fn memory() -> Result<Self> {
        Self::from_connection(Connection::open_in_memory()?)
    }
    fn from_connection(db: Connection) -> Result<Self> {
        // React's initial request, polling and another worker can open the file together.
        // A journal-mode transition can return SQLITE_BUSY without honoring busy_timeout.
        static INITIALIZE: std::sync::Mutex<()> = std::sync::Mutex::new(());
        let _initialize = INITIALIZE.lock().map_err(|_| anyhow::anyhow!("STORAGE_INITIALIZATION_FAILED"))?;
        db.busy_timeout(Duration::from_secs(3))?;
        let initialize = || {
            db.execute_batch("PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; PRAGMA journal_mode=WAL;
          CREATE TABLE IF NOT EXISTS videos(id TEXT PRIMARY KEY, data TEXT NOT NULL, checked INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS observations(video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
            checked INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(video_id,checked));
          CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY, started INTEGER NOT NULL, finished INTEGER,
            status TEXT NOT NULL, found INTEGER NOT NULL DEFAULT 0, error TEXT);
          CREATE TABLE IF NOT EXISTS requests(id INTEGER PRIMARY KEY, at INTEGER NOT NULL, kind TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS projects(id INTEGER PRIMARY KEY, source_id TEXT REFERENCES videos(id) ON DELETE SET NULL,
            revision INTEGER NOT NULL, approved_revision INTEGER, status TEXT NOT NULL, data TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS videos_checked ON videos(checked);
          CREATE INDEX IF NOT EXISTS requests_at ON requests(at);
          CREATE INDEX IF NOT EXISTS observations_checked ON observations(checked);")
        };
        for attempt in 0..10 {
            match initialize() {
                Ok(()) => break,
                Err(rusqlite::Error::SqliteFailure(ref e, _))
                    if attempt < 9
                        && matches!(
                            e.code,
                            rusqlite::ErrorCode::DatabaseBusy | rusqlite::ErrorCode::DatabaseLocked
                        ) =>
                {
                    std::thread::sleep(Duration::from_millis(50))
                }
                Err(error) => return Err(error.into()),
            }
        }
        let store = Self { db };
        store.prune(now())?;
        Ok(store)
    }
    pub fn prune(&self, at: i64) -> Result<()> {
        // A new snapshot cannot refresh an older statistical observation. Delete each on its own clock.
        self.db.execute("DELETE FROM observations WHERE checked <= ?1", [at - RETENTION])?;
        self.db.execute("DELETE FROM videos WHERE checked <= ?1", [at - RETENTION])?;
        self.db.execute("DELETE FROM requests WHERE at < ?1", [at - RETENTION])?;
        self.db.execute("UPDATE runs SET status='interrupted',finished=?1,error='RUN_INTERRUPTED' WHERE status='running' AND started < ?2", params![at, at-600])?;
        Ok(())
    }
    pub fn upsert(&self, video: &Video) -> Result<()> {
        ensure!(youtube::valid_id(&video.id), "INVALID_VIDEO_ID");
        let mut updated = video.clone();
        if let Some(old) = self.video(&video.id)? {
            updated.review = old.review;
            updated.notes = old.notes;
        }
        let data = serde_json::to_string(&updated)?;
        let tx = self.db.unchecked_transaction()?;
        tx.execute("INSERT INTO videos VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET data=excluded.data,checked=excluded.checked", params![updated.id, data, updated.checked_at])?;
        // Only public statistics are retained as observations, never source media or comment text.
        tx.execute(
            "INSERT OR REPLACE INTO observations VALUES(?1,?2,?3)",
            params![
                updated.id,
                updated.checked_at,
                serde_json::to_string(
                    &serde_json::json!({"views": updated.views,"likes":updated.likes,"comments":updated.comments})
                )?
            ],
        )?;
        tx.commit()?;
        Ok(())
    }
    pub fn video(&self, id: &str) -> Result<Option<Video>> {
        let data: Option<String> =
            self.db.query_row("SELECT data FROM videos WHERE id=?1", [id], |r| r.get(0)).optional()?;
        data.map(|d| serde_json::from_str(&d).map_err(Into::into)).transpose()
    }
    pub fn review(&self, id: &str, review: &str, notes: &str) -> Result<()> {
        ensure!(["unverified", "short_confirmed", "rejected"].contains(&review), "INVALID_REVIEW");
        ensure!(notes.len() <= 8000, "NOTES_TOO_LONG");
        let mut video = self.video(id)?.context("VIDEO_NOT_FOUND")?;
        video.review = review.into();
        video.notes = notes.trim().into();
        self.db.execute("UPDATE videos SET data=?1 WHERE id=?2", params![serde_json::to_string(&video)?, id])?;
        Ok(())
    }
    pub fn dashboard(&self) -> Result<Dashboard> {
        let mut videos: Vec<Video> = self
            .db
            .prepare("SELECT data FROM videos ORDER BY checked DESC LIMIT 1000")?
            .query_map([], |r| r.get::<_, String>(0))?
            .map(|r| Ok(serde_json::from_str(&r?)?))
            .collect::<Result<_>>()?;
        // Ordering is by the original API view count, without derived performance metrics.
        videos.sort_by(|a, b| b.views.cmp(&a.views).then_with(|| a.id.cmp(&b.id)));
        let projects = self.projects()?;
        let runs = self
            .db
            .prepare("SELECT id,started,finished,status,found,error FROM runs ORDER BY id DESC LIMIT 30")?
            .query_map([], |r| {
                Ok(Run {
                    id: r.get(0)?,
                    started_at: r.get(1)?,
                    finished_at: r.get(2)?,
                    status: r.get(3)?,
                    found: r.get(4)?,
                    error: r.get(5)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        let used: i64 = self.db.query_row(
            "SELECT count(*) FROM requests WHERE kind='search' AND at>=?1",
            [now() - 86400],
            |r| r.get(0),
        )?;
        Ok(Dashboard { videos, projects, runs, searches_remaining: (30 - used).max(0), analytics_enabled: false })
    }
    fn reserve(&self, kind: &str) -> Result<()> {
        // Persist before sending, including failed requests. The rolling budget is conservative across PT resets.
        self.db.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| -> Result<()> {
            let used: i64 = self.db.query_row(
                "SELECT count(*) FROM requests WHERE kind=?1 AND at>=?2",
                params![kind, now() - 86400],
                |r| r.get(0),
            )?;
            ensure!(used < if kind == "search" { 30 } else { 500 }, "LOCAL_QUOTA_EXHAUSTED");
            self.db.execute("INSERT INTO requests(at,kind) VALUES(?1,?2)", params![now(), kind])?;
            Ok(())
        })();
        if result.is_ok() {
            self.db.execute_batch("COMMIT")?;
        } else {
            self.db.execute_batch("ROLLBACK")?;
        }
        result
    }
    fn begin_run(&self) -> Result<i64> {
        self.db.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| -> Result<i64> {
            let running: i64 =
                self.db.query_row("SELECT count(*) FROM runs WHERE status='running'", [], |r| r.get(0))?;
            ensure!(running == 0, "DISCOVERY_BUSY");
            self.db.execute("INSERT INTO runs(started,status) VALUES(?1,'running')", [now()])?;
            Ok(self.db.last_insert_rowid())
        })();
        if result.is_ok() {
            self.db.execute_batch("COMMIT")?;
        } else {
            self.db.execute_batch("ROLLBACK")?;
        }
        result
    }
    pub fn discover(&self, key: &str, cancel: &AtomicBool) -> Result<usize> {
        ensure!(!key.is_empty(), "YOUTUBE_KEY_MISSING");
        let run = self.begin_run()?;
        let mut found = 0;
        let result = youtube::discover(self, key, cancel, &mut found);
        let status = match &result {
            Ok(()) => "complete",
            Err(_) if cancel.load(Ordering::Relaxed) => "cancelled",
            Err(_) => "failed",
        };
        let error = result.as_ref().err().map(|e| e.to_string());
        self.db.execute(
            "UPDATE runs SET finished=?1,status=?2,found=?3,error=?4 WHERE id=?5",
            params![now(), status, found as i64, error, run],
        )?;
        result.map(|()| found)
    }
    pub fn report(&self) -> Result<String> {
        let d = self.dashboard()?;
        let top: Vec<_> = d.videos.iter().filter(|v| v.review != "rejected").take(20).collect();
        let recommended: Vec<_> = d.projects.iter().filter(|p| p.status != "rejected").take(5).collect();
        let ready: Vec<_> = d
            .projects
            .iter()
            .filter(|p| p.status == "approved" && p.approved_revision == Some(p.revision))
            .take(3)
            .collect();
        Ok(serde_json::to_string_pretty(&serde_json::json!({
            "brand":"MADMAN STUDIO", "generatedAt":now(), "language":"en-US", "target":"US",
            "scope":"Top candidates in the collected sample, not a platform-wide ranking",
            "top20":top, "top5Adaptations":recommended, "top3Ready":ready,
            "trends":"N/A: derived analytics are disabled pending YouTube permission",
            "dayComparison":"N/A: derived analytics are disabled pending YouTube permission",
            "runs":d.runs, "automaticPublishing":false
        }))?)
    }
}
