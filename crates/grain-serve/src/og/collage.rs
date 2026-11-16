//! Where a card's photos go: scattered over the frame, apart and whole,
//! each the shape it was taken in, by a seeded random walk. The seed is
//! the photos themselves, so a card fetched again is laid out the same,
//! and the walk is the web's from before this server, step for step, down
//! to the order its sort asked for random numbers in, so that a link
//! unfurled before keeps the card it had.

/// A photo to place: its key in the seed, and its width over its height.
#[derive(Debug, Clone, PartialEq)]
pub struct Item {
    pub key: String,
    pub aspect_ratio: f64,
}

/// Where a photo of `items` goes, by its index there.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Placement {
    pub item: usize,
    pub x: i64,
    pub y: i64,
    pub width: i64,
    pub height: i64,
}

#[derive(Clone, Copy)]
struct Rect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl Rect {
    fn overlaps(&self, other: &Rect) -> bool {
        !(self.x >= other.x + other.width
            || self.x + self.width <= other.x
            || self.y >= other.y + other.height
            || self.y + self.height <= other.y)
    }
}

/// JavaScript's `Math.round`: halves upward.
fn round(x: f64) -> f64 {
    (x + 0.5).floor()
}

/// A string's hash, over its UTF-16 code units, as 32-bit integers wrap.
fn hash(text: &str) -> i64 {
    let mut hash: i32 = 0;
    for unit in text.encode_utf16() {
        hash = (hash << 5).wrapping_sub(hash).wrapping_add(unit as i32);
    }
    (hash as i64).abs()
}

/// `x` to three decimals, a tie rounded up, as JavaScript's `toFixed(3)`
/// writes it.
fn fixed3(x: f64) -> String {
    // The exact decimal expansion of `x`, which rounds as `toFixed` does.
    let exact = format!("{:.60}", x.abs());
    let (whole, frac) = exact.split_once('.').expect("written with decimals");
    let mut digits: Vec<u8> = format!("{whole}{}", &frac[..3]).into_bytes();
    let rest = &frac[3..];
    let up = rest.as_bytes()[0] >= b'5';
    if up {
        let mut i = digits.len();
        loop {
            if i == 0 {
                digits.insert(0, b'1');
                break;
            }
            i -= 1;
            if digits[i] == b'9' {
                digits[i] = b'0';
            } else {
                digits[i] += 1;
                break;
            }
        }
    }
    let digits = String::from_utf8(digits).expect("ASCII digits");
    let (int, dec) = digits.split_at(digits.len() - 3);
    let sign = if x < 0.0 { "-" } else { "" };
    format!("{sign}{int}.{dec}")
}

/// The walk's random numbers, from a seed.
struct Random(i64);

impl Random {
    fn next(&mut self) -> f64 {
        self.0 = (self.0 * 9301 + 49297) % 233280;
        self.0 as f64 / 233280.0
    }
}

/// `items` sorted as V8 sorts an array of fewer than 64 with a
/// comparator: fewer than 8 by binary insertion, each in turn from the
/// second; more, by binary insertion after the run they start with,
/// ascending or strictly descending and then reversed. The comparator
/// draws random numbers, so which pairs it is asked of, and in what order,
/// is what places each photo.
fn sort(items: &mut [usize], mut compare: impl FnMut(usize, usize) -> f64) {
    let n = items.len();
    let mut run = 1;
    if n >= 8 {
        run = 2;
        let descending = compare(items[1], items[0]) < 0.0;
        while run < n {
            let order = compare(items[run], items[run - 1]);
            if (descending && order >= 0.0) || (!descending && order < 0.0) {
                break;
            }
            run += 1;
        }
        if descending {
            items[..run].reverse();
        }
    }
    for start in run..n {
        let pivot = items[start];
        let (mut left, mut right) = (0, start);
        while left < right {
            let mid = left + ((right - left) >> 1);
            if compare(pivot, items[mid]) < 0.0 {
                right = mid;
            } else {
                left = mid + 1;
            }
        }
        items.copy_within(left..start, left + 1);
        items[left] = pivot;
    }
}

