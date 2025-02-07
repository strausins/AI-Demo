import requests
import re
from PIL import Image, ImageEnhance, ImageOps
from paddleocr import PaddleOCR
import os

ocr = PaddleOCR(use_angle_cls=True, lang="en", rec_score_thresh=0.7)

PREDICTION_ENDPOINT = "https://gaso-prediction.cognitiveservices.azure.com/customvision/v3.0/Prediction/1aadf65f-19d8-4274-813e-b6ee94671c77/detect/iterations/GSkaititaji1/image"
PREDICTION_KEY = "8pit2QXGXzSPaIaaBVqMQTNWUL53pz7tu2KsGcaKliDpZwE04AfTJQQJ99BAACYeBjFXJ3w3AAAIACOG1j34"
IMAGE_PATH = "C:\\Users\\Admin\\Desktop\\html-css\\Vision\\skaititaji\\2417268.jpg"

try:
    with open(IMAGE_PATH, "rb") as image_data:
        headers = {
            "Prediction-Key": PREDICTION_KEY,
            "Content-Type": "application/octet-stream"
        }
        response = requests.post(PREDICTION_ENDPOINT, headers=headers, data=image_data)
        response.raise_for_status()
        predictions = response.json()["predictions"]
except requests.exceptions.HTTPError:
    exit()

def preprocess_used_gas(image_path):
    image = Image.open(image_path).convert("L")
    image = ImageOps.invert(image)
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2.0)
    processed_path = "processed_" + os.path.basename(image_path)
    image.save(processed_path)
    return processed_path

try:
    image = Image.open(IMAGE_PATH)

    for idx, prediction in enumerate(predictions):
        if prediction["probability"] > 0.2 and prediction["tagName"] in ["Used gas", "Serial number"]:
            bbox = prediction["boundingBox"]
            left = int(bbox["left"] * image.width)
            top = int(bbox["top"] * image.height)
            width = int(bbox["width"] * image.width)
            height = int(bbox["height"] * image.height)

            cropped_region = image.crop((left, top, left + width, top + height))
            cropped_filename = f"cropped_{prediction['tagName']}_{idx + 1}.jpg"
            cropped_region.save(cropped_filename)

            if prediction["tagName"] == "Used gas":
                cropped_filename = preprocess_used_gas(cropped_filename)

            ocr_results = ocr.ocr(cropped_filename, cls=True)
            extracted_numbers = []

            if ocr_results:
                sorted_results = sorted(ocr_results[0], key=lambda x: x[0][0][0])
                for line in sorted_results:
                    raw_text = line[1][0]
                    numeric_text = "".join(re.findall(r"\d+", raw_text))
                    if numeric_text:
                        extracted_numbers.append(numeric_text)

            if extracted_numbers:
                print(f"{prediction['tagName']}: {' '.join(extracted_numbers)}")
            else:
                print(f"{prediction['tagName']}: No numbers detected")

except Exception:
    exit()
