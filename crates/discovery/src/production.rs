//! Editable local story templates. These are explicitly not AI-generated or evidence of source content.
use super::*;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename = "ViralShot"))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Shot {
    pub start: u32,
    pub end: u32,
    pub action: String,
    pub dialogue: String,
    pub image_prompt: String,
    pub video_prompt: String,
    pub camera: String,
    pub sfx: String,
    pub caption: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename = "ViralPlan"))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Plan {
    pub title: String,
    pub description: String,
    pub series: String,
    pub language: String,
    pub aspect_ratio: String,
    pub duration_seconds: u32,
    pub script: String,
    pub character_bible: String,
    pub music: String,
    pub opening_frame: String,
    pub hashtags: Vec<String>,
    pub effort: String,
    pub originality_notes: String,
    pub generator: String,
    pub shots: Vec<Shot>,
    /// Points awarded by a human to this original plan, never computed from YouTube data.
    pub rubric: Option<[u8; 7]>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename = "ViralProject"))]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: i64,
    pub source_id: Option<String>,
    pub revision: i64,
    pub approved_revision: Option<i64>,
    pub status: String,
    pub plan: Plan,
}

pub fn validate(plan: &Plan) -> Result<()> {
    ensure!(plan.language == "en-US" && plan.aspect_ratio == "9:16", "PLAN_REQUIRES_EN_US_9_16");
    ensure!(SERIES.contains(&plan.series.as_str()), "INVALID_SERIES");
    ensure!((10..=30).contains(&plan.duration_seconds), "DURATION_REQUIRES_10_TO_30_SECONDS");
    ensure!((2..=12).contains(&plan.shots.len()), "PLAN_REQUIRES_2_TO_12_SHOTS");
    for text in [
        &plan.title,
        &plan.description,
        &plan.script,
        &plan.character_bible,
        &plan.music,
        &plan.opening_frame,
        &plan.effort,
        &plan.originality_notes,
        &plan.generator,
    ] {
        ensure!(!text.trim().is_empty() && text.len() <= 16000, "PLAN_REQUIRED_TEXT_MISSING_OR_TOO_LONG");
    }
    ensure!(
        !plan.hashtags.is_empty()
            && plan.hashtags.len() <= 12
            && plan.hashtags.iter().all(|s| s.starts_with('#') && s.len() <= 60 && !s.contains(char::is_whitespace)),
        "INVALID_HASHTAGS"
    );
    let mut end = 0;
    for shot in &plan.shots {
        ensure!(
            shot.start == end && shot.end > shot.start && shot.end <= plan.duration_seconds,
            "SHOT_TIMELINE_INVALID"
        );
        for text in [&shot.action, &shot.image_prompt, &shot.video_prompt, &shot.camera, &shot.sfx] {
            ensure!(!text.trim().is_empty() && text.len() <= 8000, "SHOT_REQUIRED_TEXT_MISSING_OR_TOO_LONG");
        }
        ensure!(shot.dialogue.len() <= 4000 && shot.caption.len() <= 4000, "SHOT_TEXT_TOO_LONG");
        end = shot.end;
    }
    ensure!(end == plan.duration_seconds, "SHOT_TIMELINE_INCOMPLETE");
    if let Some(scores) = plan.rubric {
        ensure!(
            scores.iter().zip([20, 20, 15, 15, 10, 10, 10]).all(|(score, max)| *score <= max),
            "INVALID_EDITORIAL_RUBRIC"
        );
    }
    Ok(())
}

