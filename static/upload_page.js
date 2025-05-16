async function uploadPhotos(inputElement) {
  const fileList = Array.from(inputElement.files);

  if (fileList.length > 10) {
    alert("You can only upload 10 photos at a time");
    return;
  }

  const preview = document.querySelector("#image-preview");

  const uploadPromises = fileList.map(async (file) => {
    const fd = new FormData();
    fd.append("file", file);

    try {
      const response = await fetch("/actions/photo/upload-start", {
        method: "POST",
        body: fd,
      });

      if (!response.ok) {
        alert(await response.text());
        return;
      }

      const html = await response.text();

      const temp = document.createElement("div");
      temp.innerHTML = html;

      // Insert at start
      preview.insertBefore(temp.firstElementChild, preview.firstChild);

      // Trigger htmx processing
      htmx.process(preview);
    } catch (err) {
      console.error("Network error:", err);
      alert("Error uploading photo");
    }
  });

  // Run all uploads in parallel
  await Promise.all(uploadPromises);

  // Reset the input
  inputElement.value = "";
}
