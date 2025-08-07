use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use dialoguer::{Confirm, Input};
use reqwest::{header::HeaderMap, Client, Method};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::fs;
use std::path::Path;
use std::process;
use std::time::Duration;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{body::Incoming as IncomingBody, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use http_body_util::Full;
use tokio::net::TcpListener;
use indicatif::{ProgressBar, ProgressStyle};
use dirs;

mod photo_manip;
use photo_manip::{do_resize, ResizeOptions};

const API_BASE: &str = "http://localhost:8080";
const OAUTH_PORT: u16 = 8787;
const OAUTH_PATH: &str = "/callback";
const OAUTH_TIMEOUT: Duration = Duration::from_secs(300); // 5 minutes

#[derive(Parser)]
#[command(name = "grain")]
#[command(about = "A CLI for grain.social")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
    
    #[arg(short, long, global = true, help = "Enable verbose output")]
    verbose: bool,
}

#[derive(Subcommand)]
enum Commands {
    #[command(about = "Authenticate with grain.social")]
    Login,
    #[command(about = "Manage your galleries")]
    Gallery {
        #[command(subcommand)]
        action: GalleryAction,
    },
}

#[derive(Subcommand)]
enum GalleryAction {
    #[command(about = "List your galleries")]
    List,
    #[command(about = "Create a new gallery from a folder of images")]
    Create,
    #[command(about = "Delete a gallery")]
    Delete,
    #[command(about = "Open a gallery in the browser")]
    Show,
}

#[derive(Serialize, Deserialize)]
struct AuthData {
    did: String,
    token: String,
    #[serde(rename = "expiresAt")]
    expires_at: Option<String>,
}

#[derive(Deserialize)]
struct GalleryItem {
    title: Option<String>,
    items: Option<Vec<Value>>,
    uri: String,
}

#[derive(Debug, Deserialize)]
struct LoginResponse {
    url: Option<String>,
}

#[derive(Deserialize)]
struct GalleriesResponse {
    items: Option<Vec<GalleryItem>>,
}

#[derive(Debug, Deserialize)]
struct CreateGalleryResponse {
    #[serde(rename = "galleryUri")]
    gallery_uri: String,
}

#[derive(Deserialize)]
struct UploadPhotoResponse {
    #[serde(rename = "photoUri")]
    photo_uri: String,
}

fn exit_with_error(message: &str, code: i32) -> ! {
    eprintln!("{}", message);
    process::exit(code);
}

async fn make_request<T>(
    client: &Client,
    url: &str,
    method: Method,
    body: Option<Vec<u8>>,
    token: Option<&str>,
    content_type: Option<&str>,
) -> Result<T>
where
    T: for<'de> Deserialize<'de>,
{
    let mut headers = HeaderMap::new();
    headers.insert("Accept", "application/json".parse()?);

    if let Some(token) = token {
        headers.insert("Authorization", format!("Bearer {}", token).parse()?);
    }

    if let Some(ct) = content_type {
        headers.insert("Content-Type", ct.parse()?);
    }

    let mut request = client.request(method, url).headers(headers);

    if let Some(body) = body {
        request = request.body(body);
    }

    let response = request.send().await?;

    let status = response.status();
    if !status.is_success() {
        let text = response.text().await?;
        return Err(anyhow::anyhow!("HTTP {}: {}", status, text));
    }

    let content_type = response.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !content_type.contains("application/json") {
        return Err(anyhow::anyhow!("Expected JSON response"));
    }

    let data: T = response.json().await?;
    Ok(data)
}

fn get_auth_file_path() -> Result<std::path::PathBuf> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| anyhow::anyhow!("Unable to determine config directory"))?;
    let grain_config_dir = config_dir.join("grain");
    fs::create_dir_all(&grain_config_dir)?;
    Ok(grain_config_dir.join("auth.json"))
}

