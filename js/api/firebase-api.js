// firebase-api.js

// Import Firebase modules
import {initializeApp} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import {getAnalytics, logEvent} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-analytics.js";
import {
    addDoc,
    collection as firestoreCollection,
    doc as firestoreDoc,
    getDoc as firestoreGetDoc,
    getDocs as firestoreGetDocs,
    getFirestore,
    serverTimestamp,
    setDoc,
    updateDoc as firestoreUpdateDoc,
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import {
    deleteObject as firebaseDeleteObject,
    getDownloadURL as firebaseGetDownloadURL,
    getStorage,
    ref,
    uploadBytes
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js";
import {
    getAuth as firebaseGetAuth,
    onAuthStateChanged as firebaseOnAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import {convertToWebP} from "../utilities/utility.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCUcgAhT__KeRfRm8fHpCKcI0E3mHKmHgE",
    authDomain: "nightview-d5406.firebaseapp.com",
    projectId: "nightview-d5406",
    storageBucket: "nightview-d5406.appspot.com",
    messagingSenderId: "573043562926",
    appId: "1:573043562926:web:19761678496603d8bcd03f",
    measurementId: "G-8ZS8W69Y57"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = firebaseGetAuth(app);
const storage = getStorage(app);

// Export initialized services
export {
    storage,
    setDoc,
    app,
    analytics,
    db,
    auth,
    logEvent,
    // Firestore exports
    firestoreCollection as collection,
    firestoreGetDocs as getDocs,
    firestoreDoc as doc,
    firestoreGetDoc as getDoc,
    firestoreUpdateDoc as updateDoc,
    serverTimestamp,
    // Storage exports
    getStorage,
    ref,
    firebaseGetDownloadURL as getDownloadURL,
    uploadBytes,
    firebaseDeleteObject as deleteObject,
    // Auth exports
    firebaseGetAuth as getAuth,
    firebaseOnAuthStateChanged as onAuthStateChanged,addDoc
};

/**
 * Logs all documents from a given Firestore collection.
 * @param {string} collectionName
 */
export async function logAllDocuments(collectionName = "club_data") {
    try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        querySnapshot.forEach((doc) => {
            console.log(`${doc.id} =>`, doc.data());
        });
    } catch (error) {
        console.error("❌ Error fetching documents:", error);
    }
}

/**
 * Uploads a notification document to Firestore.
 * @param {Object} notificationData
 */

//TODo Make generic.
export async function uploadNotification({ collection,header, message, createdBy, clubId, filters, scheduledFor }) {
    try {
        await addDoc(firestoreCollection(db, collection), {
            header,
            message,
            created_by,
            club_id,
            filters,
            scheduled_for,
            createdAt: serverTimestamp(),
            processed: false
        });
        console.log("✅ Notification uploaded successfully!");
    } catch (err) {
        console.error("❌ Error uploading notification:", err);
        alert("Failed to upload notification. Try again.");
    }
}

/**
 * Uploads an image file to Firebase Storage in a specified directory.
 * @param {File} file - The image file to upload.
 * @param {string} path - The destination path inside Firebase Storage (e.g., 'club_logos/filename.webp').
 * @returns {Promise<string>} - Returns the full storage path on success.
 */
export async function uploadImageToFirestore(file, path) {
    try {
        // Auto-convert to WebP if not already
        if (file.type !== "image/webp") {
            file = await convertToWebP(file);
            path = path.replace(/\.[^/.]+$/, ".webp");
        }

        const fileRef = ref(storage, path);
        await uploadBytes(fileRef, file);
        console.log(`✅ Image uploaded to: ${path}`);
        return path;
    } catch (error) {
        console.error(`❌ Failed to upload image to ${path}:`, error);
        throw error;
    }
}

/**
 * Uploads a document to Firestore with tracking fields.
 * @param {string} collectionName - The Firestore collection.
 * @param {string} storagePath - Used as the document ID (e.g., 'club_logos/club.webp').
 * @param {string} uploadedBy - UID of the uploader.
 * @param {object} additionalData - Any other data to include in the document.
 */
export async function uploadData({collectionName, storagePath, uploadedBy, additionalData = {}}) {
    const docRef = doc(collection(db, collectionName), storagePath.replaceAll("/", "_"));
    const payload = {
        ...additionalData,
        created_by: uploadedBy,
        processed: false,
        created_at: serverTimestamp()
    };
    await setDoc(docRef, payload);
    console.log(`✅ Document saved with metadata: ${storagePath}`);
}



