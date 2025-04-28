// init.js
import {collection, getDocs} from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js';
import {db} from '../api/firebase-api.js';
import {getClubs, getUsersWithClubAccess, setClubDataCache, setUserCache} from './global.js';
import {checkSession} from "./session.js";

export async function init() {
    // if (!checkSession()) return;

    if (getClubs() === null || getUsersWithClubAccess() === null) {
        try {
            const [clubsSnapshot, usersSnapshot] = await Promise.all([
                getDocs(collection(db, "club_data")),
                getDocs(collection(db, "user_data"))
            ]);

            // 1. Map each club doc into an object
            const clubs = clubsSnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));

            // 2. Gather all user IDs from each club’s favorites
            const allUserIds = new Set(); // No duplicates
            clubs.forEach(club => {
                if (Array.isArray(club.favorites)) {
                    club.favorites.forEach(userId => allUserIds.add(userId));
                }
            });
            console.log(allUserIds.size);

            // 3. Find users with favorites
            const users = usersSnapshot.docs
                .filter(docSnap => allUserIds.has(docSnap.id))
                .map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data()
                }));

            // 3. Update local caches
            setClubDataCache(clubs);
            setUserCache(users);


            window.dispatchEvent(new Event('dataInitialized')); // Signal that data is ready
        } catch (e) {
            console.error("Error initializing data:", e);
        }
    }

}

init();