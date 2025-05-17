// firebase-api.js

// Core Firebase
import {initializeApp} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js";

// Firebase Services
import {getAnalytics, logEvent} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-analytics.js";
import {
    addDoc,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    GeoPoint,
    getDoc,
    getDocs,
    getFirestore,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import {
    deleteObject,
    getDownloadURL,
    getStorage,
    ref,
    uploadBytes
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";

// Utility Imports
import {convertToWebP} from "/js/utilities/utility.js";
import {databaseCollections} from "/js/utilities/constants.js";
import {getAllLocations, getSession, getUser, saveAllLocationsSession, saveUserSession} from "/js/utilities/session.js";
import {showAlert} from "/js/utilities/custom-alert.js";
import {getAllVisibleLocations, setAllVisibleLocations} from "/js/utilities/global.js";

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
const auth = getAuth(app);
const storage = getStorage(app);

let clubDataCache = getAllLocations();

//TODO SHould remove all exports and only have database interaction here.
// Export initialized services // TODO remove
export {
    storage,
    setDoc,
    app,
    analytics,
    db,
    auth,
    logEvent,
    // Firestore exports
    collection,
    getDocs,
    getDoc,
    addDoc,
    doc,
    updateDoc,
    serverTimestamp,
    // Storage exports
    getStorage,
    ref,
    getDownloadURL,
    uploadBytes,
    deleteObject,
    deleteDoc,
    // Auth exports
    getAuth,
    onAuthStateChanged,
    arrayUnion,
    GeoPoint,
};

export async function loginWithEmailPassword(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const role = await fetchUserRole(user.uid);

    return {user, role};
}

async function fetchUserRole(uid) {
    const docSnap = await getDoc(doc(db, databaseCollections.userData, uid));
    if (!docSnap.exists()) return 'user';
    const data = docSnap.data();

    saveUserSession(data); // Format when storing

    if (data.is_admin === true) return 'admin';
    if (Array.isArray(data.owned_clubs) && data.owned_clubs.length > 0) return 'owner';
    if (Array.isArray(data.staff_clubs) && data.staff_clubs.length > 0) return 'staff';
    return 'user';
    //TODO should be able to create club.
}

export async function fetchRelevantClubsByIds() {
    const session = getSession();
    const user = getUser();

    if (session.role === 'admin') {
        return await fetchAllVisibleClubsForAdmin();
    }

    const authorizedIds = new Set([
        ...(user.owned_clubs || []),
        ...(user.staff_clubs || [])
    ]);

    if (authorizedIds.size === 0) return [];

    const fetches = Array.from(authorizedIds).map(async id => {
        try {
            const clubRef = doc(db, databaseCollections.clubData, id);
            const clubSnap = await getDoc(clubRef);
            if (clubSnap.exists()) {
                return {id: clubSnap.id, ...clubSnap.data()};
            } else {
                console.warn(`⚠️ Club not found: ${id}`);
                return null;
            }
        } catch (e) {
            console.error(`❌ Error fetching club ${id}:`, e);
            return null;
        }
    });

    const results = await Promise.all(fetches);
    return results.filter(Boolean);
}

export async function fetchAllVisibleClubsForAdmin() {
    const session = getSession();
    if (session.role !== 'admin') return [];

    try {
        const [mainSnap, newSnap] = await Promise.all([
            getDocs(collection(db, databaseCollections.clubData)),
            getDocs(collection(db, databaseCollections.newClubs))
        ]);

        const mainClubs = mainSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), isNew: false }));
        const newClubs = newSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), isNew: true }));
        console.log(newClubs)

        const all = [...newClubs, ...mainClubs]; // New clubs on top
        setAllVisibleLocations(all);
        return all;
    } catch (err) {
        console.error("❌ Error fetching admin clubs:", err);
        return [];
    }
}

// export async function fetchAllLocations() {
//     if (clubDataCache?.length) {
//         return clubDataCache;
//     }
//     try {
//         const locationsSnapshot = await getDocs(collection(db, databaseCollections.clubData));
//         clubDataCache = locationsSnapshot.docs.map((doc) => ({
//             id: doc.id,
//             ...doc.data(),
//         }));
//         saveAllLocationsSession(clubDataCache);
//         return clubDataCache;
//     } catch (error) {
//         console.error("❌ Error fetching locations:", error);
//         return [];
//     }
// }

