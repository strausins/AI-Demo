const API_ENDPOINT = "https://gaso-prediction.cognitiveservices.azure.com/customvision/v3.0/Prediction/1aadf65f-19d8-4274-813e-b6ee94671c77/detect/iterations/GSkaititaji1/image";
const API_KEY = "8pit2QXGXzSPaIaaBVqMQTNWUL53pz7tu2KsGcaKliDpZwE04AfTJQQJ99BAACYeBjFXJ3w3AAAIACOG1j34";

document.getElementById("processBtn").addEventListener("click", async function () {
    const input = document.getElementById("imageUpload").files[0];

    if (!input) {
        alert("Please upload an image first.");
        return;
    }

    if (input.size > 4194304) {
        alert("Image size exceeds 4MB limit!");
        return;
    }

    const imageURL = URL.createObjectURL(input);
    const img = new Image();
    img.src = imageURL;

    img.onload = async function () {
        const canvas = document.getElementById("imageCanvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width / 2;
        canvas.height = img.height / 2;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const formData = new FormData();
        formData.append("image", input);

        try {
            const response = await fetch(API_ENDPOINT, {
                method: "POST",
                headers: { "Prediction-Key": API_KEY },
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const result = await response.json();
            const predictions = result.predictions.filter(p => p.probability > 0.2);

            if (predictions.length === 0) {
                document.getElementById("output").innerHTML = "<p>No numbers detected.</p>";
                return;
            }

            let outputHTML = `<h2>Extracted Numbers:</h2>`;

            for (const pred of predictions) {
                if (pred.tagName !== "Used gas" && pred.tagName !== "Serial number") {
                    continue; // Ignore everything except "Used gas" and "Serial number"
                }

                const bbox = pred.boundingBox;
                let left = bbox.left * canvas.width;
                let top = bbox.top * canvas.height;
                let width = bbox.width * canvas.width;
                let height = bbox.height * canvas.height;

                left += width * 0.01;
                top += height * 0.05;
                width *= 0.94;
                height *= 0.90;

                // Draw bounding boxes only for "Used gas" and "Serial number"
                ctx.strokeStyle = "red";
                ctx.lineWidth = 3;
                ctx.strokeRect(left, top, width, height);

                const croppedCanvas = document.createElement("canvas");
                const croppedCtx = croppedCanvas.getContext("2d");
                croppedCanvas.width = width * 2;
                croppedCanvas.height = height * 2;
                croppedCtx.drawImage(canvas, left, top, width, height, 0, 0, croppedCanvas.width, croppedCanvas.height);

                // **Apply Enhancements ONLY for "Used gas"**
                if (pred.tagName === "Used gas") {
                    let imageData = croppedCtx.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height);
                    let data = imageData.data;

                    for (let i = 0; i < data.length; i += 4) {
                        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                        const newPixel = avg > 128 ? 255 : 0; // Convert to black & white
                        data[i] = data[i + 1] = data[i + 2] = newPixel;
                    }
                    croppedCtx.putImageData(imageData, 0, 0);
                }

                // Convert cropped image to Base64 for OCR
                const base64Image = croppedCanvas.toDataURL("image/png");

                try {
                    const ocrResult = await Tesseract.recognize(base64Image, "eng", {
                        tessedit_char_whitelist: "0123456789",
                        preserve_interword_spaces: 0,
                    });

                    console.log(`OCR Result for ${pred.tagName}:`, ocrResult);

                    if (!ocrResult || !ocrResult.data || (!ocrResult.data.words && !ocrResult.data.text)) {
                        outputHTML += `<p>${pred.tagName}: <input type="text" value="OCR failed" readonly></p>`;
                        continue;
                    }

                    let extractedNumbers = [];
                    if (ocrResult.data.words) {
                        extractedNumbers = ocrResult.data.words
                            .filter(w => w.confidence >= 40)
                            .map(w => w.text.match(/\d+/g))
                            .flat()
                            .filter(Boolean);
                    }

                    if (extractedNumbers.length === 0 && ocrResult.data.text) {
                        extractedNumbers = ocrResult.data.text.match(/\d+/g) || [];
                    }

                    let numberValue = extractedNumbers.length > 0 ? extractedNumbers.join(" ") : "No numbers detected";
                    outputHTML += `<p>${pred.tagName}: <input type="text" class="editable-number" value="${numberValue}"></p>`;

                } catch (ocrError) {
                    console.error("OCR Error:", ocrError);
                    outputHTML += `<p>${pred.tagName}: <input type="text" value="OCR failed" readonly></p>`;
                }
            }

            outputHTML += `<button id="saveNumbers">Save Changes</button>`;
            document.getElementById("output").innerHTML = outputHTML;

            // **Save Button Event Listener**
            document.getElementById("saveNumbers").addEventListener("click", function () {
                let editedNumbers = {};
                document.querySelectorAll(".editable-number").forEach(input => {
                    let key = input.parentElement.textContent.split(":")[0].trim();
                    editedNumbers[key] = input.value;
                });

                console.log("Saved Numbers:", editedNumbers);
                alert("Numbers saved successfully!");
            });

        } catch (error) {
            console.error("API Error:", error);
            alert("Error processing image. Please try again.");
        }
    };
});
