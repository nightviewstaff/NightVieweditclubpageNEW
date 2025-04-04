// session.js
export function saveSession(uid, role) {
    sessionStorage.setItem('userUid', uid);
    sessionStorage.setItem('userRole', role);
}

export function saveClubSession(selectedClubId) {
    sessionStorage.setItem('selectedClubId', selectedClubId);
}

export function getSession() {
    const uid = sessionStorage.getItem('userUid');
    const role = sessionStorage.getItem('userRole');
    return uid && role ? {uid, role} : null;
}

export function getClubSession() {
    return sessionStorage.getItem('selectedClubId');
}

export function clearSession() {
    sessionStorage.clear();
}

