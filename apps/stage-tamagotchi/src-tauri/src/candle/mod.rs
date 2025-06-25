// Audio processing module using Candle framework
// Provides VAD (Voice Activity Detection) and ASR (Automatic Speech Recognition) capabilities

use anyhow::Result;
use tauri::Manager;

pub mod api;
pub mod audio_manager;
pub mod router;
pub mod vad;
pub mod whisper;

// Re-export the main types and functions
use std::{collections::HashMap, sync::Arc};

pub use api::*;
use candle_core::Device;
use tokio::sync::{Mutex, RwLock};

// Application state with dynamic model loading
#[derive(Clone)]
pub struct AppState {
  pub vad:            Arc<Mutex<vad::VADProcessor>>,
  pub device:         Device,
  // Use RwLock for read-heavy workload (checking cache)
  pub whisper_models: Arc<RwLock<HashMap<String, Arc<Mutex<whisper::WhisperProcessor>>>>>,
}

impl AppState {
  pub async fn new() -> Result<Self> {
    // Determine device to use
    let device = if std::env::var("CANDLE_FORCE_CPU").is_ok() {
      candle_core::Device::Cpu
    } else if candle_core::utils::cuda_is_available() {
      candle_core::Device::new_cuda(0)?
    } else if candle_core::utils::metal_is_available() {
      candle_core::Device::new_metal(0)?
    } else {
      candle_core::Device::Cpu
    };

    println!("🚀 Using device: {device:?}");

    // Get VAD threshold from environment or use default
    let vad_threshold = std::env::var("VAD_THRESHOLD").ok().and_then(|s| s.parse().ok()).unwrap_or(0.3);

    println!("🎯 VAD threshold: {vad_threshold}");

    // Initialize VAD processor (always use CPU for VAD)
    let vad = vad::VADProcessor::new(candle_core::Device::Cpu, vad_threshold)?;

    Ok(Self {
      vad: Arc::new(Mutex::new(vad)),
      device,
      whisper_models: Arc::new(RwLock::new(HashMap::new())),
    })
  }

  // Get or create Whisper processor for the specified model
  pub async fn get_whisper_processor(&self, model_name: &str) -> Result<Arc<Mutex<whisper::WhisperProcessor>>> {
    // First, try to read from cache
    {
      let models = self.whisper_models.read().await;
      if let Some(processor) = models.get(model_name) {
        println!("🔄 Using cached Whisper model: {model_name}");
        return Ok(processor.clone());
      }
    }

    // If not in cache, create new model with timing
    let loading_start = std::time::Instant::now();
    println!("🧠 Loading new Whisper model: {model_name}");

    let whisper_model = Self::parse_model_name(model_name)?;
    let processor = Arc::new(Mutex::new(whisper::WhisperProcessor::new(whisper_model, self.device.clone())?));

    let loading_time = loading_start.elapsed();

    // Add to cache
    {
      let mut models = self.whisper_models.write().await;
      models.insert(model_name.to_string(), processor.clone());
    }

    println!("✅ Whisper model loaded and cached: {} ({:.2}ms)", model_name, loading_time.as_secs_f64() * 1000.0);
    Ok(processor)
  }

  // Parse model name string to WhichWhisperModel enum
  fn parse_model_name(model_name: &str) -> Result<whisper::WhichWhisperModel> {
    match model_name.to_lowercase().as_str() {
      "tiny" => Ok(whisper::WhichWhisperModel::Tiny),
      "tiny.en" => Ok(whisper::WhichWhisperModel::TinyEn),
      "base" => Ok(whisper::WhichWhisperModel::Base),
      "base.en" => Ok(whisper::WhichWhisperModel::BaseEn),
      "small" => Ok(whisper::WhichWhisperModel::Small),
      "small.en" => Ok(whisper::WhichWhisperModel::SmallEn),
      "medium" => Ok(whisper::WhichWhisperModel::Medium),
      "medium.en" => Ok(whisper::WhichWhisperModel::MediumEn),
      "large" => Ok(whisper::WhichWhisperModel::Large),
      "large-v2" => Ok(whisper::WhichWhisperModel::LargeV2),
      "large-v3" => Ok(whisper::WhichWhisperModel::LargeV3),
      "large-v3-turbo" => Ok(whisper::WhichWhisperModel::LargeV3Turbo),
      "distil-medium.en" => Ok(whisper::WhichWhisperModel::DistilMediumEn),
      "distil-large-v2" => Ok(whisper::WhichWhisperModel::DistilLargeV2),
      _ => anyhow::bail!("Unsupported Whisper model: {}. Supported models: tiny, base, small, medium, large, large-v2, large-v3", model_name),
    }
  }
}