pub fn template(series: &str) -> Result<Plan> {
    let index = SERIES.iter().position(|s| *s == series).context("INVALID_SERIES")?;
    let (title, bible, beats, lines) = match index {
        0 => (
            "The Zombie Drive-Thru",
            "An original friendly lime-green zombie in a plain burgundy hoodie, dented blue compact car, unbranded suburban drive-thru at dusk.",
            [
                "A zombie rolls up to a drive-thru speaker holding a tiny shopping list.",
                "He leans toward the speaker and carefully orders.",
                "The cashier hands him a giant foam brain-shaped hat.",
                "He puts on the hat. Three other zombies line up to order the same thing.",
            ],
            ["One brain, please.", "Make it a large.", "Hat or combo?", "Actually... four hats."],
        ),
        1 => (
            "My Raccoon Has a Day Job",
            "An original round gray raccoon wearing a plain yellow vest, a human roommate in a blue sweatshirt, unbranded apartment kitchen in warm daylight.",
            [
                "A human opens the fridge. A raccoon inside scans a carton of milk.",
                "The raccoon points at a tiny checkout terminal.",
                "The human holds up an empty wallet.",
                "The raccoon slides the human a tiny employee vest.",
            ],
            [
                "That'll be six bucks.",
                "Since when do you work here?",
                "I'm a little short.",
                "Cool. Your shift starts now.",
            ],
        ),
        2 => (
            "The Monster Under My Bed Charges Rent",
            "An original fluffy purple four-armed monster with round ears, an adult tenant in plain green pajamas, small bedroom with warm lamp light.",
            [
                "A purple hand slides an invoice out from under a bed.",
                "The tenant kneels and stares at the invoice.",
                "The monster proudly unveils a tiny renovated room under the bed.",
                "The tenant crawls into the tiny room as the monster takes the big bed.",
            ],
            ["Rent's due.", "You live under MY bed!", "Granite countertops.", "Fine. I'll take the studio."],
        ),
        3 => (
            "My Smart Fridge Took Things Personally",
            "An original boxy white smart fridge with two simple dot eyes, adult in plain orange shirt, unbranded compact kitchen in cool morning light.",
            [
                "A hungry human reaches for a fridge handle. The fridge rolls backward.",
                "The human tries to reassure the fridge.",
                "The fridge opens a tiny side compartment containing one pea.",
                "The human offers the pea back. The fridge rolls away wearing a tiny gym headband.",
            ],
            [
                "We need to talk.",
                "I just want a snack.",
                "Here's your emotional support pea.",
                "I'm working on myself.",
            ],
        ),
        _ => (
            "Death Is on Hold",
            "An original polite skeletal office visitor in a plain charcoal suit carrying a rounded hourglass, adult receptionist in navy, neutral office lobby with flat soft lighting.",
            [
                "A skeletal visitor places an almost-empty hourglass on a reception desk.",
                "The receptionist hands him a numbered ticket.",
                "He looks at the display: his number is very far away.",
                "He flips the hourglass, sits down, and starts knitting a tiny scarf.",
            ],
            ["I'm here for the appointment.", "Take a number.", "Seriously?", "Guess I've got time."],
        ),
    };
    let shots=(0..4).map(|i|Shot {start:i as u32*4,end:(i as u32+1)*4,action:beats[i].into(),dialogue:lines[i].into(),
        image_prompt:format!("Vertical 9:16 original stylized 3D comedy. {bible} {} Single clear composition, consistent characters, no text, no logos.",beats[i]),
        video_prompt:format!("4-second vertical 9:16 stylized 3D shot. {bible} {} Preserve character proportions and props from the previous shot. One readable action. No generated text or logos.",beats[i]),
        camera:if i==0 {"Medium close-up, quick gentle push in".into()} else if i==3 {"Wide shot, hold for the punchline".into()} else {"Static medium shot, clean cut".into()},
        sfx:if i==3 {"Soft comic pop; leave room for dialogue".into()} else {"Quiet room tone and a single soft prop sound".into()},caption:lines[i].into() }).collect();
    Ok(Plan {title:title.into(),description:format!("An original 16-second comedy for US viewers: {title}."),series:series.into(),language:"en-US".into(),aspect_ratio:"9:16".into(),duration_seconds:16,
        script:beats.iter().zip(lines).map(|(b,l)|format!("{b}\nDialogue: {l}")).collect::<Vec<_>>().join("\n\n"),character_bible:bible.into(),
        music:"Light quirky pizzicato, sparse percussion; original or separately licensed music, duck under dialogue.".into(),opening_frame:beats[0].into(),
        hashtags:vec!["#Shorts".into(),"#MadManStudio".into(),"#3DComedy".into()],effort:"Medium: four shots, one setting, two principal characters; generation retries not estimated.".into(),
        originality_notes:"Local original story template. Not an analysis or adaptation of the linked video's specific expression. Review dialogue, characters, music rights and similarity before approval.".into(),
        generator:"local-template-v1 (not AI-generated)".into(),shots,rubric:None})
}

