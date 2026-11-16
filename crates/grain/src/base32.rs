//! Unpadded base32 over an arbitrary 32-symbol alphabet.

/// The sortable alphabet atproto uses for TIDs.
pub const SORTABLE: &[u8; 32] = b"234567abcdefghijklmnopqrstuvwxyz";
/// RFC 4648 base32, lowercased.
pub const LOWER: &[u8; 32] = b"abcdefghijklmnopqrstuvwxyz234567";

/// Encodes `bytes` most significant bit first, without padding.
pub fn encode(alphabet: &[u8; 32], bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 8 / 5 + 1);
    let mut buffer: u32 = 0;
    let mut bits = 0;
    for &byte in bytes {
        buffer = (buffer << 8) | u32::from(byte);
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(alphabet[((buffer >> bits) & 31) as usize] as char);
        }
    }
    if bits > 0 {
        out.push(alphabet[((buffer << (5 - bits)) & 31) as usize] as char);
    }
    out
}

/// Encodes a u64 as 13 symbols, so encodings sort the way the integers do.
pub fn encode_u64(alphabet: &[u8; 32], value: u64) -> String {
    (0..13)
        .map(|i: u32| alphabet[((value >> (60 - 5 * i)) & 31) as usize] as char)
        .collect()
}

/// Inverts [`encode_u64`]. Returns `None` for anything that is not 13 symbols
/// of `alphabet` or does not fit a u64.
pub fn decode_u64(alphabet: &[u8; 32], text: &str) -> Option<u64> {
    if text.len() != 13 {
        return None;
    }
    let mut value: u64 = 0;
    for (i, c) in text.bytes().enumerate() {
        let symbol = alphabet.iter().position(|&a| a == c)? as u64;
        if i == 0 && symbol > 15 {
            return None;
        }
        value = (value << 5) | symbol;
    }
    Some(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc4648_vectors() {
        assert_eq!(encode(LOWER, b""), "");
        assert_eq!(encode(LOWER, b"f"), "my");
        assert_eq!(encode(LOWER, b"fo"), "mzxq");
        assert_eq!(encode(LOWER, b"foo"), "mzxw6");
        assert_eq!(encode(LOWER, b"foobar"), "mzxw6ytboi");
    }

    #[test]
    fn u64_round_trips_and_sorts() {
        for v in [0u64, 1, 31, 32, 1 << 40, u64::MAX >> 1, u64::MAX] {
            let s = encode_u64(SORTABLE, v);
            assert_eq!(s.len(), 13);
            assert_eq!(decode_u64(SORTABLE, &s), Some(v));
        }
        assert!(encode_u64(SORTABLE, 5) < encode_u64(SORTABLE, 6));
        assert!(encode_u64(SORTABLE, 1 << 50) > encode_u64(SORTABLE, (1 << 50) - 1));
    }

    #[test]
    fn decode_rejects_garbage() {
        assert_eq!(decode_u64(SORTABLE, "short"), None);
        assert_eq!(decode_u64(SORTABLE, "1111111111111"), None);
        assert_eq!(decode_u64(SORTABLE, "z222222222222"), None);
    }
}
