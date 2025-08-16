use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use dialoguer::{Confirm, Input};
use reqwest::{header::HeaderMap, Client, Method};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::process;
use indicatif::{ProgressBar, ProgressStyle};
use dirs;

mod photo_manip;
mod oauth_helpers;
mod device_auth;

use photo_manip::{do_resize, ResizeOptions};
use oauth_helpers::{get_user_info, refresh_access_token};
use device_auth::DeviceOAuthClient;

const API_BASE: &str = "http://localhost:8080";

fn get_aip_base_url() -> String {
    std::env::var("AIP_BASE_URL").unwrap_or_else(|_| "http://localhost:8081".to_string())
}

fn get_client_id() -> String {
    std::env::var("CLIENT_ID").unwrap_or_else(|_| "".to_string())
}

#[derive(Parser)]
#[command(name = "grain")]
#[command(about = "A CLI for grain.social")]
#[command(version)]
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
    refresh_token: Option<String>,
}

#[derive(Deserialize)]
struct GalleryItem {
    title: Option<String>,
    items: Option<Vec<Value>>,
    uri: String,
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

    let mut auth: AuthData = serde_json::from_str(&auth_text)
        .with_context(|| "Invalid auth file format")?;

    if auth.did.is_empty() || auth.token.is_empty() {
        exit_with_error("Please re-authenticate.", 1);
    }

    // Check if token is expired and refresh if possible
    if let Some(expires_at) = &auth.expires_at {
        if let Ok(expires) = chrono::DateTime::parse_from_rfc3339(expires_at) {
            // If token is expired or will expire in the next 5 minutes, try to refresh
            let buffer_time = chrono::Duration::minutes(5);
            if chrono::Utc::now() + buffer_time >= expires {
                if let Some(refresh_token) = &auth.refresh_token {
                    let client_id = get_client_id();
                    if client_id.is_empty() {
                        exit_with_error("Token expired and no client ID configured. Please set GRAIN_CLIENT_ID or re-authenticate.", 1);
                    }

                    println!("🔄 Access token expired, attempting to refresh...");

                    match refresh_access_token(&get_aip_base_url(), &client_id, refresh_token, true).await {
                        Ok(token_response) => {
                            // Update auth data with new tokens
                            auth.token = token_response.access_token;
                            auth.expires_at = token_response.expires_in.map(|exp| {
                                (chrono::Utc::now() + chrono::Duration::seconds(exp as i64))
                                    .to_rfc3339()
                            });
                            if let Some(new_refresh_token) = token_response.refresh_token {
                                auth.refresh_token = Some(new_refresh_token);
                            }

                            // Save updated auth data
                            let json = serde_json::to_string_pretty(&auth)?;
                            fs::write(&auth_file, json)?;

                            println!("✅ Token refreshed successfully!");
                        }
                        Err(e) => {
                            eprintln!("⚠️  Failed to refresh token: {}", e);
                            exit_with_error("Authentication expired and refresh failed. Please re-authenticate.", 1);
                        }
                    }
                } else {
                    exit_with_error("Authentication expired and no refresh token available. Please re-authenticate.", 1);
                }
            }
        }
    }

    Ok(auth)
}


async fn handle_login(_client: &Client, verbose: bool) -> Result<()> {
    // Use device code flow for authentication

    // Check if client ID is configured
    let client_id = get_client_id();
    if client_id.is_empty() {
        eprintln!("❌ No client ID configured!");
        eprintln!("Please set the CLIENT_ID environment variable or register a new client with:");
        eprintln!("  ./scripts/register-cli-client.sh");
        std::process::exit(1);
    }

    if verbose {
        println!("🔑 Using registered client ID: {}", client_id);
    }

    // Initialize device OAuth client
    let device_client = DeviceOAuthClient::new();

    // Start device authorization flow
    let scope = "atproto:atproto atproto:transition:generic";
    let token_response = device_client
        .authenticate_device_flow(Some(scope), verbose)
        .await?;

    // Get user info to obtain the actual DID
    let user_info = get_user_info(&get_aip_base_url(), &token_response.access_token, verbose).await?;

    // Save token with real DID
    let auth_data = AuthData {
        did: user_info.sub,
        token: token_response.access_token,
        expires_at: token_response.expires_in.map(|exp| {
            (chrono::Utc::now() + chrono::Duration::seconds(exp as i64))
                .to_rfc3339()
        }),
        refresh_token: token_response.refresh_token,
    };

    let auth_file = get_auth_file_path()?;
    let json = serde_json::to_string_pretty(&auth_data)?;
    fs::write(&auth_file, json)?;

    if verbose {
      println!("🔍 Auth data saved:");
      println!("{}", serde_json::to_string_pretty(&auth_data)?);
    }

    println!("✅ Login successful! You can now use other commands.");
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
