import {db, getDownloadURL, getStorage, ref} from '../api/firebase-api.js';
import {collection, getDocs} from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js';
import {getSession, saveClubSession} from "./session.js";
import {clubDataCache,setClubDataCache} from "./global.js";

document.addEventListener("DOMContentLoaded", () => {
    const session = getSession(); // 👉 wrapped localStorage logic

    if (session) {
        const nav = document.querySelector('nav-bar');
        if (nav && typeof nav.setUser === 'function') {
            nav.setUser({uid: session.uid}, session.role);
        }
    }
});

class NavBar extends HTMLElement {
    constructor() {
        super();
        this.user = null;
        this.userRole = 'user';
    }

    setUser(user, role) {
        this.user = user;
        this.userRole = role;
        window.currentUser = {uid: user.uid, role};
        Object.freeze(window.currentUser);
        this.updateNavbarVisibility(window.location.pathname.includes('login.html'));
        if (['admin', 'owner'].includes(role)) {
            this.populateClubSelector(user.uid);
            this.updateProfilePicture(user.uid);
        }
    }

    async connectedCallback() {
        const isLoginPage = window.location.pathname.includes('login.html');

        this.innerHTML = `
            <nav>
                <div class="navbar-logo">
                    <a href="https://night-view.dk/" target="_blank">
                        <img id="navbar-logo" src="../../images/nightview/logo_text.png" alt="Logo">
                    </a>
                </div>
                ${!isLoginPage ? `
                <div class="nav">
                    <ul class="anchor-container">
                        <li><a href="#page1">Club Data</a></li>
                        <li><a href="#page2">User Data</a></li>
                        <li class="admin-link" style="display:none;"><a href="#admin">Admin</a></li>
                        <li>
                            <select id="club-selector">
                                <option disabled selected>Choose Club</option>
                            </select>
                        </li>
                    </ul>
                </div>` : ''}
                <div class="navbar-right">
                    <ul id="navbar-right-column">
                        ${!isLoginPage ? `
                        <li class="profile-pic-item" style="display:none;">
                            <img id="profile-pic" src="../../images/users/default_user_pb.jpg" alt="Profile Picture">
                        </li>` : ''}
                        <li>
                            <img id="language-flag" src="../../images/flags/dk.png" alt="Language" class="lang-flag">
                        </li>
                    </ul>
                </div>
            </nav>
        `;
    }

    async populateClubSelector(uid) {
        const selector = this.querySelector('#club-selector');
        let firstValidClubId = null;

        try {
            const querySnapshot = await getDocs(collection(db, "club_data"));
            const validClubs = [];

            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                const isAdmin = this.userRole === 'admin';
                const isOwner = Array.isArray(data.owners) && data.owners.includes(uid);

                if (isAdmin || isOwner) {
                    const opt = document.createElement('option');
                    opt.value = docSnap.id;
                    opt.textContent = data.displayName || data.name || docSnap.id;
                    selector.appendChild(opt);

                    validClubs.push({ id: docSnap.id, ...data });

                    if (!firstValidClubId) {
                        firstValidClubId = docSnap.id;
                    }
                }
            });

            if (!clubDataCache) {
                setClubDataCache(validClubs);
            }
        } catch (e) {
            console.error("Error populating clubs:", e);
        }

        // Set default club
        const storedClubId = sessionStorage.getItem('selectedClubId');
        if (storedClubId && selector.querySelector(`option[value="${storedClubId}"]`)) {
            selector.value = storedClubId;
        } else if (firstValidClubId) {
            selector.value = firstValidClubId;
            sessionStorage.setItem('selectedClubId', firstValidClubId);
            window.dispatchEvent(new Event('clubChanged'));
        }

        // Watch for changes
        selector.addEventListener('change', (event) => {
            const selectedClubId = event.target.value;
            saveClubSession(selectedClubId);
            window.dispatchEvent(new Event('clubChanged'));
        });
    }

    async updateProfilePicture(uid) {
        const storage = getStorage();
        const imageRef = ref(storage, `pb/${uid}.jpg`);
        try {
            const url = await getDownloadURL(imageRef);
            const pic = this.querySelector('#profile-pic');
            if (pic) pic.src = url;
        } catch {
            console.log("Using default profile picture.");
        }
    }

    updateNavbarVisibility(isLoginPage) {
        const adminLink = this.querySelector('.admin-link');
        const profilePicItem = this.querySelector('.profile-pic-item');

        if (adminLink) adminLink.style.display = this.userRole === 'admin' && !isLoginPage ? 'list-item' : 'none';
        if (profilePicItem) profilePicItem.style.display = this.user && !isLoginPage ? 'list-item' : 'none';
    }
}

customElements.define('nav-bar', NavBar);
