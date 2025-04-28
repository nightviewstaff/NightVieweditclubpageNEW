// global.js
import {getClubSession, getSession} from "./session.js";

// Use `let` so the cache can be updated
let clubDataCache = null;
let usersWithfavoritesCache = null;
let usersWithOwnedClubs = null;
let staffUsersWithClubs = null;

// Export setter functions
export function setClubDataCache(data) {
    clubDataCache = data;
}

export function setUserCache(data) {
    usersWithfavoritesCache = data;
    console.log(usersWithfavoritesCache);
}

// Centralized function to get clubs based on user role
export function getClubs() {
    const session = getSession();
    console.log(session.uid)
    console.log(session.role)
    if (!session) return []; // Return empty array if no session
    if (!clubDataCache) return []; // Return empty if cache isn’t populated

    if (session.role === 'admin') {
        return clubDataCache; // Admins see all clubs
    } else {
        // Find the user in the cache
        const user = usersWithfavoritesCache ? usersWithfavoritesCache.find(u => u.id === session.uid) : null;
        const ownedClubIds = user?.owned_clubs || []; // Array of club IDs the user owns
        return clubDataCache.filter(club => ownedClubIds.includes(club.id)) || [];
    }
}

export function getUsersWithId(ids) {
    if (!usersWithfavoritesCache || !Array.isArray(ids)) return [];

    return usersWithfavoritesCache.filter(user => ids.includes(user.id));
}


// Placeholder for future function
export function getUsersWithClubAccess() {
    const clubsession = getClubSession();
//     // Return users who have access to the specified club
//     // Example: return usersWithfavoritesCache.filter(user => user.owned_clubs.includes(clubId));
    return usersWithOwnedClubs;
}

/*
// global.js
import { getClubSession, getSession } from "./session.js";

// Use `let` so the cache can be updated
let clubDataCache = null;
let usersCache = null;
let ownersByClubId = {}; // { clubId: [userId, userId] }
let staffByClubId = {};  // { clubId: [userId, userId] }

// Export setter functions
export function setClubDataCache(data) {
    clubDataCache = data;
}

export function setUserCache(data) {
    usersCache = data;
    console.log("🔵 User cache loaded:", usersCache);
    processUserRoles(data);
}

// Process users to find owners/staff for each club
function processUserRoles(users) {
    ownersByClubId = {};
    staffByClubId = {};

    users.forEach(user => {
        const { id, owned_clubs = [], staff_clubs = [] } = user;

        owned_clubs.forEach(clubId => {
            if (!ownersByClubId[clubId]) ownersByClubId[clubId] = [];
            ownersByClubId[clubId].push(id);
        });

        staff_clubs.forEach(clubId => {
            if (!staffByClubId[clubId]) staffByClubId[clubId] = [];
            staffByClubId[clubId].push(id);
        });
    });

    console.log("🔵 Owners mapped:", ownersByClubId);
    console.log("🔵 Staff mapped:", staffByClubId);
}

// Centralized function to get clubs based on user role
export function getClubs() {
    const session = getSession();
    if (!session) return [];
    if (!clubDataCache) return [];

    if (session.role === 'admin') {
        return clubDataCache; // Admin sees all
    } else {
        // Find the user
        const user = usersCache ? usersCache.find(u => u.id === session.uid) : null;
        const ownedClubIds = user?.owned_clubs || [];
        return clubDataCache.filter(club => ownedClubIds.includes(club.id)) || [];
    }
}

// Find users by IDs
export function getUsersWithId(ids) {
    if (!usersCache || !Array.isArray(ids)) return [];
    return usersCache.filter(user => ids.includes(user.id));
}

// Get owners for a specific club
export function getOwnersOfClub(clubId) {
    return ownersByClubId[clubId] || [];
}

// Get staff for a specific club
export function getStaffOfClub(clubId) {
    return staffByClubId[clubId] || [];
}

// Get both owners and staff combined
export function getUsersWithClubAccess(clubId) {
    const ownerIds = getOwnersOfClub(clubId);
    const staffIds = getStaffOfClub(clubId);
    const allIds = [...new Set([...ownerIds, ...staffIds])]; // Unique merge
    return getUsersWithId(allIds);
}


 */