use crate::types::{CompositeOptions, GalleryItem};
use minijinja::{Environment, context};
use std::include_str;

fn is_portrait(item: &GalleryItem) -> bool {
    item.aspect_ratio.height > item.aspect_ratio.width
}

fn create_template_env() -> Environment<'static> {
    let mut env = Environment::new();

    // Add templates as strings (embedded at compile time)
    env.add_template(
        "single_image.html",
        include_str!("../templates/single_image.html"),
    )
    .unwrap();
    env.add_template(
        "multi_image.html",
        include_str!("../templates/multi_image.html"),
    )
    .unwrap();

    env
}

pub fn generate_grid_html(options: CompositeOptions) -> String {
    let CompositeOptions {
        items,
        title,
        handle,
    } = options;

    let env = create_template_env();

    match items.len() {
        1 => {
            let is_portrait = is_portrait(&items[0]);
            let template = env.get_template("single_image.html").unwrap();
            template
                .render(context! {
                    item => &items[0],
                    title => title,
                    handle => handle,
                    is_portrait => is_portrait
                })
                .unwrap()
        }
        2..=9 => {
            let template = env.get_template("multi_image.html").unwrap();
            template
                .render(context! {
                    items => &items,
                    title => title,
                    handle => handle
                })
                .unwrap()
        }
        _ => {
            // Fallback for more than 9 images - use first 9
            let template = env.get_template("multi_image.html").unwrap();
            template
                .render(context! {
                    items => &items[..9],
                    title => title,
                    handle => handle
                })
                .unwrap()
        }
    }
}