// Tauri commands for audio processing
#[tauri::command]
pub async fn transcribe_audio_file(app_handle: tauri::AppHandle, audio_data: Vec<u8>, model_name: Option<String>, stream: Option<bool>) -> Result<String, String> {
  // Lazy initialization of state
  let state = match app_handle.try_state::<AppState>() {
    Some(state) => state.inner().clone(),
    None => {
      // Initialize state on first use
      match AppState::new().await {
        Ok(state) => {
          app_handle.manage(state.clone());
          state
        },
        Err(e) => return Err(format!("Failed to initialize audio processing: {e}")),
      }
    },
  };

  let model_name = model_name.unwrap_or_else(|| "tiny".to_string());
  let stream_enabled = stream.unwrap_or(false);

  println!("🎤 Transcribing audio with model: {model_name}, streaming: {stream_enabled}");

  match router::transcribe_audio_data(&state, audio_data, model_name, stream_enabled, app_handle).await {
    Ok(transcript) => Ok(transcript),
    Err(e) => {
      println!("❌ Transcription error: {e}");
      Err(format!("Transcription failed: {e}"))
    },
  }
}

#[tauri::command]
pub async fn start_audio_monitoring(app_handle: tauri::AppHandle, device_name: Option<String>, model_name: Option<String>) -> Result<(), String> {
  // Lazy initialization of state
  let state = match app_handle.try_state::<AppState>() {
    Some(state) => state.inner().clone(),
    None => {
      // Initialize state on first use
      match AppState::new().await {
        Ok(state) => {
          app_handle.manage(state.clone());
          state
        },
        Err(e) => return Err(format!("Failed to initialize audio processing: {e}")),
      }
    },
  };

  let model_name = model_name.unwrap_or_else(|| "tiny".to_string());

  println!("🎤 Starting audio monitoring with model: {model_name}");

  match audio_manager::start_monitoring(&state, device_name, model_name, app_handle).await {
    Ok(()) => {
      println!("✅ Audio monitoring started");
      Ok(())
    },
    Err(e) => {
      println!("❌ Failed to start audio monitoring: {e}");
      Err(format!("Failed to start audio monitoring: {e}"))
    },
  }
}

#[tauri::command]
pub async fn stop_audio_monitoring(app_handle: tauri::AppHandle) -> Result<(), String> {
  match audio_manager::stop_monitoring(app_handle).await {
    Ok(()) => {
      println!("🛑 Audio monitoring stopped");
      Ok(())
    },
    Err(e) => {
      println!("❌ Failed to stop audio monitoring: {e}");
      Err(format!("Failed to stop audio monitoring: {e}"))
    },
  }
}

#[tauri::command]
pub async fn get_available_models() -> Result<Vec<String>, String> {
  Ok(vec![
    "tiny".to_string(),
    "tiny.en".to_string(),
    "base".to_string(),
    "base.en".to_string(),
    "small".to_string(),
    "small.en".to_string(),
    "medium".to_string(),
    "medium.en".to_string(),
    "large".to_string(),
    "large-v2".to_string(),
    "large-v3".to_string(),
    "large-v3-turbo".to_string(),
    "distil-medium.en".to_string(),
    "distil-large-v2".to_string(),
  ])
}

#[tauri::command]
pub async fn get_audio_devices() -> Result<Vec<String>, String> {
  match audio_manager::get_audio_devices().await {
    Ok(devices) => Ok(devices),
    Err(e) => Err(format!("Failed to get audio devices: {e}")),
  }
}

#[tauri::command]
pub async fn health_check() -> Result<serde_json::Value, String> {
  Ok(serde_json::json!({
    "status": "ok",
    "service": "ASR Tauri Integration",
    "version": "1.0.0",
    "monitoring": audio_manager::is_monitoring()
  }))
}

// Initialize the candle state for Tauri app
pub async fn initialize_state() -> Result<AppState> {
  AppState::new().await
}
