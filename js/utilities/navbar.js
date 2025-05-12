import {
    arrayUnion,
    collection,
    db,
    doc,
    getDocs,
    getDownloadURL,
    getStorage,
    ref,
    updateDoc
} from '../api/firebase-api.js';
import {checkSession, clearSession, getClubSession, getSession, saveClubSession} from "./session.js";
import {getAllVisibleLocations, isDataInitialized} from "./global.js";
import {toTitleCase} from "./utility.js";
import {databaseCollections, actualRoles} from "./constants.js";
import {init} from "./init.js";

class NavBar extends HTMLElement {
    connectedCallback() {
        const isLoginPage = window.location.pathname.includes('login.html');

        // Render navbar structure immediately
        this.innerHTML = `
            <nav>
                <div class="navbar-logo">
                    <a href="https://night-view.dk/" target="_blank">
                        <img id="navbar-logo" src="../../images/nightview/logo_text.png" alt="Logo">
                    </a>
                </div>
                ${!isLoginPage ? `
                <ul class="anchor-container">
                    <li><a href="/NightVieweditclubpage/html/club-overview.html">Location Data</a></li>
                    <li><a href="/NightVieweditclubpage/html/notifications.html">Notifications</a></li>
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
            ${!isLoginPage ? `
            <div id="profile-dropdown" class="profile-dropdown hidden">
                <ul>
                    <li id="logout-button">Log out</li>
                </ul>
            </div>
            <div id="add-staff-modal" class="modal-overlay hidden">
                <div class="modal-content">
                    <button class="close-button">×</button>
                    <h2>Add Staff Member</h2>
                    <input type="text" id="staff-search" placeholder="Search by email..." />
                    <div id="search-results"></div>
                </div>
            </div>
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
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background-color: rgba(0,0,0,0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .modal-content {
                    background: white;
                    padding: 2em;
                    border-radius: 10px;
                    max-width: 600px;
                    width: 100%;
                    position: relative;
                }
                .close-button {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    background: #e74c3c;
                    border: none;
                    color: white;
                    font-size: 1.5rem;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.3s ease;
                }
                .close-button:hover {
                    background: #c0392b;
                }
                #search-results {
                    margin-top: 1em;
                    max-height: 200px;
                    overflow-y: auto;
                }
                .search-result-item {
                    padding: 0.5em;
                    border-bottom: 1px solid #eee;
                    cursor: pointer;
                }
                .search-result-item:hover {
                    background-color: #f0f0f0;
                }
                .hidden {
                    display: none;
                }
            </style>` : ''}`;

        if (!isLoginPage) {
            // Attach event listeners immediately
            const clubSelector = this.querySelector('#club-selector');
            clubSelector.addEventListener('change', (event) => {
                this.selectedClubId = event.target.value;
                this.populateUserSelector(this.selectedClubId);
            });

            const profilePic = this.querySelector('#profile-pic');
            const dropdown = this.querySelector('#profile-dropdown');
            const logoutButton = this.querySelector('#logout-button');
            const modal = this.querySelector('#add-staff-modal');
            const closeButton = this.querySelector('.close-button');
            const searchInput = this.querySelector('#staff-search');

            profilePic.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!this.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });

            logoutButton.addEventListener('click', () => {
                clearSession();
                window.location.href = '/NightVieweditclubpage/html/login.html';
            });

            closeButton.addEventListener('click', () => {
                modal.classList.add('hidden');
            });

            searchInput.addEventListener('input', (e) => {
                this.searchUsers(e.target.value);
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });

            // Populate dynamic content asynchronously
            const initializeNavbar = async () => {
                const uid = getSession().uid;
                await this.populateClubSelector(uid);
                this.updateProfilePicture(uid); // Non-blocking
                this.updateNavbarVisibility(isLoginPage);
            };

            if (isDataInitialized()) {
                initializeNavbar();
            } else {
                window.addEventListener('dataInitialized', initializeNavbar, { once: true });
            }
        }
    }

    async populateClubSelector(uid) {
        const selector = this.querySelector('#club-selector');
        let firstValidClubId = null;

        if (getAllVisibleLocations().length === 0) {
            //TODO Put logic here.
            await new Promise(resolve => window.addEventListener('dataInitialized', resolve, {once: true}));
        }

        const validClubs = getAllVisibleLocations().map(club => ({
            id: club.id,
            name: club.displayName || toTitleCase(club.name || club.id),
            rawData: club
        }));

        selector.innerHTML = '';
        const addClubOption = document.createElement('option');
        addClubOption.value = 'add-new';
        addClubOption.textContent = '➕ Add Location';
        selector.appendChild(addClubOption);

        validClubs.sort((a, b) => a.name.localeCompare(b.name));
        validClubs.forEach(({id, name}) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = name;
            selector.appendChild(opt);
            if (!firstValidClubId) firstValidClubId = id;
        });

        const storedClubId = getClubSession();
        if (storedClubId && selector.querySelector(`option[value="${storedClubId}"]`)) {
            selector.value = storedClubId;
            this.selectedClubId = storedClubId;
            this.populateUserSelector(this.selectedClubId);
        } else if (firstValidClubId) {
            selector.value = firstValidClubId;
            saveClubSession(firstValidClubId);
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
        if (window.location.pathname.includes('login.html')) return;

        const userSelector = this.querySelector('#user-selector');
        userSelector.innerHTML = '<option disabled selected>Staff</option>';

        if (!['admin', 'owner'].includes(this.userRole)) return;

        const addUserOption = document.createElement('option');
        addUserOption.value = 'add-staff';
        addUserOption.textContent = '➕ Add Staff';
        userSelector.appendChild(addUserOption);

        if (!clubId || clubId === 'add-new') return;

        const club = getAllVisibleLocations().find(c => c.id === clubId);
        if (!club) return;

        const ownerIds = new Set(club.owners || []);
        const staffIds = new Set(club.staff || []);

        const users = (window.userCache || []).filter(user =>
            ownerIds.has(user.id) || staffIds.has(user.id)
        );

        users.sort((a, b) => {
            const aIsOwner = ownerIds.has(a.id);
            const bIsOwner = ownerIds.has(b.id);
            if (aIsOwner && !bIsOwner) return -1;
            if (!aIsOwner && bIsOwner) return 1;
            return a.email.localeCompare(b.email);
        });

        users.forEach(user => {
            const opt = document.createElement('option');
            opt.value = user.id;
            const label = ownerIds.has(user.id) ? '👑 Owner' : '👤 Staff';
            opt.textContent = `${user.email} (${label}${user.name ? ` – ${user.name}` : ''})`;
            userSelector.appendChild(opt);
        });

        userSelector.selectedIndex = 0;

        if (!userSelector.dataset.listenerAttached) {
            userSelector.addEventListener('change', (event) => {
                if (event.target.value === 'add-staff') {
                    this.showAddStaffModal();
                    setTimeout(() => userSelector.selectedIndex = 0, 0);
                }
            });
            userSelector.dataset.listenerAttached = "true";
        }
    }

    showAddStaffModal() {
        console.log('showAddStaffModal called. Club ID:', this.selectedClubId);
        const clubId = this.selectedClubId;
        if (!clubId || clubId === 'add-new') {
            showAlert({
                title: 'No Location Selected',
                text: 'Please select a club first.',
                icon: swalTypes.warning
            });
            return;
        }

        const modal = this.querySelector('#add-staff-modal');
        const searchInput = this.querySelector('#staff-search');
        const searchResults = this.querySelector('#search-results');

        searchInput.value = '';
        searchResults.innerHTML = '';
        modal.classList.remove('hidden');
        searchInput.focus();
    }

    async searchUsers(query) {
        const searchResults = this.querySelector('#search-results');
        searchResults.innerHTML = '';
        const clubId = this.selectedClubId;

        if (!query.trim()) {
            searchResults.innerHTML = '<div class="info-message">Start typing to search for staff members</div>';
            return;
        }

        if (!clubId) return;

        try {
            if (!window.userCache) {
                console.error("User cache not loaded");
                return;
            }

            const club = getAllVisibleLocations().find(c => c.id === clubId);
            const existingStaff = new Set([...(club?.staff || []), ...(club?.owners || [])]);

            searchResults.innerHTML = '<div class="info-message">Searching...</div>';
            await new Promise(resolve => setTimeout(resolve, 200));

            const matchingUsers = window.userCache.filter(user => {
                const emailMatch = user.email?.toLowerCase().includes(query.toLowerCase());
                const exactMatch = user.email?.toLowerCase() === query.toLowerCase();
                return emailMatch && !existingStaff.has(user.id) && exactMatch;
            });

            searchResults.innerHTML = '';

            if (query.length < 3) {
                searchResults.innerHTML = '<div class="warning-message">Type at least 3 characters to search</div>';
                return;
            }

            if (matchingUsers.length === 0) {
                searchResults.innerHTML = `
                <div class="error-message">
                    No users found for "${query}"
                    <div class="suggestion">Check for typos or try a different email</div>
                </div>`;
                return;
            }

            const countBadge = document.createElement('div');
            countBadge.className = 'result-count';
            countBadge.textContent = `${matchingUsers.length} ${matchingUsers.length === 1 ? 'match' : 'matches'} found`;
            searchResults.appendChild(countBadge);

            matchingUsers.forEach(user => {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                const email = user.email;
                const matchIndex = email.toLowerCase().indexOf(query.toLowerCase());
                const beforeMatch = email.slice(0, matchIndex);
                const matchText = email.slice(matchIndex, matchIndex + query.length);
                const afterMatch = email.slice(matchIndex + query.length);

                div.innerHTML = `
                <div class="user-email">
                    ${beforeMatch}<strong>${matchText}</strong>${afterMatch}
                </div>
                <div class="user-name">${user.name || 'No name provided'}</div>
            `;
                div.addEventListener('click', () => this.addStaffToClub(user));
                searchResults.appendChild(div);
            });
        } catch (error) {
            console.error("Search error:", error);
            searchResults.innerHTML = '<div class="error-message">Error searching users. Please try again.</div>';
        }
    }

    createStatusMessage(text, type = 'info') {
        const message = document.createElement('div');
        message.className = `status-message ${type}-message`;
        message.innerHTML = `
            <span class="status-icon">${this.getStatusIcon(type)}</span>
            ${text}
        `;
        return message;
    }

    getStatusIcon(type) {
        const icons = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅'
        };
        return icons[type] || '';
    }

    async addStaffToClub(user) {
        const clubId = this.selectedClubId;
        if (!clubId) {
            showAlert({
                title: 'No Location Selected',
                text: 'Please select a club first.',
                icon: swalTypes.warning
            });

            return;
        }

        try {
            const clubDocRef = doc(db, databaseCollections.clubData, clubId);
            await updateDoc(clubDocRef, {
                staff: arrayUnion(user.id)
            });

            const club = getAllVisibleLocations().find(c => c.id === clubId);
            if (club) {
                club.staff = [...(club.staff || []), user.id];
            }

            showAlert({
                title: 'Staff Added!',
                text: `Successfully added ${user.email} as staff!`,
                icon: swalTypes.success
            });
            this.querySelector('#add-staff-modal').classList.add('hidden');
            this.populateUserSelector(clubId);
        } catch (error) {
            console.error("Add staff error:", error);
            showAlert({
                title: 'Add Staff Failed',
                text: 'Failed to add staff member.',
                icon: swalTypes.error
            });
        }
    }

    async updateProfilePicture(uid) {
        const cachedUrl = sessionStorage.getItem(`profilePic_${uid}`); // TODO Move to session
        const pic = this.querySelector('#profile-pic');
        if (cachedUrl && pic) {
            pic.src = cachedUrl;
            return;
        }

        const storage = getStorage();
        const imageRef = ref(storage, `pb/${uid}.jpg`);
        try {
            const url = await getDownloadURL(imageRef);
            if (pic) {
                pic.src = url;
                sessionStorage.setItem(`profilePic_${uid}`, url); // Cache the URL //TODO move to session.
            }
        } catch (e) {
            console.log("Using default profile picture: " + e);
        }
    }

    updateNavbarVisibility(isLoginPage) {
        const adminLink = this.querySelector('.admin-link');
        const profilePicItem = this.querySelector('.profile-pic-item');

        if (adminLink) adminLink.style.display = getSession().role === 'admin' && !isLoginPage ? 'list-item' : 'none';
        if (profilePicItem) profilePicItem.style.display = !isLoginPage ? 'list-item' : 'none';
    }

    get ready() {
        return this._ready;
    }
}

customElements.define('nav-bar', NavBar);