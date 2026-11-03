//! The main webview's metadata and production workspace. No editor session is touched.
use anyhow::{Context, Result, bail, ensure};
use madman_discovery::{Plan, Store, api_key, root, save_key};
use serde_json::{Value, json};
use std::sync::atomic::{AtomicBool, Ordering};

static BUSY: AtomicBool = AtomicBool::new(false);
static CANCEL: AtomicBool = AtomicBool::new(false);
struct Running;
impl Drop for Running {
    fn drop(&mut self) {
        BUSY.store(false, Ordering::SeqCst);
    }
}

fn text<'a>(value: &'a Value, key: &str) -> Result<&'a str> {
    value[key].as_str().context("MISSING_TEXT_FIELD")
}
fn integer(value: &Value, key: &str) -> Result<i64> {
    value[key].as_i64().context("MISSING_INTEGER_FIELD")
}
fn execute(op: &str, value: Value) -> Result<Value> {
    let root = root()?;
    match op {
        "state" => {
            let (configured, key_error) = match api_key(&root) {
                Ok(k) => (k.is_some(), None),
                Err(e) => (false, Some(e.to_string())),
            };
            Ok(
                json!({"dashboard":Store::open(&root)?.dashboard()?,"keyConfigured":configured,"keyError":key_error,"busy":BUSY.load(Ordering::SeqCst)}),
            )
        }
        "key" => {
            ensure!(value["acceptedPolicies"].as_bool() == Some(true), "POLICY_ACCEPTANCE_REQUIRED");
            save_key(&root, text(&value, "key")?)?;
            Ok(Value::Null)
        }
        "discover" => {
            ensure!(BUSY.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_ok(), "DISCOVERY_BUSY");
            let _running = Running;
            CANCEL.store(false, Ordering::SeqCst);
            let key = api_key(&root)?.context("YOUTUBE_KEY_MISSING")?;
            let found = Store::open(&root)?.discover(&key, &CANCEL)?;
            Ok(json!({"found":found}))
        }
        "cancel" => {
            CANCEL.store(true, Ordering::SeqCst);
            Ok(Value::Null)
        }
        "review" => {
            Store::open(&root)?.review(text(&value, "id")?, text(&value, "review")?, text(&value, "notes")?)?;
            Ok(Value::Null)
        }
        "create" => {
            Ok(json!({"id":Store::open(&root)?.create_plan(value["sourceId"].as_str(),text(&value,"series")?)?}))
        }
        "save" => {
            let plan: Plan = serde_json::from_value(value["plan"].clone()).context("INVALID_PRODUCTION_PLAN")?;
            Store::open(&root)?.save_plan(integer(&value, "id")?, integer(&value, "revision")?, &plan)?;
            Ok(Value::Null)
        }
        "decide" => {
            Store::open(&root)?.decide(
                integer(&value, "id")?,
                integer(&value, "revision")?,
                value["approve"].as_bool() == Some(true),
                value["reviewed"].as_bool() == Some(true),
            )?;
            Ok(Value::Null)
        }
        "export" => {
            let path = Store::open(&root)?.export_plan(
                integer(&value, "id")?,
                integer(&value, "revision")?,
                std::path::Path::new(text(&value, "parent")?),
            )?;
            Ok(json!({"path":path}))
        }
        "report" => Ok(json!({"report":Store::open(&root)?.report()?})),
        _ => bail!("UNKNOWN_VIRAL_OPERATION"),
    }
}

#[tauri::command]
pub async fn viral_lab(op: String, value: Value) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || execute(&op, value))
        .await
        .map_err(|_| "VIRAL_WORKER_FAILED".to_string())?
        .map_err(|e| e.to_string())
}
