// session.js
export function saveSession(uid, role) {
    sessionStorage.setItem('userUid', uid);
    sessionStorage.setItem('userRole', role);
}

export function saveUserSession(user) {
    sessionStorage.setItem('user', JSON.stringify(user));
}

export function saveClubSession(selectedClubId) {
    sessionStorage.setItem('selectedClubId', selectedClubId);
}

export function saveAllLocationsSession(allLocations) {
    sessionStorage.setItem('allLocations', JSON.stringify(allLocations));
}

export function getAllLocations() {
    const cached = sessionStorage.getItem('allLocations');
    return cached ? JSON.parse(cached) : null;
}

export function getSession() {
    const uid = sessionStorage.getItem('userUid');
    const role = sessionStorage.getItem('userRole');
    return uid && role ? { uid, role } : null;
}

export function getUser() {
    const raw = sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
}


export function getClubSession() {
    return sessionStorage.getItem('selectedClubId');
}

export function checkSession() {
    const session = getSession();
    if (!session) {
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

export function clearSession() {
    sessionStorage.clear();
    localStorage.clear();
}

