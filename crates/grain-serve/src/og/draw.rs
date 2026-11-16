//! A card drawn: an SVG written here and rasterized in process, with the
//! fonts compiled in, Inter for text, Syne for grain's name, and for what
//! Inter lacks, Noto Sans JP and then Noto Emoji. The images it shows are
//! named in the SVG by key and handed to the renderer beside it, never
//! read from a file or the network by it.

use resvg::{tiny_skia, usvg};
use skrifa::MetadataProvider;
use std::collections::HashMap;
use std::fmt::Write;
use std::sync::{Arc, LazyLock};

pub const WIDTH: u32 = 1200;
pub const HEIGHT: u32 = 630;

static INTER: &[u8] = include_bytes!("../../fonts/Inter-Regular.ttf");
static SYNE: &[u8] = include_bytes!("../../fonts/Syne-ExtraBold.ttf");
static JP: &[u8] = include_bytes!("../../fonts/NotoSansJP-Regular.ttf");
static EMOJI: &[u8] = include_bytes!("../../fonts/NotoEmoji-Regular.ttf");

/// Read where they are compiled in, not copied.
static FONTS: LazyLock<Arc<usvg::fontdb::Database>> = LazyLock::new(|| {
    let mut db = usvg::fontdb::Database::new();
    for data in [INTER, SYNE, JP, EMOJI] {
        db.load_font_source(usvg::fontdb::Source::Binary(Arc::new(data)));
    }
    Arc::new(db)
});

/// A font compiled in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Font {
    Inter,
    Syne,
    Jp,
    Emoji,
}

impl Font {
    fn data(self) -> &'static [u8] {
        match self {
            Font::Inter => INTER,
            Font::Syne => SYNE,
            Font::Jp => JP,
            Font::Emoji => EMOJI,
        }
    }

    fn face(self) -> skrifa::FontRef<'static> {
        skrifa::FontRef::new(self.data()).expect("the fonts compiled in parse")
    }

    /// The SVG attributes that pick it.
    fn attrs(self) -> &'static str {
        match self {
            Font::Inter => r#"font-family="Inter""#,
            Font::Syne => r#"font-family="Syne" font-weight="800""#,
            Font::Jp => r#"font-family="Noto Sans JP""#,
            Font::Emoji => r#"font-family="Noto Emoji""#,
        }
    }

    fn has(self, c: char) -> bool {
        self.face().charmap().map(c).is_some()
    }

    /// Its ascent and its height of a line, at `size`.
    fn line(self, size: f32) -> (f32, f32) {
        let m = self.face().metrics(
            skrifa::instance::Size::new(size),
            skrifa::instance::LocationRef::default(),
        );
        (m.ascent, m.ascent - m.descent)
    }

    /// How wide `text` is set at `size`, kerning left out.
    fn measure(self, text: &str, size: f32) -> f32 {
        let face = self.face();
        let metrics = face.glyph_metrics(
            skrifa::instance::Size::new(size),
            skrifa::instance::LocationRef::default(),
        );
        let map = face.charmap();
        text.chars()
            .map(|c| metrics.advance_width(map.map(c).unwrap_or_default()))
            .map(Option::unwrap_or_default)
            .sum()
    }
}

/// The font a character is drawn in, wanting `font`: the first of it and
/// the fallbacks that has it, or `font`'s missing glyph if none does.
fn font_for(font: Font, c: char) -> Font {
    [font, Font::Jp, Font::Emoji]
        .into_iter()
        .find(|f| f.has(c))
        .unwrap_or(font)
}

/// Whether `c` draws as part of the character before it: a joiner, a
/// variation selector, a skin tone, a keycap, or what a joiner joins.
fn joins(prev: Option<char>, c: char) -> bool {
    prev.is_some_and(|prev| {
        matches!(c, '\u{200D}' | '\u{FE00}'..='\u{FE0F}' | '\u{20E3}' | '\u{1F3FB}'..='\u{1F3FF}')
            || prev == '\u{200D}'
    })
}

/// `text` in runs of one font each, wanting `font`, a sequence that draws
/// as one kept in the font of its first character.
fn runs(text: &str, font: Font) -> Vec<(Font, String)> {
    let mut runs: Vec<(Font, String)> = Vec::new();
    let mut prev = None;
    for c in text.chars() {
        let joined = joins(prev, c);
        prev = Some(c);
        let f = match (joined, runs.last()) {
            (true, Some((f, _))) => *f,
            _ => font_for(font, c),
        };
        match runs.last_mut() {
            Some((was, run)) if *was == f => run.push(c),
            _ => runs.push((f, c.to_string())),
        }
    }
    runs
}

/// How wide `text` is set at `size`, wanting `font`.
pub fn measure(text: &str, font: Font, size: f32) -> f32 {
    runs(text, font)
        .iter()
        .map(|(f, run)| f.measure(run, size))
        .sum()
}

