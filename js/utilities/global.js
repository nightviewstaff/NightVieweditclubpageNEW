// global.js

import {getClubSession, getSession} from "/js/utilities/session.js";

// In-memory caches
let allVisibleLocations = null;
let relevantOwnersIds = null;
let relevantStaffIds = null;
let relevantFavoriteUsersIds = null;

//TODO THINK! Only get those who are needed. Get owners, staff and favorites from accessable clubs!
// let adminUsers = null;

// === SETTERS ===

export function setAllVisibleLocations(allRelevantLocationsData) {
    const session = getSession();
    if (!session) return;

    allVisibleLocations = allRelevantLocationsData;
}

//TODO IS IDS
export function setOwnerUsers(data) {
    relevantOwnersIds = data;
    console.log(relevantOwnersIds)
}

export function setStaffUsers(data) {
    relevantStaffIds = data;
    console.log(relevantStaffIds)
}

export function setUsersWithFavorites(data) {
    relevantFavoriteUsersIds = data;
    console.log(relevantFavoriteUsersIds)
}

// === GETTERS ===

export function getAllVisibleLocations() {
    return allVisibleLocations ?? [];
}

export function getFavoriteUsersWithId(ids) {
    if (!relevantFavoriteUsersIds || !Array.isArray(ids)) return [];
    return relevantFavoriteUsersIds.filter(id => ids.includes(id));
}


export function getOwnersForLocation() {
    const clubId = getClubSession();
    if (!clubId || !relevantOwnersIds) return [];
    const club = getAllVisibleLocations().find(club => club.id === clubId);
    if (!club || !Array.isArray(club.owners)) return [];

    return relevantOwnersIds.filter(id => club.owners.includes(id));
}


export function getStaffForLocation() {
    const clubId = getClubSession();
    if (!clubId || !relevantStaffIds) return [];
    const club = getAllVisibleLocations().find(club => club.id === clubId);
    if (!club || !Array.isArray(club.staff)) return [];

    return relevantStaffIds.filter(id => club.staff.includes(id));
}


export function isDataInitialized() {
    return (
        Array.isArray(allVisibleLocations) &&
        Array.isArray(relevantOwnersIds) &&
        Array.isArray(relevantStaffIds) &&
        Array.isArray(relevantFavoriteUsersIds)
    );
}






