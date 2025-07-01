document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startBtn");

  startBtn.onclick = async () => {
    console.log("🎬 Start button clicked");

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      console.log("✅ Got stream", stream);

      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.style.width = "600px";
      document.body.appendChild(video);
    } catch (err) {
      console.error("❌ Error getting screen stream:", err);
      alert("Screen recording permission denied or unsupported.");
    }
  };
});
