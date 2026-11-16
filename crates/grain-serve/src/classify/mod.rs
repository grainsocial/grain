//! The moderation classifiers: what is new on grain, scored as it
//! arrives, off the path of the request or the stream that brought it.
//!
//! A record a live path puts new in the index ([`Index::arrived`]) is
//! scored by the classifiers of its collection ([`classifiers::ALL`]), and
//! its author, once they have written nothing for a minute, by the
//! classifiers of accounts: an import writes hundreds of photos in a row,
//! and an account's state counts them, so the account is asked about once
//! it settles rather than once a photo. Backfill does not say what it
//! puts; what existed before is scored by no one here.
//!
//! Scoring a subject builds the state its classifier shows the model,
//! skips it where there is none, or where the same classifier scored the
//! same state before (its fingerprint, [`Index::fingerprint`]), and
//! otherwise asks Clef ([`clef`]) and keeps the scores
//! ([`Index::classified`]). Nothing acts on a score: one at or past its
//! threshold files a report ([`Index::file_report_once`]), by grain's
//! labeler with the classifier named in its reason, into the queue a
//! person's report lands in, and a person makes every decision. With no
//! labeler, none is filed.
//!
//! Nothing of an account taken down, or gone from its host, is scored,
//! and nothing of one that a report or a label ever said was about the
//! safety of children ([`Index::may_classify`]): that is for a person to
//! judge, and is never handed to a model.
//!
//! Bridged accounts are the exception that acts: a gallery, story or
//! comment Bridgy Fed writes for one is labeled `spam`, which hides it, as
//! it arrives, by grain's own labeler, unless a label of `spam` was ever
//! given it, so that a moderator who took one off is not overruled. An
//! account is bridged by its handle or profile ([`classifiers::bridged`]),
//! or else by the PDS its DID document names, Bridgy Fed's: an account
//! new to the index has no handle there yet, and its profile may come
//! after its first post. That asks no model, and runs with or without
//! Clef.
//!
//! Images go to Clef inline, at most four a request, each the CDN's
//! thumbnail of its blob made at most 512 pixels on its longer side and
//! JPEG: Clef counts its context on the encoded bytes, and a larger photo
//! can overflow it.

pub mod classifiers;
pub mod clef;

use crate::cdn::{Cdn, THUMBNAIL};
use crate::index::moderation::NewReport;
use crate::index::{Index, record_uri, records};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use classifiers::{ALL, BRIDGED_HIDDEN, Classifier, Kind, Subject};
use grain::env::Ctx;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::{Semaphore, mpsc};

/// How many arrivals wait to be scored before more are dropped.
pub const QUEUED: usize = 10_000;
/// How many subjects are scored at once.
const AT_ONCE: usize = 4;
/// The longest side of an image shown to Clef.
pub const IMAGE_EDGE: u32 = 512;
/// How many images a request may carry.
const MOST_IMAGES: usize = 4;

/// How long things take.
#[derive(Debug, Clone, Copy)]
pub struct Timing {
    /// How long an account waits after its last write to be scored.
    pub settle: Duration,
    /// How long a subject that failed waits to be tried again, doubled
    /// each time it fails.
    pub retry: Duration,
    /// How many times a subject is tried before it is dropped.
    pub attempts: u32,
    pub clef: clef::Tries,
}

impl Default for Timing {
    fn default() -> Timing {
        Timing {
            settle: Duration::from_secs(60),
            retry: Duration::from_secs(5),
            attempts: 5,
            clef: clef::Tries::default(),
        }
    }
}

/// The classifiers, at work on an index.
pub struct Classify {
    pub index: Arc<Index>,
    /// What Clef, the CDN and DID documents are asked with.
    pub ctx: Ctx,
    /// Where images are drawn from.
    pub cdn: Cdn,
    /// Clef, if it is set up; without it, only bridged accounts are seen to.
    pub clef: Option<clef::Config>,
    /// grain's labeler, by its DID, which bridged accounts' labels are
    /// given by; none gives none.
    pub labeler: Option<String>,
    pub timing: Timing,
}

/// What scoring a subject did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scored {
    /// Nothing: out of scope, nothing to judge, or judged as it is.
    Skipped,
    /// Asked, kept, and whether a report was filed.
    Asked { filed: bool },
}

impl Classify {
    /// Starts scoring what arrives in the index, on the runtime this is
    /// called on; whether it was not already.
    pub fn start(self) -> bool {
        let (to, from) = mpsc::channel(QUEUED);
        if !self.index.classify_to(to) {
            return false;
        }
        tokio::spawn(Arc::new(self).run(from));
        true
    }

