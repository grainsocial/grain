use anyhow::Result;
use minijinja::{Environment, context};
use std::include_str;

fn create_template_env() -> Environment<'static> {
    let mut env = Environment::new();

    // Add adaptive layout template
    env.add_template(
        "adaptive_layout.html",
        include_str!("../templates/adaptive_layout.html"),
    )
    .unwrap();

    // Add collage layout template
    env.add_template(
        "collage_layout.html",
        include_str!("../templates/collage_layout.html"),
    )
    .unwrap();

    env
}

pub fn generate_grid_html_with_uri(
    gallery_uri: &str,
    title: String,
    handle: String,
    variant: &str,
) -> Result<String> {
    let env = create_template_env();
    println!(
        "Using template: {}",
        match variant {
            "collage" => "collage_layout.html",
            _ => "adaptive_layout.html",
        }
    );
    let template_name = match variant {
        "collage" => "collage_layout.html",
        _ => "adaptive_layout.html", // Default to adaptive
    };

    let template = env.get_template(template_name)?;

    let html = template.render(context! {
        gallery_uri => gallery_uri,
        title => title,
        handle => handle,
    })?;

    Ok(html)
}
