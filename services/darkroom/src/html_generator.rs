use crate::types::{CompositeOptions, GridDimensions};

pub fn calculate_grid_dimensions(
    thumb_count: usize,
    width: i32,
    padding: i32,
    gap: i32,
) -> GridDimensions {
    let (cols, rows) = if thumb_count <= 4 {
        (2, 2)
    } else {
        (3, 3)
    };

    let cell_width = (width - (2 * padding) - (gap * (cols - 1))) / cols;
    let cell_height = (cell_width * 4) / 3;

    GridDimensions {
        cols,
        rows,
        cell_width,
        cell_height,
    }
}

pub fn generate_grid_html(options: CompositeOptions) -> String {
    let CompositeOptions {
        thumbs,
        title,
        handle,
        width,
        padding,
        gap,
    } = options;

    let dims = calculate_grid_dimensions(thumbs.len(), width, padding, gap);
    let text_space = if !title.is_empty() || !handle.is_empty() { 200 } else { 0 };
    let height = (2 * padding) + (dims.rows * dims.cell_height) + ((dims.rows - 1) * gap) + text_space;

    let grid_style = format!(
        "display: grid; grid-template-columns: repeat({}, {}px); grid-template-rows: repeat({}, {}px); gap: {}px; width: {}px; height: {}px; margin: {}px auto 0 auto; background: #fff;",
        dims.cols,
        dims.cell_width,
        dims.rows,
        dims.cell_height,
        gap,
        width - 2 * padding,
        dims.rows * dims.cell_height + (dims.rows - 1) * gap,
        padding
    );

    let grid_cells: String = thumbs
        .iter()
        .map(|url| format!(r#"<div class="cell"><img src="{}" /></div>"#, url))
        .collect::<Vec<_>>()
        .join("");

    let footer = if !title.is_empty() || !handle.is_empty() {
        let handle_section = if !handle.is_empty() {
            format!(r#"<div class="handle">@{}</div>"#, handle)
        } else {
            String::new()
        };

        format!(
            r#"
    <div class="footer">
      <span class="title">{}</span>
      <div style="text-align: right;">
        {}
        <div class="grain">grain.social</div>
      </div>
    </div>
  "#,
            title, handle_section
        )
    } else {
        String::new()
    };

    format!(
        r#"<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Composite Preview</title>
      <style>
        body {{ background: #fff; margin: 0; padding: 0; width: {}px; height: {}px; font-family: 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif; }}
        .grid {{ {} }}
        .cell img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
        .footer {{ width: {}px; height: {}px; position: absolute; left: 0; top: {}px; display: flex; align-items: center; justify-content: space-between; padding: 40px 32px; box-sizing: border-box; }}
        .title {{ font-size: 72px; font-weight: 400; color: #212529; line-height: 1.1; }}
        .handle {{ font-size: 38px; font-weight: bold; color: #212529; line-height: 1.1; }}
        .grain {{ font-size: 32px; font-weight: bold; color: #6c757d; line-height: 1.1; margin-top: 8px; }}
      </style>
    </head>
    <body>
      <div class="grid">
        {}
      </div>
      {}
    </body>
    </html>"#,
        width,
        height,
        grid_style,
        width,
        text_space,
        height - text_space,
        grid_cells,
        footer
    )
}
