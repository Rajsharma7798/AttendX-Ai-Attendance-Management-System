import face_recognition
import numpy as np
import cv2
import io
import base64
from PIL import Image

def get_face_encoding(image_bytes):
    """
    Takes image bytes, returns a 128-d face encoding or None if no face found.
    Uses PIL as a fallback for image loading to handle compatibility issues
    with dlib/numpy version mismatches.
    """
    try:
        # Primary method: Use PIL to load the image (most reliable across numpy versions)
        pil_img = Image.open(io.BytesIO(image_bytes))
        # Convert to RGB if necessary (handles RGBA, grayscale, etc.)
        rgb_img = np.array(pil_img.convert('RGB'))
    except Exception:
        try:
            # Fallback: Use OpenCV
            np_arr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if img is None:
                return None
            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        except Exception:
            return None

    # Ensure the image is contiguous in memory and uint8 (required by dlib)
    if rgb_img.dtype != np.uint8:
        rgb_img = rgb_img.astype(np.uint8)
    if not rgb_img.flags['C_CONTIGUOUS']:
        rgb_img = np.ascontiguousarray(rgb_img)

    try:
        face_locations = face_recognition.face_locations(rgb_img)
        if not face_locations:
            return None

        face_encodings = face_recognition.face_encodings(rgb_img, face_locations)
        if face_encodings:
            return face_encodings[0].tolist()
    except RuntimeError as e:
        print(f"face_recognition RuntimeError: {e}")
        return None
    except Exception as e:
        print(f"face_recognition unexpected error: {e}")
        return None

    return None


def get_all_face_encodings(image_bytes):
    """
    Takes image bytes, returns a list of 128-d face encodings (one per face found).
    Supports 1-N faces in a single image.
    Returns an empty list if no faces are found or on error.
    """
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        rgb_img = np.array(pil_img.convert('RGB'))
    except Exception:
        try:
            np_arr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if img is None:
                return []
            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        except Exception:
            return []

    if rgb_img.dtype != np.uint8:
        rgb_img = rgb_img.astype(np.uint8)
    if not rgb_img.flags['C_CONTIGUOUS']:
        rgb_img = np.ascontiguousarray(rgb_img)

    try:
        face_locations = face_recognition.face_locations(rgb_img)
        if not face_locations:
            return []
        face_encodings = face_recognition.face_encodings(rgb_img, face_locations)
        return [enc.tolist() for enc in face_encodings]
    except Exception as e:
        print(f"get_all_face_encodings error: {e}")
        return []


def match_face(unknown_encoding, known_encodings, tolerance=0.5):
    """
    Matches unknown encoding against a dictionary of {uid: known_encoding}
    Returns uid if match found, else None.
    """
    if not known_encodings:
        return None

    known_list = list(known_encodings.values())
    uid_list = list(known_encodings.keys())

    try:
        matches = face_recognition.compare_faces(known_list, np.array(unknown_encoding), tolerance=tolerance)
        face_distances = face_recognition.face_distance(known_list, np.array(unknown_encoding))

        if len(face_distances) > 0:
            best_match_index = np.argmin(face_distances)
            if matches[best_match_index]:
                return uid_list[best_match_index]
    except Exception as e:
        print(f"match_face error: {e}")
        return None

    return None

def extract_faces_and_encodings(image_bytes):
    """
    Finds all faces in the provided image bytes.
    Returns a list of dicts: {"encoding": [list of floats], "face_image_b64": "base64 string of cropped face"}
    """
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        if pil_img.mode != 'RGB':
            pil_img = pil_img.convert('RGB')
        rgb_img = np.array(pil_img)
    except Exception:
        try:
            np_arr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if img is None:
                return []
            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb_img)
        except Exception:
            return []

    if rgb_img.dtype != np.uint8:
        rgb_img = rgb_img.astype(np.uint8)
    if not rgb_img.flags['C_CONTIGUOUS']:
        rgb_img = np.ascontiguousarray(rgb_img)

    try:
        face_locations = face_recognition.face_locations(rgb_img)
        if not face_locations:
            return []
        
        face_encodings = face_recognition.face_encodings(rgb_img, face_locations)
        
        results = []
        for loc, enc in zip(face_locations, face_encodings):
            top, right, bottom, left = loc
            
            # Add padding to crop for better UX
            height = bottom - top
            width = right - left
            pad_h = int(height * 0.4)
            pad_w = int(width * 0.4)
            
            max_h, max_w, _ = rgb_img.shape
            
            p_top = max(0, top - pad_h)
            p_bottom = min(max_h, bottom + pad_h)
            p_left = max(0, left - pad_w)
            p_right = min(max_w, right + pad_w)
            
            face_crop = pil_img.crop((p_left, p_top, p_right, p_bottom))
            
            # Convert to base64
            buffered = io.BytesIO()
            face_crop.thumbnail((150, 150)) # Compress size
            face_crop.save(buffered, format="JPEG", quality=85)
            img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
            
            results.append({
                "encoding": enc.tolist(),
                "face_image_b64": img_str
            })
            
        return results
    except Exception as e:
        print(f"extract_faces_and_encodings error: {e}")
        return []
