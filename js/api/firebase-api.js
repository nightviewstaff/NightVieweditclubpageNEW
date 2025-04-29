// firebase-api.js

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-analytics.js";
import {
    getFirestore,
    collection as firestoreCollection,
    getDocs as firestoreGetDocs,
    doc as firestoreDoc,
    getDoc as firestoreGetDoc,
    updateDoc as firestoreUpdateDoc,
    serverTimestamp as firestoreServerTimestamp, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import {
    getStorage as firebaseGetStorage,
    ref as firebaseRef,
    getDownloadURL as firebaseGetDownloadURL,
    uploadBytes as firebaseUploadBytes,
    deleteObject as firebaseDeleteObject
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js";
import {
    getAuth as firebaseGetAuth,
    onAuthStateChanged as firebaseOnAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";

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

// Export initialized services
export {
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
    firestoreServerTimestamp as serverTimestamp,
    // Storage exports
    firebaseGetStorage as getStorage,
    firebaseRef as ref,
    firebaseGetDownloadURL as getDownloadURL,
    firebaseUploadBytes as uploadBytes,
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

// Placeholder: future uploadNewClub function
export function uploadNewClub() {
    // TODO: Implement uploadNewClub
}

// Placeholder: future uploadClubChanges function
export function uploadClubChanges() {
    // TODO: Implement uploadClubChanges
}
