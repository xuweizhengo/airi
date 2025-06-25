use std::{
  sync::Arc,
  time::{Duration, Instant},
};

use anyhow::Result;
use symphonia::{
  core::{
    audio::{AudioBufferRef, Signal},
    codecs::DecoderOptions,
    formats::FormatOptions,
    io::{MediaSourceStream, MediaSourceStreamOptions},
    meta::MetadataOptions,
    probe::Hint,
  },
  default::get_probe,
};
use tauri::{AppHandle, Emitter};

use crate::candle::{
  api::{StreamChunk, TranscriptionResponse},
  audio_manager::AudioBuffer,
  AppState,
};

// Performance statistics struct
#[derive(Debug)]
struct ProcessingStats {
  total_duration:                 Duration,
  audio_conversion_duration:      Duration,
  model_loading_duration:         Duration,
  vad_processing_duration:        Duration,
  whisper_transcription_duration: Duration,
  audio_length_seconds:           f32,
}

impl ProcessingStats {
  const fn new() -> Self {
    Self {
      total_duration:                 Duration::ZERO,
      audio_conversion_duration:      Duration::ZERO,
      model_loading_duration:         Duration::ZERO,
      vad_processing_duration:        Duration::ZERO,
      whisper_transcription_duration: Duration::ZERO,
      audio_length_seconds:           0.0,
    }
  }

  fn print_summary(&self) {
    println!("📊 Processing Statistics:");
    println!("  📁 Audio conversion: {:.2}ms", self.audio_conversion_duration.as_secs_f64() * 1000.0);
    println!("  🧠 Model loading: {:.2}ms", self.model_loading_duration.as_secs_f64() * 1000.0);
    println!("  🎯 VAD processing: {:.2}ms", self.vad_processing_duration.as_secs_f64() * 1000.0);
    println!("  🗣️  Whisper transcription: {:.2}ms", self.whisper_transcription_duration.as_secs_f64() * 1000.0);
    println!("  ⏱️  Total processing: {:.2}ms", self.total_duration.as_secs_f64() * 1000.0);
    println!("  🎵 Audio length: {:.2}s", self.audio_length_seconds);
    if self.audio_length_seconds > 0.0 {
      let real_time_factor = self.total_duration.as_secs_f64() / f64::from(self.audio_length_seconds);
      println!("  ⚡ Real-time factor: {real_time_factor:.2}x");
    }
  }
}

#[allow(clippy::cast_precision_loss)]
pub async fn transcribe_audio_data(state: &AppState, audio_data: Vec<u8>, model_name: String, stream_enabled: bool, app_handle: AppHandle) -> Result<String> {
  let start_time = Instant::now();
  let mut processing_stats = ProcessingStats::new();

  println!("🎤 Processing audio data: {} bytes, model: {model_name}, streaming: {stream_enabled}", audio_data.len());

  // Convert audio to PCM format with timing
  let conversion_start = Instant::now();
  let pcm_data = convert_audio_to_pcm(&audio_data).await?;
  processing_stats.audio_conversion_duration = conversion_start.elapsed();
  processing_stats.audio_length_seconds = pcm_data.len() as f32 / 16000.0; // Assuming 16kHz sample rate

  println!("Audio data length: {} samples ({:.2}s)", pcm_data.len(), processing_stats.audio_length_seconds);

  if stream_enabled {
    // Process with streaming and emit events
    transcribe_audio_streaming(state, model_name, pcm_data, processing_stats, app_handle).await
  } else {
    // Process complete audio and return result
    transcribe_audio_complete(state, model_name, pcm_data, &mut processing_stats).await.map(|transcript| {
      processing_stats.total_duration = start_time.elapsed();
      processing_stats.print_summary();
      transcript
    })
  }
}