    async fn run(self: Arc<Self>, mut from: mpsc::Receiver<String>) {
        let settling: Arc<Mutex<HashMap<String, u64>>> = Arc::default();
        let turns = Arc::new(Semaphore::new(AT_ONCE));
        while let Some(uri) = from.recv().await {
            let Some((did, collection, _)) = record_uri(&uri) else {
                continue;
            };
            if BRIDGED_HIDDEN.contains(&collection) {
                self.clone().bridged(uri.clone(), did.to_string());
            }
            if self.clef.is_none() {
                continue;
            }
            for c in ALL.iter().filter(|c| c.covers(collection)) {
                self.clone()
                    .queue(c, uri.clone(), did.to_string(), turns.clone());
            }
            self.clone()
                .settle(did.to_string(), settling.clone(), turns.clone());
        }
    }

    /// Scores `did` with the account classifiers once it has written
    /// nothing for [`Timing::settle`].
    fn settle(
        self: Arc<Self>,
        did: String,
        settling: Arc<Mutex<HashMap<String, u64>>>,
        turns: Arc<Semaphore>,
    ) {
        let mine = {
            let mut settling = settling.lock().unwrap();
            let n = settling.entry(did.clone()).or_default();
            *n += 1;
            *n
        };
        tokio::spawn(async move {
            tokio::time::sleep(self.timing.settle).await;
            {
                let mut settling = settling.lock().unwrap();
                if settling.get(&did) != Some(&mine) {
                    return;
                }
                settling.remove(&did);
            }
            for c in ALL.iter().filter(|c| c.kind == Kind::Account) {
                self.clone()
                    .queue(c, did.clone(), did.clone(), turns.clone());
            }
        });
    }

    /// Scores `subject`, of the account `did`, with `c`, in turn, trying
    /// again after a failure until [`Timing::attempts`].
    fn queue(
        self: Arc<Self>,
        c: &'static Classifier,
        subject: String,
        did: String,
        turns: Arc<Semaphore>,
    ) {
        tokio::spawn(async move {
            let scored = tried(self.timing, || async {
                let _turn = turns.acquire().await.expect("never closed");
                self.score(c, &subject, &did).await.map(drop)
            });
            if let Err(e) = scored.await {
                tracing::warn!(classifier = c.name, %subject, error = %e, "classify: dropped");
            }
        });
    }

    /// Labels the post at `uri` `spam` if `did` was bridged in, apart from
    /// the loop that takes arrivals, as a DID document may be slow to
    /// read, trying again after a failure until [`Timing::attempts`].
    fn bridged(self: Arc<Self>, uri: String, did: String) {
        if self.labeler.is_none() {
            return;
        }
        tokio::spawn(async move {
            let labeled = tried(self.timing, || self.label_bridged(&uri, &did));
            if let Err(e) = labeled.await {
                tracing::warn!(%uri, error = %e, "classify: labeling a bridged post");
            }
        });
    }

    async fn label_bridged(&self, uri: &str, did: &str) -> anyhow::Result<()> {
        let labeler = self.labeler.as_deref().expect("a labeler");
        let bridged = match self.index.read(|db| classifiers::bridged(db, did))? {
            true => true,
            false => {
                let doc = grain::identity::kept_document(&self.ctx, did).await?;
                classifiers::bridged_host(&doc)
            }
        };
        if bridged {
            let now = grain::keys::now_iso();
            self.index.label_once(labeler, uri, "spam", &now)?;
        }
        Ok(())
    }