impl Store {
    pub fn projects(&self) -> Result<Vec<Project>> {
        let rows = self
            .db
            .prepare("SELECT id,source_id,revision,approved_revision,status,data FROM projects ORDER BY id DESC")?
            .query_map([], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, Option<String>>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, Option<i64>>(3)?,
                    r.get::<_, String>(4)?,
                    r.get::<_, String>(5)?,
                ))
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        rows.into_iter()
            .map(|(id, source_id, revision, approved_revision, status, data)| {
                Ok(Project { id, source_id, revision, approved_revision, status, plan: serde_json::from_str(&data)? })
            })
            .collect()
    }
    pub fn create_plan(&self, source: Option<&str>, series: &str) -> Result<i64> {
        if let Some(id) = source {
            ensure!(self.video(id)?.is_some(), "VIDEO_NOT_FOUND");
        }
        let plan = template(series)?;
        self.db.execute(
            "INSERT INTO projects(source_id,revision,status,data) VALUES(?1,1,'draft',?2)",
            params![source, serde_json::to_string(&plan)?],
        )?;
        Ok(self.db.last_insert_rowid())
    }
    pub fn save_plan(&self, id: i64, revision: i64, plan: &Plan) -> Result<()> {
        validate(plan)?;
        let changed=self.db.execute("UPDATE projects SET data=?1,revision=revision+1,approved_revision=NULL,status='draft' WHERE id=?2 AND revision=?3",params![serde_json::to_string(plan)?,id,revision])?;
        ensure!(changed == 1, "STALE_PLAN: reload before saving");
        Ok(())
    }
    pub fn decide(&self, id: i64, revision: i64, approve: bool, reviewed: bool) -> Result<()> {
        let p = self.projects()?.into_iter().find(|p| p.id == id).context("PLAN_NOT_FOUND")?;
        ensure!(p.revision == revision, "STALE_PLAN");
        if approve {
            ensure!(reviewed, "MANUAL_REVIEW_REQUIRED");
            validate(&p.plan)?;
        }
        let changed = self.db.execute(
            "UPDATE projects SET status=?1,approved_revision=?2 WHERE id=?3 AND revision=?4",
            params![
                if approve { "approved" } else { "rejected" },
                if approve { Some(revision) } else { None },
                id,
                revision
            ],
        )?;
        ensure!(changed == 1, "STALE_PLAN");
        Ok(())
    }
    /// Creates a new directory only. A failed/partial export never looks like a completed package.
    pub fn export_plan(&self, id: i64, revision: i64, parent: &Path) -> Result<PathBuf> {
        let p = self.projects()?.into_iter().find(|p| p.id == id).context("PLAN_NOT_FOUND")?;
        ensure!(
            p.revision == revision && p.approved_revision == Some(revision) && p.status == "approved",
            "APPROVED_REVISION_REQUIRED"
        );
        validate(&p.plan)?;
        let name = format!("madman-{id}-v{revision}");
        let target = parent.join(&name);
        ensure!(!target.exists(), "OUTPUT_EXISTS");
        let staging = parent.join(format!(".{name}-{}.partial", now()));
        std::fs::create_dir(&staging).context("EXPORT_FOLDER_UNAVAILABLE")?;
        let write = || -> Result<()> {
            let plan = &p.plan;
            // Only original production material: no cached source statistics in the durable package.
            std::fs::write(staging.join("production.json"), serde_json::to_string_pretty(plan)?)?;
            std::fs::write(
                staging.join("script.txt"),
                format!(
                    "{}\n{}\n\n{}\n\nMusic: {}\nOriginality review: {}",
                    plan.title, plan.description, plan.script, plan.music, plan.originality_notes
                ),
            )?;
            let mut srt = String::new();
            for (index, shot) in plan.shots.iter().filter(|s| !s.caption.is_empty()).enumerate() {
                srt.push_str(&format!(
                    "{}\n00:00:{:02},000 --> 00:00:{:02},000\n{}\n\n",
                    index + 1,
                    shot.start,
                    shot.end,
                    shot.caption
                ));
            }
            std::fs::write(staging.join("captions.srt"), srt)?;
            let prompts = plan
                .shots
                .iter()
                .enumerate()
                .map(|(i, s)| {
                    format!(
                        "SHOT {} | {}-{}s\nIMAGE: {}\nVIDEO: {}\nCAMERA: {}\nDIALOGUE: {}\nSFX: {}",
                        i + 1,
                        s.start,
                        s.end,
                        s.image_prompt,
                        s.video_prompt,
                        s.camera,
                        s.dialogue,
                        s.sfx
                    )
                })
                .collect::<Vec<_>>()
                .join("\n\n");
            std::fs::write(staging.join("prompts.txt"), prompts)?;
            std::fs::write(
                staging.join("youtube.txt"),
                format!(
                    "{}\n\n{}\n\n{}\n\nOpening frame: {}",
                    plan.title,
                    plan.description,
                    plan.hashtags.join(" "),
                    plan.opening_frame
                ),
            )?;
            std::fs::write(
                staging.join("README.txt"),
                "MADMAN STUDIO production plan. No video has been generated or published.\nUse authorized original assets and licensed sound. Verify timing, US English and model capabilities before generation.\nThis package contains original planning material only.\n",
            )?;
            Ok(())
        };
        write()?;
        std::fs::rename(&staging, &target).context("EXPORT_FINALIZE_FAILED")?;
        Ok(target)
    }
}