/// `text` cut to fit `width` at `size`, ending in an ellipsis where it
/// had to be, as a line that does not wrap overflows.
pub fn fit(text: &str, font: Font, size: f32, width: f32) -> String {
    if measure(text, font, size) <= width {
        return text.to_string();
    }
    let mut kept: Vec<char> = text.chars().collect();
    while !kept.is_empty() {
        kept.pop();
        let cut: String = kept.iter().collect::<String>().trim_end().to_string() + "…";
        if measure(&cut, font, size) <= width {
            return cut;
        }
    }
    "…".into()
}

pub fn esc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            c => out.push(c),
        }
    }
    out
}

/// How text is set: its font, size and color, and where it is anchored.
#[derive(Debug, Clone, Copy)]
pub struct Style {
    pub font: Font,
    pub size: f32,
    pub fill: &'static str,
    /// Space added after each character, in pixels.
    pub spacing: f32,
}

impl Style {
    pub const fn new(font: Font, size: f32, fill: &'static str) -> Style {
        Style {
            font,
            size,
            fill,
            spacing: 0.0,
        }
    }

    /// The ascent and line height of a line set so.
    pub fn line(&self) -> (f32, f32) {
        self.font.line(self.size)
    }

    pub fn measure(&self, text: &str) -> f32 {
        measure(text, self.font, self.size) + self.spacing * text.chars().count() as f32
    }
}

/// An SVG being written, and the images it names, by key.
pub struct Svg {
    out: String,
    pub images: HashMap<String, Arc<Vec<u8>>>,
    clips: usize,
}

impl Svg {
    /// A card `fill`ed with one color.
    pub fn new(fill: &str) -> Svg {
        let out = format!(
            r#"<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}"><rect width="{WIDTH}" height="{HEIGHT}" fill="{fill}"/>"#
        );
        Svg {
            out,
            images: HashMap::new(),
            clips: 0,
        }
    }

    pub fn raw(&mut self, svg: &str) {
        self.out.push_str(svg);
    }

    /// `bytes`, an image, in the box at `x`, `y`, `w` by `h`: covering it,
    /// cut to it, with `slice`, or whole within it otherwise.
    pub fn image(&mut self, bytes: Arc<Vec<u8>>, (x, y, w, h): (f32, f32, f32, f32), slice: bool) {
        let key = format!("image:{}", self.images.len());
        let fit = if slice { "slice" } else { "meet" };
        write!(
            self.out,
            r#"<image href="{key}" x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid {fit}"/>"#
        )
        .unwrap();
        self.images.insert(key, bytes);
    }

    /// `bytes`, an image, covering the circle of radius `r` about `cx`, `cy`.
    pub fn round(&mut self, bytes: Arc<Vec<u8>>, (cx, cy, r): (f32, f32, f32)) {
        let id = format!("clip{}", self.clips);
        self.clips += 1;
        write!(
            self.out,
            r#"<clipPath id="{id}"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath><g clip-path="url(#{id})">"#
        )
        .unwrap();
        self.image(bytes, (cx - r, cy - r, r * 2.0, r * 2.0), true);
        self.out.push_str("</g>");
    }

