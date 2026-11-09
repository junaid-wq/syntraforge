import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  Play,
  Pause,
  Download,
  Copy,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Check,
  Shield,
  Zap,
  Sparkles,
  Film,
  Camera
} from "lucide-react";

export default function App() {
  const [videoSrc, setVideoSrc] = useState(null);
  const [videoName, setVideoName] = useState("");
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps] = useState(30);
  const [exportFormat, setExportFormat] = useState("png");
  const [snapshots, setSnapshots] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = (file) => {
    if (!file || !file.type.startsWith("video/")) {
      alert("Please upload a valid video file (.mp4, .webm, .mov).");
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoName(file.name.replace(/\.[^/.]+$/, ""));
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const onLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      });
    }
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const stepFrame = useCallback(
    (frames) => {
      if (!videoRef.current) return;
      videoRef.current.pause();
      setIsPlaying(false);
      const frameTime = 1 / fps;
      const targetTime = Math.min(
        Math.max(0, videoRef.current.currentTime + frames * frameTime),
        duration
      );
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    },
    [fps, duration]
  );

  const jumpSeconds = useCallback(
    (seconds) => {
      if (!videoRef.current) return;
      videoRef.current.pause();
      setIsPlaying(false);
      const targetTime = Math.min(
        Math.max(0, videoRef.current.currentTime + seconds),
        duration
      );
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    },
    [duration]
  );

  const captureFrameBlob = () => {
    return new Promise((resolve) => {
      if (!videoRef.current) return resolve(null);
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const mime = exportFormat === "png" ? "image/png" : "image/jpeg";
      canvas.toBlob((blob) => resolve(blob), mime, 0.98);
    });
  };

  const downloadFrame = async () => {
    const blob = await captureFrameBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestampFormatted = currentTime.toFixed(3).replace(".", "_");
    link.href = url;
    link.download = `${videoName || "frame"}_${timestampFormatted}.${exportFormat}`;
    link.click();
    URL.revokeObjectURL(url);

    const snapUrl = URL.createObjectURL(blob);
    setSnapshots((prev) => [
      {
        id: Date.now(),
        url: snapUrl,
        time: currentTime,
        resolution: `${videoDimensions.width}x${videoDimensions.height}`,
      },
      ...prev,
    ]);
  };

  const copyToClipboard = async (index = null, customUrl = null) => {
    try {
      let blob;
      if (customUrl) {
        const res = await fetch(customUrl);
        blob = await res.blob();
      } else {
        blob = await captureFrameBlob();
      }

      if (!blob) return;
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopiedIndex(index !== null ? index : "active");
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      alert("Direct clipboard copying is supported in modern browsers over HTTPS. Use the Grab Frame button to download directly.");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!videoSrc) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        stepFrame(-1);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        stepFrame(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [videoSrc, togglePlay, stepFrame]);

  const formatTimestamp = (timeInSeconds) => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    const ms = Math.floor((timeInSeconds % 1) * 1000);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                SyntraForge FrameGrab
              </span>
              <span className="ml-2 text-xs text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/40">
                100% Client-Side
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Shield className="w-4 h-4 text-emerald-400" /> Zero Uploads
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-4 h-4 text-amber-400" /> Lossless Native
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-8">
        <section className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-50">
            Instant Lossless Video Frame Grabber
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-400">
            Extract pixel-perfect, raw-resolution frames from any video directly in your browser.
            Zero server uploads, zero compression loss, completely free.
          </p>
        </section>

        {!videoSrc ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-indigo-500 bg-indigo-950/20"
                : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e.target.files[0])}
              accept="video/*"
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-indigo-900/30 border border-indigo-700/50 rounded-full text-indigo-400">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-200">
                  Click to select or drag and drop your video file
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports MP4, MOV, WebM (up to 4K 60FPS). Stays 100% on your device.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center max-h-[65vh]">
              <video
                ref={videoRef}
                src={videoSrc}
                onLoadedMetadata={onLoadedMetadata}
                onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-auto max-h-[65vh] object-contain"
                playsInline
              />
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-400 min-w-[70px]">
                  {formatTimestamp(currentTime)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={duration || 1}
                  step="0.001"
                  value={currentTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCurrentTime(val);
                    if (videoRef.current) videoRef.current.currentTime = val;
                  }}
                  className="flex-1 accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <span className="font-mono text-xs text-slate-500 min-w-[70px] text-right">
                  {formatTimestamp(duration)}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => jumpSeconds(-1)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg text-slate-300"
                    title="Jump -1s"
                  >
                    -1s
                  </button>
                  <button
                    onClick={() => stepFrame(-1)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                    title="Previous Frame (Left Arrow)"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 font-medium text-xs sm:text-sm"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <button
                    onClick={() => stepFrame(1)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                    title="Next Frame (Right Arrow)"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => jumpSeconds(1)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg text-slate-300"
                    title="Jump +1s"
                  >
                    +1s
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                  <span className="bg-slate-800/80 px-2.5 py-1 rounded-md">
                    Frame ~{Math.floor(currentTime * fps)}
                  </span>
                  <span className="bg-slate-800/80 px-2.5 py-1 rounded-md">
                    {videoDimensions.width} × {videoDimensions.height} px
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="png">PNG (Lossless)</option>
                    <option value="jpeg">JPG (Quality 98%)</option>
                  </select>
                  <button
                    onClick={() => copyToClipboard()}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 text-xs font-medium"
                  >
                    {copiedIndex === "active" ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copy
                  </button>
                  <button
                    onClick={downloadFrame}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-900/30"
                  >
                    <Download className="w-4 h-4" />
                    Grab Frame
                  </button>
                  <button
                    onClick={() => {
                      setVideoSrc(null);
                      setSnapshots([]);
                    }}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {snapshots.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-indigo-400" /> Captured Frames ({snapshots.length})
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {snapshots.map((snap, idx) => (
                    <div
                      key={snap.id}
                      className="relative min-w-[140px] max-w-[160px] bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex-shrink-0"
                    >
                      <img src={snap.url} alt="snapshot" className="w-full h-24 object-cover" />
                      <div className="p-2 text-[10px] text-slate-400 flex justify-between items-center bg-slate-900/90">
                        <span>{formatTimestamp(snap.time)}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => copyToClipboard(idx, snap.url)}
                            className="p-1 hover:text-white"
                          >
                            {copiedIndex === idx ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <a
                            href={snap.url}
                            download={`frame_${snap.time.toFixed(2)}.${exportFormat}`}
                            className="p-1 hover:text-white"
                          >
                            <Download className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AdSense Slot */}
        <div className="w-full py-6 px-4 bg-slate-900/40 border border-slate-800/80 rounded-xl text-center">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 block mb-1">
            Advertisement
          </span>
          <div className="h-24 sm:h-28 flex items-center justify-center border border-dashed border-slate-800 rounded-lg text-slate-600 text-xs">
            Responsive Ad Unit (728x90)
          </div>
        </div>

        <section className="grid sm:grid-cols-3 gap-6 pt-4 border-t border-slate-900 text-sm">
          <div className="p-4 bg-slate-900/40 border border-slate-800/50 rounded-xl">
            <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" /> Instant Frame Stepping
            </h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Use arrow keys or buttons to step frame-by-frame. Select exact thumbnail shots or reaction poses without missing a frame.
            </p>
          </div>
          <div className="p-4 bg-slate-900/40 border border-slate-800/50 rounded-xl">
            <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" /> 100% Client-Side
            </h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Files never upload to any server. All processing uses hardware-accelerated browser Canvas APIs directly in local memory.
            </p>
          </div>
          <div className="p-4 bg-slate-900/40 border border-slate-800/50 rounded-xl">
            <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" /> Raw Native Resolution
            </h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Export lossless PNGs matching the exact resolution of the original video (4K, 1080p, or 9:16 vertical).
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>© 2026 SyntraForge. Pure client-side browser utilities for creators & editors.</p>
      </footer>
    </div>
  );
}