/// Where each of `items` goes in a frame `width` by `height`, `gap` apart:
/// a photo on its own fills the frame as far as its shape lets it,
/// centered; more are scattered, and one that finds no room is left out.
pub fn layout(items: &[Item], width: f64, height: f64, gap: f64) -> Vec<Placement> {
    if let [item] = items {
        let scale = (width / item.aspect_ratio).min(height);
        let (w, h) = (scale * item.aspect_ratio, scale);
        return vec![Placement {
            item: 0,
            x: round((width - w) / 2.0) as i64,
            y: round((height - h) / 2.0) as i64,
            width: round(w) as i64,
            height: round(h) as i64,
        }];
    }
    let seed: Vec<String> = items
        .iter()
        .map(|i| format!("{}_{}", i.key, fixed3(i.aspect_ratio)))
        .collect();
    let mut random = Random(hash(&seed.join("|")));

    let mut order: Vec<usize> = (0..items.len()).collect();
    sort(&mut order, |a, b| {
        let a = items[a].aspect_ratio + (random.next() - 0.5) * 0.1;
        let b = items[b].aspect_ratio + (random.next() - 0.5) * 0.1;
        b - a
    });

    let coverage = 0.75 + random.next() * 0.1;
    let average = width * height * coverage / items.len() as f64;
    const SIZES: [(f64, f64); 3] = [(1.2, 1.8), (0.8, 1.2), (0.5, 0.8)];
    let shortest = width.min(height);
    let mut placements = Vec::new();
    let mut occupied: Vec<Rect> = Vec::new();
    let mut place = |item: usize, x: f64, y: f64, w: f64, h: f64, occupied: &mut Vec<Rect>| {
        let p = Placement {
            item,
            x: round(x) as i64,
            y: round(y) as i64,
            width: round(w) as i64,
            height: round(h) as i64,
        };
        occupied.push(Rect {
            x: p.x as f64,
            y: p.y as f64,
            width: p.width as f64 + gap,
            height: p.height as f64 + gap,
        });
        placements.push(p);
    };

    for &index in &order {
        let ratio = items[index].aspect_ratio;
        let (min, max) = SIZES[(random.next() * SIZES.len() as f64).floor() as usize];
        let multiplier = min + random.next() * (max - min);
        let area = average * multiplier;
        let target_height = (area / ratio).sqrt();
        let target_width = target_height * ratio;
        let (min_size, max_size) = (shortest * 0.12, shortest * 0.75);
        let mut w = min_size.max(max_size.min(target_width));
        let mut h = w / ratio;
        if h > max_size {
            h = max_size;
            w = h * ratio;
        }
        w = w.min(width - gap);
        h = h.min(height - gap);

        let mut placed = false;
        for attempt in 0..200 {
            let (x, y) = if attempt < 50 {
                (
                    random.next() * (width - w - gap),
                    random.next() * (height - h - gap),
                )
            } else {
                let grid = shortest / 8.0;
                let gx = (random.next() * ((width - w - gap) / grid).ceil()).floor();
                let gy = (random.next() * ((height - h - gap) / grid).ceil()).floor();
                (
                    (gx * grid).min(width - w - gap),
                    (gy * grid).min(height - h - gap),
                )
            };
            let reserved = Rect {
                x,
                y,
                width: w + gap,
                height: h + gap,
            };
            if !occupied.iter().any(|r| reserved.overlaps(r)) {
                place(index, x, y, w, h, &mut occupied);
                placed = true;
                break;
            }
        }

        // Smaller, on a grid, from the top left, down to a floor.
        let mut reduction = 0.0;
        while !placed && reduction <= 0.5 {
            let (rw, rh) = (w * (1.0 - reduction), h * (1.0 - reduction));
            reduction += 0.1;
            let floor = shortest * 0.08;
            let grid = (rw.min(rh) / 4.0).max(10.0);
            let mut gx = 0.0;
            while rw >= floor && rh >= floor && gx <= width - rw - gap && !placed {
                let mut gy = 0.0;
                while gy <= height - rh - gap && !placed {
                    let test = Rect {
                        x: gx,
                        y: gy,
                        width: rw + gap,
                        height: rh + gap,
                    };
                    if !occupied.iter().any(|r| test.overlaps(r)) {
                        place(index, gx, gy, rw, rh, &mut occupied);
                        placed = true;
                    }
                    gy += grid;
                }
                gx += grid;
            }
        }
    }
    placements
}

#[cfg(test)]
mod tests {
    use super::*;

    fn items(of: &[(&str, f64)]) -> Vec<Item> {
        of.iter()
            .map(|&(key, aspect_ratio)| Item {
                key: key.into(),
                aspect_ratio,
            })
            .collect()
    }

    /// Each placement as `[key, x, y, width, height]`.
    fn laid(items: &[Item], width: f64, height: f64) -> Vec<(String, i64, i64, i64, i64)> {
        layout(items, width, height, 12.0)
            .into_iter()
            .map(|p| (items[p.item].key.clone(), p.x, p.y, p.width, p.height))
            .collect()
    }

    fn mixed() -> Vec<Item> {
        items(&[
            ("a", 3.0 / 2.0),
            ("b", 2.0 / 3.0),
            ("c", 1.0),
            ("d", 16.0 / 9.0),
            ("e", 4.0 / 5.0),
            ("f", 1.5),
        ])
    }