// Convert various audio formats to PCM
async fn convert_audio_to_pcm(audio_data: &[u8]) -> Result<Vec<f32>> {
  let cursor = std::io::Cursor::new(audio_data.to_vec());
  let media_source = MediaSourceStream::new(Box::new(cursor), MediaSourceStreamOptions::default());

  let mut hint = Hint::new();
  hint.mime_type("audio/wav"); // You might want to detect this automatically

  let meta_opts = MetadataOptions::default();
  let fmt_opts = FormatOptions::default();

  let probed = get_probe().format(&hint, media_source, &fmt_opts, &meta_opts)?;

  let mut format = probed.format;
  let track = format.tracks().iter().find(|t| t.codec_params.codec != symphonia::core::codecs::CODEC_TYPE_NULL).ok_or_else(|| anyhow::anyhow!("No audio track found"))?;

  let dec_opts = DecoderOptions::default();
  let mut decoder = symphonia::default::get_codecs().make(&track.codec_params, &dec_opts)?;

  let track_id = track.id;
  let mut pcm_data = Vec::new();

  // Decode the audio
  while let Ok(packet) = format.next_packet() {
    if packet.track_id() != track_id {
      continue;
    }

    match decoder.decode(&packet)? {
      AudioBufferRef::F32(buf) => {
        for &sample in buf.chan(0) {
          pcm_data.push(sample);
        }
      },
      AudioBufferRef::S16(buf) => {
        for &sample in buf.chan(0) {
          pcm_data.push(f32::from(sample) / f32::from(i16::MAX));
        }
      },
      AudioBufferRef::S32(buf) => {
        for &sample in buf.chan(0) {
          #[allow(clippy::cast_precision_loss)]
          pcm_data.push(sample as f32 / i32::MAX as f32);
        }
      },
      _ => {
        anyhow::bail!("Unsupported audio format");
      },
    }
  }

  Ok(pcm_data)
}

// Process complete audio file and return full transcript
#[allow(clippy::significant_drop_tightening)]
async fn transcribe_audio_complete(state: &AppState, model_name: String, audio_data: Vec<f32>, processing_stats: &mut ProcessingStats) -> Result<String> {
  let sample_rate = 16000;

  // Get the appropriate Whisper processor for this model with timing
  let model_loading_start = Instant::now();
  let whisper_processor = state.get_whisper_processor(&model_name).await?;
  processing_stats.model_loading_duration = model_loading_start.elapsed();

  // Process audio through VAD and Whisper
  let mut vad = state.vad.lock().await;
  let mut whisper = whisper_processor.lock().await;
  let mut audio_buffer = AudioBuffer::new(10000, 100, 500, sample_rate);

  let mut transcripts = Vec::new();
  let mut frame_buffer = Vec::<f32>::new();

  let vad_start = Instant::now();
  let mut whisper_total_time = Duration::ZERO;

  // Process in chunks
  for chunk in audio_data.chunks(1024) {
    frame_buffer.extend_from_slice(chunk);

    // Process 512-sample frames
    while frame_buffer.len() >= 512 {
      let frame: Vec<f32> = frame_buffer.drain(..512).collect();
      let speech_prob = vad.process_chunk(&frame)?;
      let is_speech = vad.is_speech(speech_prob);

      if let Some(complete_audio) = audio_buffer.add_chunk(&frame, is_speech) {
        // Measure Whisper transcription time
        let whisper_start = Instant::now();
        let transcript = whisper.transcribe(&complete_audio)?;
        whisper_total_time += whisper_start.elapsed();

        if !transcript.trim().is_empty() && !transcript.contains("[BLANK_AUDIO]") {
          transcripts.push(transcript.trim().to_string());
        }
      }
    }
  }

  processing_stats.vad_processing_duration = vad_start.elapsed() - whisper_total_time;
  processing_stats.whisper_transcription_duration = whisper_total_time;

  Ok(transcripts.join(" "))
}

