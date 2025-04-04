// firebase-api.js

// Import the functions from the Firebase CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-analytics.js";
import {
    getFirestore,
    collection as firestoreCollection,
    getDocs as firestoreGetDocs,
    doc as firestoreDoc,
    getDoc as firestoreGetDoc,
    updateDoc as firestoreUpdateDoc
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
const auth = firebaseGetAuth(app); // Initialize auth

// Export the initialized Firebase services and functions
export {
    app,
    analytics,
    db,
    auth, // Export initialized auth
    logEvent,
    // Firestore re-exports
    firestoreGetDocs as getDocs,
    firestoreCollection as collection,
    firestoreDoc as doc,
    firestoreGetDoc as getDoc,
    firestoreUpdateDoc as updateDoc,
    // Storage re-exports
    firebaseGetStorage as getStorage,
    firebaseRef as ref,
    firebaseGetDownloadURL as getDownloadURL,
    firebaseUploadBytes as uploadBytes,
    firebaseDeleteObject as deleteObject,
    // Auth re-exports
    firebaseGetAuth as getAuth,
    firebaseOnAuthStateChanged as onAuthStateChanged
};

/**
 * Logs all documents in a specified collection.
 * @param {string} collectionName The name of the Firestore collection.
 */
export async function logAllDocuments(collectionName = "club_data") {
    try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        querySnapshot.forEach((doc) => {
            console.log(`${doc.id} =>`, doc.data());
        });
    } catch (error) {
        console.error("Error fetching documents:", error);
    }
}