    fn row(key: &str, x: i64, y: i64, w: i64, h: i64) -> (String, i64, i64, i64, i64) {
        (key.into(), x, y, w, h)
    }

    #[test]
    fn photos_go_where_the_web_put_them() {
        // What the web's layout gave for the same photos, in a card's
        // collage frame.
        assert_eq!(
            laid(&mixed(), 1152.0, 482.0),
            [
                row("d", 31, 31, 362, 203),
                row("a", 422, 308, 231, 154),
                row("f", 572, 35, 362, 241),
                row("c", 0, 252, 201, 201),
                row("e", 947, 0, 180, 225),
                row("b", 230, 263, 131, 197),
            ]
        );
        assert_eq!(
            laid(&mixed()[..2], 1152.0, 482.0),
            [row("a", 159, 25, 362, 241), row("b", 545, 12, 241, 362)]
        );
        // Ten photos, of which three find no room.
        let ratios = [1.5, 0.75, 1.0, 1.0625, 2.4];
        let ten: Vec<Item> = (0..10)
            .map(|i| Item {
                key: format!("p{i}"),
                aspect_ratio: ratios[i % 5],
            })
            .collect();
        assert_eq!(
            laid(&ten, 1152.0, 482.0),
            [
                row("p4", 469, 69, 362, 151),
                row("p9", 500, 320, 244, 102),
                row("p5", 213, 90, 214, 143),
                row("p0", 198, 256, 236, 158),
                row("p3", 857, 96, 260, 245),
                row("p8", 0, 0, 184, 173),
                row("p2", 0, 215, 172, 172),
            ]
        );
        assert_eq!(
            laid(&items(&[("s", 0.5)]), 1152.0, 482.0),
            [row("s", 456, 0, 241, 482)]
        );
    }

    #[test]
    fn a_crowded_frame_falls_back_to_smaller_photos() {
        // A frame too small for the random walk to find room in.
        let many: Vec<Item> = (0..8)
            .map(|i| Item {
                key: format!("q{i}"),
                aspect_ratio: 1.0,
            })
            .collect();
        let placed = layout(&many, 300.0, 200.0, 12.0);
        assert!(!placed.is_empty());
        for (i, a) in placed.iter().enumerate() {
            assert!(a.x >= 0 && a.y >= 0 && a.x + a.width <= 300 && a.y + a.height <= 200);
            for b in &placed[i + 1..] {
                let apart = a.x + a.width <= b.x
                    || b.x + b.width <= a.x
                    || a.y + a.height <= b.y
                    || b.y + b.height <= a.y;
                assert!(apart, "{a:?} and {b:?}");
            }
        }
    }

    #[test]
    fn decimals_round_as_javascript_writes_them() {
        assert_eq!(fixed3(1.0625), "1.063");
        assert_eq!(fixed3(1.5), "1.500");
        assert_eq!(fixed3(2.0 / 3.0), "0.667");
        assert_eq!(fixed3(9.9996), "10.000");
        assert_eq!(fixed3(-0.5), "-0.500");
        assert_eq!(fixed3(0.9995), "1.000");
    }

    #[test]
    fn the_sort_asks_what_v8s_asks() {
        // The pairs Node's sort compared, for each input.
        for (input, asked) in [
            (&[1, 2, 3, 4, 5][..], "2:1 3:2 4:2 4:3 5:3 5:4"),
            (&[5, 4, 3, 2, 1], "4:5 3:5 3:4 2:4 2:3 1:4 1:3 1:2"),
            (&[7, 6, 5, 4, 3, 2, 1, 0], "6:7 5:6 4:5 3:4 2:3 1:2 0:1"),
            (
                &[2, 1, 0, 5, 3, 7, 6, 4],
                "1:2 0:1 5:0 5:1 5:2 3:2 3:5 7:2 7:5 6:3 6:7 6:5 4:3 4:6 4:5",
            ),
            (
                &[0, 1, 2, 5, 3, 7, 6, 4, 9, 8],
                "1:0 2:1 5:2 3:5 3:2 3:5 7:2 7:5 6:3 6:7 6:5 4:3 4:6 4:5 9:4 9:6 9:7 8:4 8:7 8:9",
            ),
        ] {
            let mut v = input.to_vec();
            let mut pairs = vec![];
            sort(&mut v, |a, b| {
                pairs.push(format!("{a}:{b}"));
                a as f64 - b as f64
            });
            assert!(v.is_sorted(), "{v:?}");
            assert_eq!(pairs.join(" "), asked);
        }
        assert_eq!(hash(""), 0);
    }
}
