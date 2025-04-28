// navbar.js
import {db, getDownloadURL, getStorage, ref} from '../api/firebase-api.js';
import {doc, updateDoc} from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js';
import {clearSession, getSession, saveClubSession} from "./session.js";
import {getClubs} from "./global.js"; // Only import what you need
import {toTitleCase} from "./utility.js";

document.addEventListener("DOMContentLoaded", () => {
    const session = getSession();
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
        this.selectedClubId = null;
    }

    setUser(user, role) {
        this.user = user;
        this.userRole = role;
        window.currentUser = {uid: user.uid, role};
        Object.freeze(window.currentUser);
        this.updateNavbarVisibility(window.location.pathname.includes('login.html'));
        if (['admin', 'owner', 'staff'].includes(role)) {
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
            <ul class="anchor-container">
                <li><a href="/NightVieweditclubpage/html/club-overview.html">Club Data</a></li>
                <li><a href="/NightVieweditclubpage/html/user-data.html">User Data</a></li>
                <li class="admin-link" style="display:none;"><a href="/NightVieweditclubpage/html/admin-page.html">Admin</a></li>
            </ul>
            <ul class="selector-container">
                <li>
                    <select id="club-selector">
                        <option disabled selected>Clubs</option>
                    </select>
                </li>
                <li>
                    <select id="user-selector">
                        <option disabled selected>Staff</option>
                    </select>
                </li>
            </ul>` : ''}
            <div class="navbar-right">
                <ul id="navbar-right-column">
                    ${!isLoginPage ? `
                    <li class="profile-pic-item" style="display:none;">
                        <img id="profile-pic" src="../../images/users/default_user_pb.jpg" alt="Profile Picture">
                    </li>` : ''}
                    <li>
                        <img id="language-flag" src="../../images/flags/uk.png" alt="Language" class="lang-flag">
                    </li>
                </ul>
            </div>
        </nav>
        
<!--        TODO ADD STAFF LOGIC-->

        ${!isLoginPage ? `
        <div id="profile-dropdown" class="profile-dropdown hidden">
            <ul>
                <li id="logout-button">Log out</li>
            </ul>
        </div>` : ''}

        <style>
            .profile-dropdown {
            color: var(--night-view-green);
                position: absolute;
                top: 120px;
                right: 20px;
                border: 1px solid #ddd;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                width: 8vw;
                z-index: 999;
            }
            .profile-dropdown ul {
                list-style: none;
                margin: 0;
                padding: 10px 0;
            }
            .profile-dropdown li {
                padding: 10px 20px;
                cursor: pointer;
                font-weight: bold;
                font-size: large;
            }
            .profile-dropdown li:hover {
                background-color: var(--night-view-purple);
            }
            .hidden {
                display: none;
            }
        </style>
    `;

        const clubSelector = this.querySelector('#club-selector');
        if (clubSelector) {
            clubSelector.addEventListener('change', (event) => {
                this.selectedClubId = event.target.value;
                this.populateUserSelector(this.selectedClubId);
            });
        }

        if (!isLoginPage) {
            const profilePic = this.querySelector('#profile-pic');
            const dropdown = this.querySelector('#profile-dropdown');
            const logoutButton = this.querySelector('#logout-button');

            profilePic?.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!this.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });

            logoutButton?.addEventListener('click', () => {
                clearSession();
                window.location.href = '/NightVieweditclubpage/html/login.html';
            });
        }
    }



    async populateClubSelector(uid) {
        const selector = this.querySelector('#club-selector');
        let firstValidClubId = null;

        // Wait for cache if it’s not ready
        if (getClubs().length === 0) {
            await new Promise(resolve => window.addEventListener('dataInitialized', resolve, {once: true}));
        }

        const validClubs = getClubs().map(club => ({
            id: club.id,
            name: toTitleCase(club.displayName || club.name || club.id),
            rawData: club
        }));

        selector.innerHTML = '';
        const addClubOption = document.createElement('option');
        addClubOption.value = 'add-new';
        addClubOption.textContent = '➕ Add Club';
        selector.appendChild(addClubOption);

        validClubs.sort((a, b) => a.name.localeCompare(b.name));
        validClubs.forEach(({id, name}) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = name;
            selector.appendChild(opt);
            if (!firstValidClubId) firstValidClubId = id;
        });

        const storedClubId = sessionStorage.getItem('selectedClubId');
        if (storedClubId && selector.querySelector(`option[value="${storedClubId}"]`)) {
            selector.value = storedClubId;
            this.selectedClubId = storedClubId;
            this.populateUserSelector(this.selectedClubId);
        } else if (firstValidClubId) {
            selector.value = firstValidClubId;
            sessionStorage.setItem('selectedClubId', firstValidClubId);
            this.selectedClubId = firstValidClubId;
            this.populateUserSelector(this.selectedClubId);
            window.dispatchEvent(new Event('clubChanged'));
        }

        selector.addEventListener('change', (event) => {
            const selectedClubId = event.target.value;
            saveClubSession(selectedClubId);
            window.dispatchEvent(new Event('clubChanged'));
        });
    }

    async populateUserSelector(clubId) {
        const userSelector = this.querySelector('#user-selector');
        userSelector.innerHTML = '';

        if (['admin', 'owner'].includes(this.userRole)) {
            const addUserOption = document.createElement('option');
            addUserOption.value = 'add-user';
            addUserOption.textContent = '➕ Add Staff';
            userSelector.appendChild(addUserOption);
        }

        if (clubId && clubId !== 'add-new') {
            const club = getClubs().find(c => c.id === clubId);
            const owners = club?.owners || [];
            const staff = club?.staff || [];

            const users = [...new Set([...owners, ...staff])]; // Unique user ids

            if (users.length > 0) {
                if (!userCache) {
                    await new Promise(resolve => window.addEventListener('dataInitialized', resolve, {once: true}));
                }
                const clubUsers = userCache.filter(user => users.includes(user.id));
                clubUsers.forEach(user => {
                    const opt = document.createElement('option');
                    opt.value = user.id;
                    opt.textContent = user.name || user.id;
                    userSelector.appendChild(opt);
                });
            }
        }

        userSelector.addEventListener('change', (event) => {
            if (event.target.value === 'add-user') {
                this.addStaffToClub(clubId);
            }
            userSelector.value = 'Staff'; // Reset after action
        });
    }

    async addStaffToClub(clubId) {
        const userEmail = prompt("Enter the email of the user to add:");
        if (!userEmail) return;

        try {
            // Ensure userCache is loaded
            if (!window.userCache) {
                await new Promise(resolve => window.addEventListener('dataInitialized', resolve, {once: true}));
            }

            // Find the user by email
            const user = window.userCache.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());

            if (!user) {
                alert("❌ No user found with that email.");
                return;
            }

            const userId = user.id;
            const club = getClubs().find(c => c.id === clubId);

            if (!club) {
                alert("❌ Club not found.");
                return;
            }

            const staff = Array.isArray(club.staff) ? club.staff : [];

            if (staff.includes(userId)) {
                alert("⚠️ User is already a staff member.");
                return;
            }

            // Add user to staff
            staff.push(userId);

            // Update Firestore
            const clubDocRef = doc(db, "club_data", clubId);
            await updateDoc(clubDocRef, { staff });

            // Update local data
            club.staff = staff;

            alert(`✅ Successfully added ${user.email} as staff.`);

            // Refresh the staff selector
            await this.populateUserSelector(clubId);

        } catch (error) {
            console.error("❌ Error adding staff:", error);
            alert("An error occurred while adding staff. Try again.");
        }
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