use anyhow::Result;
use image::codecs::jpeg::JpegEncoder;
use image::ExtendedColorType;
use std::io::Cursor;
use std::time::Instant;

pub struct ResizeOptions {
    pub width: u32,
    pub height: u32,
    pub max_size: usize, // in bytes
    pub mode: String,
    pub verbose: bool,
}

pub struct ResizeResult {
    pub buffer: Vec<u8>,
}

pub fn do_resize(input: &[u8], opts: ResizeOptions) -> Result<ResizeResult> {
    let start_time = Instant::now();
    if opts.verbose {
        eprintln!("Starting image resize - input size: {} bytes, target: {}x{}, max_size: {} bytes", 
                  input.len(), opts.width, opts.height, opts.max_size);
    }
    
    let img_load_start = Instant::now();
    let img = image::load_from_memory(input)?;
    if opts.verbose {
        eprintln!("Image loaded in {:?} - dimensions: {}x{}", img_load_start.elapsed(), img.width(), img.height());
    }
    
    let resize_start = Instant::now();
    let resized = match opts.mode.as_str() {
        "inside" => img.resize(opts.width, opts.height, image::imageops::FilterType::Triangle),
        "cover" => img.resize_to_fill(opts.width, opts.height, image::imageops::FilterType::Triangle),
        _ => img.resize(opts.width, opts.height, image::imageops::FilterType::Triangle),
    };
    if opts.verbose {
        eprintln!("Image resized in {:?} - new dimensions: {}x{}", resize_start.elapsed(), resized.width(), resized.height());
    }

    // Binary search for the best quality that fits under max_size
    let mut best_result: Option<ResizeResult> = None;
    let mut min_quality = 1u8;
    let mut max_quality = 100u8;
    let mut iteration = 0;
    
    let search_start = Instant::now();
    if opts.verbose {
        eprintln!("Starting binary search for optimal quality");
    }

    while max_quality > min_quality + 1 {
        iteration += 1;
        let quality = (min_quality + max_quality) / 2;
        let encode_start = Instant::now();
        
        let mut buffer = Vec::new();
        {
            let mut cursor = Cursor::new(&mut buffer);
            let mut encoder = JpegEncoder::new_with_quality(&mut cursor, quality);
            encoder.encode(
                resized.as_bytes(),
                resized.width(),
                resized.height(),
                ExtendedColorType::Rgb8,
            )?;
        }
        
        let size = buffer.len();
        if opts.verbose {
            eprintln!("Iteration {}: quality={}, size={} bytes, encoded in {:?}", 
                      iteration, quality, size, encode_start.elapsed());
        }
        
        if size <= opts.max_size {
            min_quality = quality;
            best_result = Some(ResizeResult {
                buffer,
            });
            if opts.verbose {
                eprintln!("  -> Fits! New min_quality: {}", min_quality);
            }
        } else {
            max_quality = quality;
            if opts.verbose {
                eprintln!("  -> Too large! New max_quality: {}", max_quality);
            }
        }
    }
    
    if opts.verbose {
        eprintln!("Binary search completed in {:?} after {} iterations", search_start.elapsed(), iteration);
    }

    // Try with minimum quality if no result yet
    if best_result.is_none() {
        if opts.verbose {
            eprintln!("No result found, trying minimum quality: {}", min_quality);
        }
        let final_encode_start = Instant::now();
        
        let mut buffer = Vec::new();
        {
            let mut cursor = Cursor::new(&mut buffer);
            let mut encoder = JpegEncoder::new_with_quality(&mut cursor, min_quality);
            encoder.encode(
                resized.as_bytes(),
                resized.width(),
                resized.height(),
                ExtendedColorType::Rgb8,
            )?;
        }
        
        if opts.verbose {
            eprintln!("Final encode with quality {} completed in {:?}, size: {} bytes", 
                      min_quality, final_encode_start.elapsed(), buffer.len());
        }
        
        best_result = Some(ResizeResult {
            buffer,
        });
    }
    
    if opts.verbose {
        eprintln!("Total resize operation completed in {:?}", start_time.elapsed());
    }
    best_result.ok_or_else(|| anyhow::anyhow!("Failed to compress image"))
}