// Process audio with streaming and emit events
async fn transcribe_audio_streaming(state: &AppState, model_name: String, audio_data: Vec<f32>, mut processing_stats: ProcessingStats, app_handle: AppHandle) -> Result<String> {
  let stream_start = Instant::now();

  // Get the appropriate Whisper processor for this model with timing
  let model_loading_start = Instant::now();
  let whisper_processor = state.get_whisper_processor(&model_name).await?;
  processing_stats.model_loading_duration = model_loading_start.elapsed();

  let sample_rate = 16000;
  let mut audio_buffer = AudioBuffer::new(10000, 100, 500, sample_rate);
  let mut transcripts = Vec::new();
  let mut processed = 0;

  // Process audio in chunks suitable for VAD (512 samples at a time)
  for chunk in audio_data.chunks(512) {
    processed += chunk.len();

    // Process through VAD
    let vad_chunk_start = Instant::now();
    let mut vad = state.vad.lock().await;
    let speech_prob = vad.process_chunk(chunk)?;
    let is_speech = vad.is_speech(speech_prob);
    drop(vad); // Release VAD lock early

    let vad_chunk_time = vad_chunk_start.elapsed();
    processing_stats.vad_processing_duration += vad_chunk_time;

    // Add to audio buffer and check if we have complete audio
    if let Some(complete_audio) = audio_buffer.add_chunk(chunk, is_speech) {
      // Process complete audio through Whisper
      let whisper_chunk_start = Instant::now();
      let mut whisper = whisper_processor.lock().await;
      let transcript = whisper.transcribe(&complete_audio)?;
      drop(whisper); // Release Whisper lock early

      let whisper_chunk_time = whisper_chunk_start.elapsed();
      processing_stats.whisper_transcription_duration += whisper_chunk_time;

      if !transcript.trim().is_empty() && !transcript.contains("[BLANK_AUDIO]") {
        let clean_transcript = transcript.trim().to_string();
        transcripts.push(clean_transcript.clone());

        println!("🎯 Chunk transcribed in {:.2}ms: \"{}\"", whisper_chunk_time.as_secs_f64() * 1000.0, clean_transcript);

        // Emit streaming event
        #[allow(clippy::cast_precision_loss)]
        let event_data = StreamChunk {
          text:      clean_transcript,
          timestamp: Some(processed as f64 / f64::from(sample_rate)),
        };

        if let Err(e) = app_handle.emit("audio-transcription-chunk", &event_data) {
          println!("❌ Failed to emit streaming event: {e}");
        }
      }
    }

    // Emit progress update
    #[allow(clippy::cast_precision_loss)]
    let progress = (processed as f64 / audio_data.len() as f64) * 100.0;
    if let Err(e) = app_handle.emit(
      "audio-transcription-progress",
      &serde_json::json!({
        "progress": progress,
        "processed_samples": processed,
        "total_samples": audio_data.len()
      }),
    ) {
      println!("❌ Failed to emit progress event: {e}");
    }
  }

  processing_stats.total_duration = stream_start.elapsed();
  processing_stats.print_summary();

  // Emit final completion event
  let final_transcript = transcripts.join(" ");
  if let Err(e) = app_handle.emit("audio-transcription-complete", &TranscriptionResponse { text: final_transcript.clone() }) {
    println!("❌ Failed to emit completion event: {e}");
  }

  Ok(final_transcript)
}

// Process realtime audio chunk
pub async fn process_realtime_chunk(state: &AppState, chunk: &[f32], audio_buffer: &mut AudioBuffer, model_name: &str, app_handle: &AppHandle) -> Result<()> {
  // Process through VAD
  let mut vad = state.vad.lock().await;
  let speech_prob = vad.process_chunk(chunk)?;
  let is_speech = vad.is_speech(speech_prob);
  drop(vad); // Release VAD lock early

  // Add to audio buffer and check if we have complete audio
  if let Some(complete_audio) = audio_buffer.add_chunk(chunk, is_speech) {
    // Get Whisper processor
    let whisper_processor = state.get_whisper_processor(model_name).await?;
    let mut whisper = whisper_processor.lock().await;

    let transcript = whisper.transcribe(&complete_audio)?;
    drop(whisper); // Release Whisper lock early

    if !transcript.trim().is_empty() && !transcript.contains("[BLANK_AUDIO]") {
      let clean_transcript = transcript.trim().to_string();
      println!("🎯 Realtime transcription: \"{}\"", clean_transcript);

      // Emit realtime transcription event
      let event_data = StreamChunk {
        text:      clean_transcript,
        timestamp: Some(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs_f64()),
      };

      if let Err(e) = app_handle.emit("audio-realtime-transcription", &event_data) {
        println!("❌ Failed to emit realtime transcription event: {e}");
      }
    }
  }

  Ok(())
}
