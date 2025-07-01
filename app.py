document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.querySelector("#startBtn");

  if (!startBtn) {
    console.warn("⚠️ startBtn not found in DOM");
    return;
  }

  startBtn.onclick = async () => {
    console.log("✅ Start clicked");

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const formData = new FormData();
        formData.append("video", blob);

        const res = await fetch("/upload", {
          method: "POST",
          body: formData
        });

        const json = await res.json();
        if (json.status === "ok") {
          alert(`✅ Uploaded: ${json.url}`);
          window.open(json.url, "_blank");
        } else {
          alert("❌ Upload failed: " + json.error);
        }
      };

      mediaRecorder.start();

      setTimeout(() => {
        mediaRecorder.stop();
      }, 10000); // stop after 10 seconds, adjust as needed

    } catch (err) {
      console.error("❌ Error during recording:", err);
      alert("Screen recording permission denied or error occurred.");
    }
  };
});
