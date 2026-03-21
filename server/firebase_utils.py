import firebase_admin
from firebase_admin import credentials, firestore
import os

def init_firebase():
    """Initializes Firebase Admin SDK."""
    if not firebase_admin._apps:
        # Resolve path relative to this file's directory -> project root
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        cert_path = os.path.join(base_dir, "serviceAccountKey.json")
        
        if os.path.exists(cert_path):
            try:
                cred = credentials.Certificate(cert_path)
                firebase_admin.initialize_app(cred)
                print("Firebase Admin strictly initialized via serviceAccountKey.json")
            except Exception as e:
                print(f"Failed to initialize via service account key: {e}")
        else:
            print("\n" + "="*60)
            print("WARNING: serviceAccountKey.json not found in root directory!")
            print("The backend needs this file to write to Firebase Firestore.")
            print("Please add serviceAccountKey.json from Firebase Console -> Project Settings -> Service Accounts.")
            print("="*60 + "\n")
            try:
                # Attempt to initialize without creds if on GCP or emulator
                firebase_admin.initialize_app()
            except Exception as e:
                print(f"Firebase default initialization failed: {e}")

def get_db():
    if not firebase_admin._apps:
        return None
    try:
        return firestore.client()
    except Exception as e:
        print(f"Firestore not initialized: {e}")
        return None
