use minijinja::{Environment, context};
use std::include_str;
use anyhow::Result;

fn create_template_env() -> Environment<'static> {
    let mut env = Environment::new();

    // Add adaptive layout template
    env.add_template(
        "adaptive_layout.html",
        include_str!("../templates/adaptive_layout.html"),
    )
    .unwrap();

    env
}


pub fn generate_adaptive_grid_html_with_uri(gallery_uri: &str, title: String, handle: String) -> Result<String> {
    let env = create_template_env();
    let template = env.get_template("adaptive_layout.html")?;

    let html = template.render(context! {
        gallery_uri => gallery_uri,
        title => title,
        handle => handle,
    })?;

    Ok(html)
}

