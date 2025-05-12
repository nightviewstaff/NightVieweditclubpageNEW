import {fetchRelevantClubsByIds, fetchUsersByIds} from '../api/firebase-api.js';
import {
    getAllVisibleLocations,
    isDataInitialized,
    setAllVisibleLocations,
    setOwnerUsers,
    setStaffUsers,
    setUsersWithFavorites
} from './global.js';
import {checkSession} from "./session.js";

//TODO add loader while init.

export async function init() {
    const isLoginPage = window.location.pathname.includes('login.html');
    if (!isLoginPage) {
        if (!checkSession()) return;
        console.log("🔄 Initializing global data...");
    }

    try {
        if (isDataInitialized()) {
            console.log("✅ Data already initialized: " + isDataInitialized());
            return;
        }

        //TODO Cache users at some point!

        const allRelevantClubs = await fetchRelevantClubsByIds();
        console.log(allRelevantClubs);
        setAllVisibleLocations(allRelevantClubs);

        const ownerIds = new Set();
        const staffIds = new Set();
        const favoriteIds = new Set();

        getAllVisibleLocations().forEach(club => {
            (club.owners || []).forEach(id => ownerIds.add(id));
            (club.staff || []).forEach(id => staffIds.add(id));
            (club.favorites || []).forEach(id => favoriteIds.add(id));
        });

        setOwnerUsers(Array.from(ownerIds));
        setStaffUsers(Array.from(staffIds));
        setUsersWithFavorites(Array.from(favoriteIds));

        window.dispatchEvent(new Event("dataInitialized"));
    } catch (e) {
        console.error("❌ Error initializing global data:", e);
        window.dispatchEvent(new Event("dataInitialized"));
    }
}


// Auto-run init for non-login pages
(function () {
    if (!window.location.pathname.includes('login.html')) {
        init();
    }
})();