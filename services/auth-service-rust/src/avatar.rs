use std::io::Cursor;

use image::{imageops::FilterType, DynamicImage, GenericImageView, ImageFormat};
use tonic::Status;

const MAX_AVATAR_SIDE: u32 = 512;
const SUPPORTED_AVATAR_FORMATS: &str = "PNG, JPEG, GIF, BMP, or WebP";

pub fn normalize_avatar(image_data: &[u8]) -> Result<Vec<u8>, Status> {
    if image_data.is_empty() {
        return Err(Status::invalid_argument("avatar image data is empty"));
    }

    let image = image::load_from_memory(image_data).map_err(|_| {
        Status::invalid_argument(format!(
            "avatar image format is not supported; use {SUPPORTED_AVATAR_FORMATS}"
        ))
    })?;

    let resized = resize_if_needed(image);
    encode_png(resized)
}

fn resize_if_needed(image: DynamicImage) -> DynamicImage {
    let (width, height) = image.dimensions();
    if width.max(height) <= MAX_AVATAR_SIDE {
        return image;
    }

    image.resize(MAX_AVATAR_SIDE, MAX_AVATAR_SIDE, FilterType::Lanczos3)
}

fn encode_png(image: DynamicImage) -> Result<Vec<u8>, Status> {
    let mut buffer = Cursor::new(Vec::new());
    image
        .write_to(&mut buffer, ImageFormat::Png)
        .map_err(|error| Status::internal(format!("failed to encode avatar PNG: {error}")))?;
    Ok(buffer.into_inner())
}