async fn load_auth() -> Result<AuthData> {
    let auth_file = get_auth_file_path()?;
    let auth_text = fs::read_to_string(&auth_file)
        .with_context(|| "Please run 'login' first")?;
    
    let auth: AuthData = serde_json::from_str(&auth_text)
        .with_context(|| "Invalid auth file format")?;

    if auth.did.is_empty() || auth.token.is_empty() {
        exit_with_error("Please re-authenticate.", 1);
    }

    if let Some(expires_at) = &auth.expires_at {
        if let Ok(expires) = chrono::DateTime::parse_from_rfc3339(expires_at) {
            if chrono::Utc::now() >= expires {
                exit_with_error("Authentication expired. Please re-authenticate.", 1);
            }
        }
    }

    Ok(auth)
}


async fn handle_login(client: &Client, verbose: bool) -> Result<()> {
    let handle: String = Input::new()
        .with_prompt("Enter your handle")
        .default("ansel.grain.social".to_string())
        .interact()?;

    let login_url = format!("{}/oauth/login?handle={}&client=cli", API_BASE, urlencoding::encode(&handle));

    let data: LoginResponse = make_request(
        client,
        &login_url,
        Method::POST,
        None,
        None,
        None,
    ).await?;

    if verbose {
        println!("Login response: {:?}", data);
    }

    if let Some(url) = data.url {
        let result = Arc::new(Mutex::new(None::<HashMap<String, String>>));
        let (tx, mut rx) = tokio::sync::oneshot::channel::<()>();
        let tx = Arc::new(Mutex::new(Some(tx)));
        
        if verbose {
            println!("Waiting for OAuth redirect on http://localhost:{}{}...", OAUTH_PORT, OAUTH_PATH);
        }
        
        // Open browser
        open::that(&url)?;
        if verbose {
            println!("Opened browser for: {}", url);
        }

        // Start OAuth server with timeout
        let listener = TcpListener::bind((std::net::Ipv4Addr::new(127, 0, 0, 1), OAUTH_PORT)).await?;
        
        let result_for_task = result.clone();
        let tx_for_task = tx.clone();
        
        let server_task = async move {
            if verbose {
                println!("OAuth server listening on port {}...", OAUTH_PORT);
            }
            
            match listener.accept().await {
                Ok((stream, addr)) => {
                    if verbose {
                        println!("Received connection from: {}", addr);
                    }
                    
                    let io = TokioIo::new(stream);
                    let result_clone = result_for_task.clone();
                    let tx_clone = tx_for_task.clone();
                    
                    let service = service_fn(move |req: Request<IncomingBody>| {
                        let result = result_clone.clone();
                        let tx = tx_clone.clone();
                        async move {
                            let uri = req.uri();
                            if verbose {
                                println!("Received request: {} {}", req.method(), uri);
                            }
                            
                            if uri.path() == OAUTH_PATH {
                                if verbose {
                                    println!("Matched OAuth callback path: {}", OAUTH_PATH);
                                }
                                
                                if let Some(query) = uri.query() {
                                    if verbose {
                                        println!("Query string: {}", query);
                                    }
                                    
                                    let params: HashMap<String, String> = url::form_urlencoded::parse(query.as_bytes())
                                        .into_owned()
                                        .collect();
                                    
                                    if verbose {
                                        println!("Parsed parameters: {:?}", params);
                                    }
                                    
                                    if let Ok(mut r) = result.lock() {
                                        *r = Some(params);
                                        if verbose {
                                            println!("Successfully stored OAuth parameters");
                                        }
                                        
                                        // Signal that we have the parameters
                                        if let Ok(mut tx_guard) = tx.lock() {
                                            if let Some(sender) = tx_guard.take() {
                                                let _ = sender.send(());
                                                if verbose {
                                                    println!("Sent completion signal");
                                                }
                                            }
                                        }
                                    } else if verbose {
                                        println!("Failed to lock result mutex");
                                    }
                                } else if verbose {
                                    println!("No query string found in OAuth callback");
                                }
                                
                                let html = r#"
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                  <meta charset="UTF-8" />
                                  <title>Authentication Complete</title>
                                  <style>
                                    body { font-family: sans-serif; text-align: center; margin-top: 10vh; }
                                    .box { display: inline-block; padding: 2em; border: 1px solid #ccc; border-radius: 8px; background: #fafafa; }
                                  </style>
                                </head>
                                <body>
                                  <div class="box">
                                    <h1>✅ Authentication Complete</h1>
                                    <p>You may now return to your terminal.</p>
                                    <p>You can close this tab.</p>
                                  </div>
                                </body>
                                </html>
                                "#;
                                
                                Ok::<_, anyhow::Error>(Response::builder()
                                    .status(StatusCode::OK)
                                    .header("content-type", "text/html; charset=utf-8")
                                    .body(Full::new(hyper::body::Bytes::from(html)))?)
                            } else {
                                if verbose {
                                    println!("Path '{}' does not match OAuth callback path '{}'", uri.path(), OAUTH_PATH);
                                }
                                
                                Ok(Response::builder()
                                    .status(StatusCode::NOT_FOUND)
                                    .body(Full::new(hyper::body::Bytes::from("Not found")))?)
                            }
                        }
                    });
                    
                    // Handle the connection with timeout
                    if verbose {
                        println!("Serving HTTP connection...");
                    }
                    
                    let connection = http1::Builder::new()
                        .serve_connection(io, service);
                    
                    match tokio::time::timeout(Duration::from_secs(10), connection).await {
                        Ok(Ok(_)) => {
                            if verbose {
                                println!("Connection served successfully");
                            }
                        }
                        Ok(Err(e)) => {
                            if verbose {
                                println!("Connection error: {}", e);
                            }
                        }
                        Err(_) => {
                            if verbose {
                                println!("Connection handling timed out");
                            }
                        }
                    }
                }
                Err(e) => {
                    if verbose {
                        println!("Failed to accept connection: {}", e);
                    }
                }
            }
            
            if verbose {
                println!("Server task ending");
            }
        };

        // Start the server task in the background
        tokio::spawn(server_task);
        
        // Wait for either the OAuth callback or timeout
        tokio::select! {
            _ = &mut rx => {
                if verbose {
                    println!("OAuth callback received, proceeding...");
                }
            },
            _ = tokio::time::sleep(OAUTH_TIMEOUT) => {
                eprintln!("Timed out waiting for OAuth redirect.");
            }
        }
        
        let params_result = {
            let guard = result.lock();
            match guard {
                Ok(p) => p.clone(),
                Err(_) => None,
            }
        };
        
        if let Some(params) = params_result {
            if verbose {
                println!("Received redirect with params: {:?}", params);
            }
            save_auth_params(&params).await?;
            println!("Login successful! You can now use other commands.");
        } else {
            eprintln!("No redirect received.");
        }
    }

    Ok(())
}

async fn save_auth_params(params: &HashMap<String, String>) -> Result<()> {
    let auth_file = get_auth_file_path()?;
    let json = serde_json::to_string_pretty(params)?;
    fs::write(&auth_file, json)?;
    println!("Saved config data to {}", auth_file.display());
    Ok(())
}

async fn fetch_galleries(client: &Client) -> Result<Vec<GalleryItem>> {
    let auth = load_auth().await?;
    let galleries_url = format!(
        "{}/xrpc/social.grain.gallery.getActorGalleries?actor={}",
        API_BASE,
        urlencoding::encode(&auth.did)
    );

    let data: GalleriesResponse = make_request(
        client,
        &galleries_url,
        Method::GET,
        None,
        Some(&auth.token),
        None,
    ).await?;

    Ok(data.items.unwrap_or_default())
}

async fn handle_galleries_list(client: &Client) -> Result<()> {
    let items = fetch_galleries(client).await?;
    
    if items.is_empty() {
        println!("No galleries found.");
    } else {
        for item in items {
            let count = item.items.as_ref().map(|i| i.len()).unwrap_or(0);
            let title = item.title.as_deref().unwrap_or("Untitled");
            println!("{} ({})", title, count);
        }
    }

    Ok(())
}

async fn delete_gallery(client: &Client, gallery_uri: &str) -> Result<()> {
    let auth = load_auth().await?;
    let delete_url = format!("{}/xrpc/social.grain.gallery.deleteGallery", API_BASE);
    
    let payload = serde_json::json!({
        "uri": gallery_uri
    });

    let _response: Value = make_request(
        client,
        &delete_url,
        Method::POST,
        Some(payload.to_string().into_bytes()),
        Some(&auth.token),
        Some("application/json"),
    ).await?;

    Ok(())
}

async fn handle_gallery_delete(client: &Client) -> Result<()> {
    let galleries = fetch_galleries(client).await?;
    
    if galleries.is_empty() {
        println!("No galleries found to delete.");
        return Ok(());
    }

    // Create selection options for dialoguer
    let gallery_options: Vec<String> = galleries
        .iter()
        .map(|item| {
            let count = item.items.as_ref().map(|i| i.len()).unwrap_or(0);
            let title = item.title.as_deref().unwrap_or("Untitled");
            format!("{} ({} items)", title, count)
        })
        .collect();

    let selection = dialoguer::Select::new()
        .with_prompt("Select a gallery to delete")
        .items(&gallery_options)
        .default(0)
        .interact()?;

    let selected_gallery = &galleries[selection];
    let title = selected_gallery.title.as_deref().unwrap_or("Untitled");
    
    let confirm = dialoguer::Confirm::new()
        .with_prompt(format!("Are you sure you want to delete gallery '{}'? This action cannot be undone.", title))
        .default(false)
        .interact()?;

    if confirm {
        delete_gallery(client, &selected_gallery.uri).await?;
        println!("Gallery '{}' deleted successfully.", title);
    } else {
        println!("Gallery deletion cancelled.");
    }

    Ok(())
}

async fn handle_gallery_show(client: &Client) -> Result<()> {
    let galleries = fetch_galleries(client).await?;
    
    if galleries.is_empty() {
        println!("No galleries found to show.");
        return Ok(());
    }

    // Create selection options for dialoguer
    let gallery_options: Vec<String> = galleries
        .iter()
        .map(|item| {
            let count = item.items.as_ref().map(|i| i.len()).unwrap_or(0);
            let title = item.title.as_deref().unwrap_or("Untitled");
            format!("{} ({} items)", title, count)
        })
        .collect();

    let selection = dialoguer::Select::new()
        .with_prompt("Select a gallery to open")
        .items(&gallery_options)
        .default(0)
        .interact()?;

    let selected_gallery = &galleries[selection];
    let web_url = selected_gallery.uri.strip_prefix("at://").unwrap_or(&selected_gallery.uri);
    let formatted_url = format!("https://grain.social/{}", web_url);
    
    println!("Opening gallery in browser: {}", formatted_url);
    open::that(&formatted_url)?;

    Ok(())
}

async fn create_gallery(client: &Client, title: &str, description: &str) -> Result<String> {
    let auth = load_auth().await?;
    let create_url = format!("{}/xrpc/social.grain.gallery.createGallery", API_BASE);
    
    let payload = serde_json::json!({
        "title": title,
        "description": description
    });

    let response: CreateGalleryResponse = make_request(
        client,
        &create_url,
        Method::POST,
        Some(payload.to_string().into_bytes()),
        Some(&auth.token),
        Some("application/json"),
    ).await?;

    Ok(response.gallery_uri)
}

async fn upload_photo(client: &Client, image_buffer: &[u8]) -> Result<String> {
    let auth = load_auth().await?;
    let upload_url = format!("{}/xrpc/social.grain.photo.uploadPhoto", API_BASE);

    let response: UploadPhotoResponse = make_request(
        client,
        &upload_url,
        Method::POST,
        Some(image_buffer.to_vec()),
        Some(&auth.token),
        Some("image/jpeg"),
    ).await?;

    println!("Photo uploaded successfully: {}", response.photo_uri);
    Ok(response.photo_uri)
}

async fn create_gallery_item(
    client: &Client,
    gallery_uri: &str,
    photo_uri: &str,
    position: u32,
) -> Result<()> {
    let auth = load_auth().await?;
    let create_url = format!("{}/xrpc/social.grain.gallery.createItem", API_BASE);
    
    let payload = serde_json::json!({
        "galleryUri": gallery_uri,
        "photoUri": photo_uri,
        "position": position
    });

    let _response: Value = make_request(
        client,
        &create_url,
        Method::POST,
        Some(payload.to_string().into_bytes()),
        Some(&auth.token),
        Some("application/json"),
    ).await?;

    Ok(())
}

async fn handle_gallery_create(client: &Client, verbose: bool) -> Result<()> {
    let title: String = Input::new()
        .with_prompt("Gallery title")
        .interact()?;

    let description: String = Input::new()
        .with_prompt("Gallery description (optional)")
        .allow_empty(true)
        .interact()?;

    let folder_path: String = Input::new()
        .with_prompt("Path to folder of image files to upload")
        .validate_with(|input: &String| -> Result<(), &str> {
            let path = Path::new(input);
            if !path.exists() {
                return Err("Directory does not exist");
            }
            if !path.is_dir() {
                return Err("Path is not a directory");
            }
            Ok(())
        })
        .interact()?;

    // List image files in the folder
    let image_extensions = [".jpg", ".jpeg"];
    let mut image_files = Vec::new();
    
    let entries = fs::read_dir(&folder_path)?;
    for entry in entries {
        let entry = entry?;
        if entry.file_type()?.is_file() {
            let file_name = entry.file_name();
            let file_name_str = file_name.to_string_lossy().to_lowercase();
            if image_extensions.iter().any(|ext| file_name_str.ends_with(ext)) {
                image_files.push(entry.file_name().to_string_lossy().to_string());
            }
        }
    }

    if image_files.is_empty() {
        exit_with_error("No image files found in the selected folder.", 1);
    }

    println!("Found {} image files in '{}':", image_files.len(), folder_path);
    for file in &image_files {
        println!("  - {}", file);
    }

    let confirm = Confirm::new()
        .with_prompt(format!("Are you sure you want to upload these {} images?", image_files.len()))
        .default(true)
        .interact()?;

    if !confirm {
        println!("Aborted by user.");
        return Ok(());
    }

    let gallery_uri = create_gallery(client, &title, &description).await?;

    let pb = ProgressBar::new(image_files.len() as u64);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} {msg}")
            .unwrap()
            .progress_chars("#>-")
    );

    let mut position = 0;

    for file_name in image_files {
        pb.set_message(format!("Processing {}", file_name));
        
        let file_path = format!("{}/{}", folder_path, file_name);
        let file_data = fs::read(&file_path)?;
        
        let resized = do_resize(&file_data, ResizeOptions {
            width: 2000,
            height: 2000,
            max_size: 1000 * 1000, // 1MB
            mode: "inside".to_string(),
            verbose,
        })?;

        let photo_uri = upload_photo(client, &resized.buffer).await?;
        
        create_gallery_item(client, &gallery_uri, &photo_uri, position).await?;
        position += 1;
        pb.inc(1);
    }

    pb.finish_with_message("All images uploaded successfully!");

    let web_url = gallery_uri.strip_prefix("at://").unwrap_or(&gallery_uri);
    let formatted_url = format!("https://grain.social/{}", web_url);
    println!("Here's a link to the gallery: {}", formatted_url);

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let client = Client::new();

    match cli.command {
        None => {
            println!(r#"
██████╗ ██████╗  █████╗ ██╗███╗   ██╗
██╔════╝ ██╔══██╗██╔══██╗██║████╗  ██║
██║  ███╗██████╔╝███████║██║██╔██╗ ██║
██║   ██║██╔══██╗██╔══██║██║██║╚██╗██║
╚██████╔╝██║  ██║██║  ██║██║██║ ╚████║
 ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝

https://grain.social CLI

Use --help to see available commands.
"#);
        }
        Some(Commands::Login) => {
            if let Err(e) = handle_login(&client, cli.verbose).await {
                eprintln!("Login failed: {}", e);
            }
        }
        Some(Commands::Gallery { action }) => {
            match action {
                GalleryAction::List => {
                    if let Err(e) = handle_galleries_list(&client).await {
                        exit_with_error(&format!("Failed to fetch galleries: {}", e), 1);
                    }
                }
                GalleryAction::Create => {
                    if let Err(e) = handle_gallery_create(&client, cli.verbose).await {
                        exit_with_error(&format!("Failed to create gallery: {}", e), 1);
                    }
                }
                GalleryAction::Delete => {
                    if let Err(e) = handle_gallery_delete(&client).await {
                        exit_with_error(&format!("Failed to delete gallery: {}", e), 1);
                    }
                }
                GalleryAction::Show => {
                    if let Err(e) = handle_gallery_show(&client).await {
                        exit_with_error(&format!("Failed to show gallery: {}", e), 1);
                    }
                }
            }
        }
    }

    Ok(())
}