    /// Scores `subject`, of the account `did`, with `c`, as it stands now.
    pub async fn score(&self, c: &Classifier, subject: &str, did: &str) -> anyhow::Result<Scored> {
        let Some(clef) = &self.clef else {
            return Ok(Scored::Skipped);
        };
        if !self.index.may_classify(did)? {
            return Ok(Scored::Skipped);
        }
        if let Some((_, collection, _)) = record_uri(subject) {
            let table = records::table_of(collection).expect("a collection classified");
            if !self.index.holds(table, subject)? {
                return Ok(Scored::Skipped);
            }
        }
        let handle = self.index.handle(did)?.flatten();
        let s = Subject {
            uri: subject.to_string(),
            did: did.to_string(),
            handle,
        };
        let Some(state) = self.index.read(|db| (c.state)(db, &s))? else {
            return Ok(Scored::Skipped);
        };
        let fingerprint = Sha256::new()
            .chain_update(c.version())
            .chain_update(state.to_string())
            .finalize();
        let fingerprint: String = fingerprint[..16]
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect();
        if self.index.fingerprint(c.name, subject)?.as_deref() == Some(&fingerprint) {
            return Ok(Scored::Skipped);
        }
        let mut images = vec![];
        for (did, cid) in (c.images)(&state).into_iter().take(MOST_IMAGES) {
            let blob = json!({ "ref": { "$link": cid } });
            let url = self
                .cdn
                .url(&did, &blob, THUMBNAIL)
                .expect("a blob that names a CID");
            images.push(self.image(&url).await?);
        }
        let answers = clef::ask(
            &self.ctx.http,
            clef,
            &state,
            &(c.questions)(),
            &images,
            self.timing.clef,
        )
        .await?;
        let now = grain::keys::now_iso();
        self.index
            .classified(&crate::index::classify::Classification {
                subject: subject.to_string(),
                subject_did: did.to_string(),
                classifier: c.name.to_string(),
                signals: answers.signals.clone(),
                state,
                fingerprint,
                model: answers.model,
                scanned_at: now.clone(),
            })?;
        let mut crossing: Option<(&str, f64)> = None;
        for (signal, s) in &answers.signals {
            let past = c.threshold(signal).is_some_and(|t| s.score >= t);
            if past && crossing.is_none_or(|(_, top)| s.score > top) {
                crossing = Some((signal, s.score));
            }
        }
        let Some((signal, score)) = crossing else {
            return Ok(Scored::Asked { filed: false });
        };
        // A report names its reporter by DID: the server's, as its labels.
        let Some(by) = self.labeler.as_deref() else {
            return Ok(Scored::Asked { filed: false });
        };
        let reason = format!("{}: {signal} {score:.2}", c.name);
        let label = (c.label)(signal);
        let filed = self.index.file_report_once(&NewReport {
            subject,
            subject_did: did,
            label,
            reason_type: None,
            reason: Some(&reason),
            reported_by: by,
            created_at: &now,
        })?;
        let filed = filed.is_some();
        if filed {
            tracing::info!(classifier = c.name, %subject, label, "classify: filed a report");
        }
        Ok(Scored::Asked { filed })
    }

    /// The image at `url`, at most [`IMAGE_EDGE`] on its longer side, as
    /// a JPEG `data:` URL.
    async fn image(&self, url: &str) -> anyhow::Result<String> {
        let res = self.ctx.http.get(url).send().await?.error_for_status()?;
        let bytes = res.bytes().await?;
        let jpeg = tokio::task::spawn_blocking(move || shrink(&bytes)).await??;
        Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(jpeg)))
    }
}

/// Runs `f` until it succeeds, [`Timing::attempts`] times at most,
/// waiting [`Timing::retry`] after the first failure, doubled after each
/// one after; the last failure, if none did.
async fn tried<F, Fut>(timing: Timing, mut f: F) -> anyhow::Result<()>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = anyhow::Result<()>>,
{
    let mut attempt = 1;
    loop {
        let Err(e) = f().await else {
            return Ok(());
        };
        if attempt >= timing.attempts {
            return Err(e);
        }
        tokio::time::sleep(timing.retry * 2u32.pow(attempt - 1)).await;
        attempt += 1;
    }
}

/// `bytes`, a PNG, JPEG or WebP, as a JPEG no more than [`IMAGE_EDGE`] on
/// its longer side.
pub fn shrink(bytes: &[u8]) -> anyhow::Result<Vec<u8>> {
    let image = image::load_from_memory(bytes)?;
    let image = match image.width().max(image.height()) > IMAGE_EDGE {
        true => image.resize(
            IMAGE_EDGE,
            IMAGE_EDGE,
            image::imageops::FilterType::Triangle,
        ),
        false => image,
    };
    let mut out = std::io::Cursor::new(Vec::new());
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 80);
    image.to_rgb8().write_with_encoder(encoder)?;
    Ok(out.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn images_are_shrunk_to_512_as_jpeg() {
        let png = |w, h| {
            let mut out = std::io::Cursor::new(Vec::new());
            let image = image::RgbImage::from_pixel(w, h, image::Rgb([200, 10, 10]));
            image.write_to(&mut out, image::ImageFormat::Png).unwrap();
            out.into_inner()
        };
        let big = image::load_from_memory(&shrink(&png(2000, 1000)).unwrap()).unwrap();
        assert_eq!((big.width(), big.height()), (512, 256));
        let small = shrink(&png(100, 300)).unwrap();
        assert!(small.starts_with(&[0xFF, 0xD8, 0xFF]));
        let small = image::load_from_memory(&small).unwrap();
        assert_eq!((small.width(), small.height()), (100, 300));
        assert!(shrink(b"<html>").is_err());
    }
}