    /// `text` in `style`, its baseline on `y`, anchored on `x`: starting
    /// there for an `anchor` of 0, centered for 0.5, ending there for 1.
    /// Each run of a font is placed on its own, so it is shaped in that
    /// font alone.
    pub fn text(&mut self, text: &str, style: Style, (x, y): (f32, f32), anchor: f32) {
        let mut x = x - style.measure(text) * anchor;
        let spacing = if style.spacing == 0.0 {
            String::new()
        } else {
            format!(r#" letter-spacing="{}""#, style.spacing)
        };
        write!(
            self.out,
            r#"<text y="{y}" font-size="{}" fill="{}"{spacing}>"#,
            style.size, style.fill
        )
        .unwrap();
        for (font, run) in runs(text, style.font) {
            write!(
                self.out,
                r#"<tspan x="{x}" {}>{}</tspan>"#,
                font.attrs(),
                esc(&run)
            )
            .unwrap();
            x += measure(&run, font, style.size) + style.spacing * run.chars().count() as f32;
        }
        self.out.push_str("</text>");
    }

    /// The SVG, closed.
    pub fn finish(mut self) -> (String, HashMap<String, Arc<Vec<u8>>>) {
        self.out.push_str("</svg>");
        (self.out, self.images)
    }
}

fn kind(bytes: Arc<Vec<u8>>) -> Option<usvg::ImageKind> {
    match bytes.as_slice() {
        [0x89, b'P', b'N', b'G', ..] => Some(usvg::ImageKind::PNG(bytes)),
        [0xFF, 0xD8, 0xFF, ..] => Some(usvg::ImageKind::JPEG(bytes)),
        [b'G', b'I', b'F', b'8', ..] => Some(usvg::ImageKind::GIF(bytes)),
        [
            b'R',
            b'I',
            b'F',
            b'F',
            _,
            _,
            _,
            _,
            b'W',
            b'E',
            b'B',
            b'P',
            ..,
        ] => Some(usvg::ImageKind::WEBP(bytes)),
        _ => None,
    }
}

/// `svg` drawn as a PNG, each image it names by key from `images`; one it
/// is not given, or cannot read, left out.
pub fn render(svg: &str, images: HashMap<String, Arc<Vec<u8>>>) -> Vec<u8> {
    let resolve = move |href: &str, _: &usvg::Options| images.get(href).cloned().and_then(kind);
    let options = usvg::Options {
        font_family: "Inter".into(),
        fontdb: FONTS.clone(),
        image_href_resolver: usvg::ImageHrefResolver {
            resolve_data: Box::new(|_, _, _| None),
            resolve_string: Box::new(resolve),
        },
        ..Default::default()
    };
    let tree = usvg::Tree::from_str(svg, &options).expect("a card's SVG parses");
    let mut pixmap = tiny_skia::Pixmap::new(WIDTH, HEIGHT).expect("a card has a size");
    resvg::render(&tree, tiny_skia::Transform::default(), &mut pixmap.as_mut());
    // Opaque, so its premultiplied colors are its colors.
    let rgb: Vec<u8> = pixmap
        .data()
        .as_chunks::<4>()
        .0
        .iter()
        .flat_map(|p| [p[0], p[1], p[2]])
        .collect();
    let mut out = Vec::with_capacity(rgb.len() / 4);
    let mut encoder = png::Encoder::new(&mut out, WIDTH, HEIGHT);
    encoder.set_color(png::ColorType::Rgb);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header().expect("writing to memory");
    writer.write_image_data(&rgb).expect("writing to memory");
    writer.finish().expect("writing to memory");
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_falls_back_for_what_inter_lacks() {
        assert_eq!(runs("chad", Font::Inter), [(Font::Inter, "chad".into())]);
        assert_eq!(
            runs("Ron 😅", Font::Inter),
            [(Font::Inter, "Ron ".into()), (Font::Emoji, "😅".into())]
        );
        assert_eq!(
            runs("東京 trip", Font::Inter),
            [(Font::Jp, "東京".into()), (Font::Inter, " trip".into())]
        );
        // A joined sequence stays in the font of its first character.
        let family = "👩\u{200D}👧";
        assert_eq!(runs(family, Font::Inter), [(Font::Emoji, family.into())]);
        // What no font has is Inter's missing glyph.
        assert_eq!(font_for(Font::Inter, '\u{10FFFD}'), Font::Inter);
    }

    #[test]
    fn a_line_too_long_ends_in_an_ellipsis() {
        assert_eq!(fit("bodega", Font::Inter, 36.0, 1000.0), "bodega");
        let cut = fit(
            "a gallery with a very long title indeed",
            Font::Inter,
            36.0,
            300.0,
        );
        assert!(cut.ends_with('…') && measure(&cut, Font::Inter, 36.0) <= 300.0);
        assert!(!cut.contains(" …"), "{cut}");
        assert_eq!(fit("wide", Font::Inter, 36.0, 1.0), "…");
        assert_eq!(
            esc(r#"<a href="x">'&'</a>"#),
            "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;"
        );
    }

    #[test]
    fn each_font_draws_its_run() {
        let mut svg = Svg::new("#ffffff");
        let style = Style {
            spacing: -1.0,
            ..Style::new(Font::Syne, 32.0, "#000000")
        };
        svg.text("grain", style, (10.0, 40.0), 0.0);
        let style = Style::new(Font::Inter, 32.0, "#000000");
        svg.text("東京 😅", style, (10.0, 100.0), 0.0);
        let (svg, images) = svg.finish();
        for family in ["Syne", "Noto Sans JP", "Noto Emoji", "Inter"] {
            assert!(svg.contains(&format!(r#"font-family="{family}""#)), "{svg}");
        }
        let png = render(&svg, images);
        assert!(png.starts_with(b"\x89PNG"));
    }

    #[test]
    fn images_are_read_by_their_bytes() {
        let kind = |b: &[u8]| kind(Arc::new(b.to_vec()));
        assert!(matches!(
            kind(b"\x89PNG...."),
            Some(usvg::ImageKind::PNG(_))
        ));
        assert!(matches!(
            kind(&[0xFF, 0xD8, 0xFF, 0]),
            Some(usvg::ImageKind::JPEG(_))
        ));
        assert!(matches!(kind(b"GIF89a"), Some(usvg::ImageKind::GIF(_))));
        assert!(matches!(
            kind(b"RIFF\0\0\0\0WEBPVP8 "),
            Some(usvg::ImageKind::WEBP(_))
        ));
        assert!(kind(b"<html>").is_none());
    }
}
