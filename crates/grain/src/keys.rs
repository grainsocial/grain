//! The clock, and record keys made from it: TIDs, the timestamp keys
//! atproto names records with.

use crate::base32;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static LAST_MICROS: AtomicU64 = AtomicU64::new(0);

pub fn now_micros() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("the clock is after 1970")
        .as_micros() as u64
}

/// Seconds since the epoch, as a JWT's `iat` and `exp` count them.
pub fn now_secs() -> u64 {
    now_micros() / 1_000_000
}

/// `micros` since the epoch as RFC 3339 in UTC to the millisecond,
/// `2026-10-31T12:00:00.000Z`: as JavaScript's `toISOString` writes it, so
/// that times grain writes and times clients write sort together as text.
pub fn iso(micros: u64) -> String {
    let secs = micros / 1_000_000;
    let millis = (micros / 1_000) % 1_000;
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    // Howard Hinnant's days_from_civil, inverted.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{millis:03}Z",
        rem / 3_600,
        rem % 3_600 / 60,
        rem % 60
    )
}

/// The time now, as [`iso`] writes it.
pub fn now_iso() -> String {
    iso(now_micros())
}

/// A TID that sorts after every TID this process made before it.
pub fn tid() -> String {
    let now = now_micros();
    let micros = LAST_MICROS
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |last| {
            Some(now.max(last + 1))
        })
        .map(|last| now.max(last + 1))
        .expect("the update closure always returns Some");
    tid_from(micros, u64::from(std::process::id()))
}

pub fn tid_from(micros: u64, clock: u64) -> String {
    let micros = micros & ((1 << 53) - 1);
    base32::encode_u64(base32::SORTABLE, (micros << 10) | (clock & 1023))
}

/// The timestamp in a TID, or `None` if `tid` is not one.
pub fn tid_micros(tid: &str) -> Option<u64> {
    base32::decode_u64(base32::SORTABLE, tid).map(|v| v >> 10)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tids_increase_and_decode() {
        let a = tid();
        let b = tid();
        assert!(b > a);
        assert_eq!(a.len(), 13);
        let micros = tid_micros(&a).unwrap();
        assert!(micros.abs_diff(now_micros()) < 10_000_000);
        assert_eq!(tid_micros(&tid_from(42, 7)), Some(42));
        assert_eq!(tid_micros("nope"), None);
        assert!(now_secs().abs_diff(now_micros() / 1_000_000) <= 1);
    }

    #[test]
    fn times_are_written_as_javascript_writes_them() {
        assert_eq!(iso(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(iso(951_782_400_000_000), "2000-02-29T00:00:00.000Z");
        assert_eq!(iso(1_793_448_000_123_456), "2026-10-31T12:00:00.123Z");
        assert_eq!(iso(4_102_444_799_999_000), "2099-12-31T23:59:59.999Z");
        assert_eq!(now_iso().len(), 24);
    }
}