export async function updateNewLocations() {
    try {
        const locationsSnapshot = await getDocs(collection(db, databaseCollections.clubData));
        const existingIds = new Set(clubDataCache.map((doc) => doc.id));

        const newDocs = locationsSnapshot.docs
            .filter((doc) => !existingIds.has(doc.id))
            .map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

        if (newDocs.length) {
            clubDataCache = [...clubDataCache, ...newDocs];
            saveAllLocationsSession(clubDataCache);
        }

        return clubDataCache;
    } catch (error) {
        console.error("❌ Error updating locations:", error);
        return clubDataCache;
    }
}


export async function fetchUsersByIds(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const fetches = ids.map(async id => {
        try {
            const userRef = doc(db, databaseCollections.userData, id);
            const userSnap = await getDoc(userRef);
            return userSnap.exists() ? {id: userSnap.id, ...userSnap.data()} : null;
        } catch (e) {
            console.error(`❌ Error fetching user ${id}:`, e);
            return null;
        }
    });

    //TODO Save users fetched locally

    const results = await Promise.all(fetches);
    return results.filter(Boolean); // filter out any nulls
}

export async function fetchUserById(uid) {
    const cachedUsersJSON = sessionStorage.getItem('userCache');
    let cachedUsers = cachedUsersJSON ? JSON.parse(cachedUsersJSON) : {};

    const cachedUser = cachedUsers[uid];

    // 🔎 Check if cached user has useful data
    const hasValidData = cachedUser && (cachedUser.first_name || cachedUser.last_name || cachedUser.email);

    if (hasValidData) {
        return cachedUser;
    }

    try {
        const userRef = doc(db, databaseCollections.userData, uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const user = {id: uid, ...userSnap.data()};
            cachedUsers[uid] = user; // ✅ Overwrite stub
            sessionStorage.setItem('userCache', JSON.stringify(cachedUsers));
            return user;
        }
    } catch (e) {
        console.error(`❌ Error fetching user ${uid}:`, e);
    }

    return null;
}






/**
 * Logs all documents from a given Firestore collection.
 * @param {string} collectionName
 */
export async function logAllDocuments(collectionName = databaseCollections.clubData) {
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
export async function uploadNotification({
                                             header, message, createdBy,
                                             clubId, filters, scheduledFor
                                         }) {
    try {
        await addDoc(collection(db, databaseCollections.notifications), {
            header,
            message,
            created_by: createdBy,
            club_id: clubId,
            filters,
            scheduled_for: scheduledFor,
            created_at: serverTimestamp(),
            processed: false
        });
        console.log("✅ Notification uploaded successfully!");
    } catch (err) {
        console.error("❌ Error uploading notification:", err);
        showAlert({
            title: 'Upload Failed',
            text: 'Failed to upload notification. Try again.',
            icon: swalTypes.error
        });

    }
}

export async function fetchScheduledNotificationsForClub(clubId) {
    const now = new Date().toISOString();
    const q = query(
        collection(db, databaseCollections.notifications),
        where('club_id', '==', clubId),
        where('scheduled_for', '>=', now),
        //TODO Also not proccessed?
        orderBy('scheduled_for', 'asc')
    );

    const snapshot = await getDocs(q);
    console.log(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));

    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
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

export async function deleteNotificationById(id) {
    const ref = doc(db, databaseCollections.notifications, id);
    await deleteDoc(ref);
}

export async function refreshClubDataInCache(clubId) {
    const docRef = doc(db, databaseCollections.clubData, clubId);
    const updatedSnap = await getDoc(docRef);
    if (!updatedSnap.exists()) return;

    const updatedClub = { id: updatedSnap.id, ...updatedSnap.data() };
    const clubs = getAllVisibleLocations() || [];
    const index = clubs.findIndex(c => c.id === clubId);

    if (index > -1) clubs[index] = updatedClub;
    else clubs.push(updatedClub);

    setAllVisibleLocations(clubs);
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
