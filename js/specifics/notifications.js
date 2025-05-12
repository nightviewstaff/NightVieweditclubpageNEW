// notifications.js

import {getClubSession, getSession} from "../utilities/session.js";
import {getAllVisibleLocations} from '../utilities/global.js';
import {
    calculateUserAge, formatDayDifference,
    formatFiltersReadable,
    formatFullDateTime, getNextDefaultPartyDay,
    getUserGender,
    getUserNationality
} from "../utilities/utility.js";
import {
    deleteNotificationById,
    fetchScheduledNotificationsForClub,
    fetchUserById,
    fetchUsersByIds,
    uploadNotification
} from "../api/firebase-api.js";
import {swalTypes} from "../utilities/constants.js";
import {showAlert} from "../utilities/custom-alert.js";

const genderOptions = ['F', 'M'];
const nationalityOptions = ['Danish', 'International'];

let ageMap = {};
let totalSelected = 0;


document.addEventListener("DOMContentLoaded", async () => {
    const clubId = getClubSession();
    const club = getAllVisibleLocations().find(c => c.id === clubId);
    const followerIds = club?.favorites || []; // Array of user IDs

    // Assuming a function exists to get user objects by IDs (not provided in your code)
    const followers = await fetchUsersByIds(followerIds); // You need to implement this


    const totalDanishUsersNumber = followers.filter(u => getUserNationality(u) === 'Danish').length;
    const totalInternationalUsersNumber = followers.filter(u => getUserNationality(u) === 'International').length;

    const nextDefaultDay = getNextDefaultPartyDay();
    const dateInput = document.getElementById('notification-scheduled-for');
    if (dateInput) {
        const year = nextDefaultDay.getFullYear();
        const month = String(nextDefaultDay.getMonth() + 1).padStart(2, '0');
        const day = String(nextDefaultDay.getDate()).padStart(2, '0');
        const hour = String(nextDefaultDay.getHours()).padStart(2, '0');
        const minute = String(nextDefaultDay.getMinutes()).padStart(2, '0');

        dateInput.value = `${year}-${month}-${day}T${hour}:${minute}`;
    }

    ageMap = bucketUsersByAge(followers || []);

    await loadScheduledNotifications()
    updateTotalFollowers();
    buildFilterGrid();
    updateTotalSelected();

    document.getElementById('all-age')?.addEventListener('click', () => toggleAllCells('age'));
    document.getElementById('all-female')?.addEventListener('click', () => toggleAllCells('female'));
    document.getElementById('all-male')?.addEventListener('click', () => toggleAllCells('male'));
    document.getElementById('all-danish')?.addEventListener('click', () => toggleAllCells('danish'));
    document.getElementById('all-international')?.addEventListener('click', () => toggleAllCells('international'));
});

window.addEventListener("clubChanged", async () => {
    console.log("Club changed – reloading data...");

    const clubId = getClubSession();
    const club = getAllVisibleLocations().find(c => c.id === clubId);
    const followerIds = club?.favorites || [];

    const followers = await fetchUsersByIds(followerIds);
    ageMap = bucketUsersByAge(followers || []);

    await loadScheduledNotifications()
    updateTotalFollowers();
    buildFilterGrid();
    updateTotalSelected();
});

async function loadScheduledNotifications() {
    const clubId = getClubSession();
    const container = document.querySelector('.scheduled-notifications');
    container.innerHTML = '<p>Loading...</p>';

    try {
        const notifications = await fetchScheduledNotificationsForClub(clubId);

        if (notifications.length === 0) {
            container.innerHTML = '<p>No upcoming scheduled notifications.</p>';
            return;
        }

        const table = document.createElement('table');
        table.classList.add('scheduled-table');

        table.innerHTML = `
            <thead>
                <tr>
                    <th>Scheduled For</th>
                    <th>Header</th>
                    <th>Message</th>
                    <th>Filters</th>
                    <th>Creation Date</th>
                    <th>Created By</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${notifications.map(n => {
            const filters = formatFiltersReadable(n.filters);
            
            //TODO Figure out smart way to show whole message if very long.

            return `
            <tr>
            <td>${formatDayDifference(n.scheduled_for)}<br>${formatFullDateTime(n.scheduled_for)}</td>
            <td class="truncate-cell" data-fulltext="${n.header || ''}">${n.header || ''}</td>
<td class="truncate-cell" data-fulltext="${n.message}">${n.message}</td>
                            <td><pre>${filters}</pre></td>
                            
                            <td>${formatDayDifference(n.created_at.toDate())}<br>${formatFullDateTime(n.created_at.toDate())}</td>
                         <td data-user-id="${n.created_by}">Loading...</td>

                              <td>
            <button class="button button-reset" data-id="${n.id}">Delete</button>
        </td>
                        </tr>
                    `;
        }).join('')}
            </tbody>
        `;

        container.innerHTML = '';
        container.appendChild(table);

        const creatorCells = container.querySelectorAll('[data-user-id]');

        for (const cell of creatorCells) {
            const uid = cell.dataset.userId;
            try {
                const user = await fetchUserById(uid);
                const firstName = user?.first_name || '';
                const lastName = user?.last_name || '';
                const fullName = (firstName + ' ' + lastName).trim();
                const mail = user?.mail || '';

                if (fullName && mail) {
                    cell.innerHTML = `${fullName}<br>${mail}`;
                    cell.setAttribute('data-fulltext', `${fullName} (${mail})`);
                } else if (fullName) {
                    cell.textContent = fullName;
                    cell.setAttribute('data-fulltext', fullName);
                } else if (mail) {
                    cell.textContent = mail;
                    cell.setAttribute('data-fulltext', mail);
                } else {
                    cell.textContent = 'Unknown';
                    cell.setAttribute('data-fulltext', 'Unknown');
                }
            } catch (error) {
                console.error(`Failed to fetch user with ID ${uid}:`, error);
                cell.textContent = 'Unknown';
                cell.setAttribute('data-fulltext', 'Unknown');
            }
        }


// 🔥 Attach delete listeners
        container.querySelectorAll('.button-reset').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const result = await showAlert({
                    title: 'Delete Notification?',
                    html: '<p>This cannot be undone. Are you sure?</p>',
                    icon: swalTypes.warning,
                    confirmText: 'Yes, delete it',
                    cancelText: 'Cancel',
                    showCancel: true, // 💡 This is what makes it a "confirm" dialog now
                    confirmButtonColor: 'var(--color-red)',            // Red confirm
                    cancelButtonColor: 'var(--night-view-green)'
                });
                if (!result.isConfirmed) return;

                try {
                    await deleteNotificationById(id);
                    showAlert({
                        title: 'Notification Deleted',
                        text: `The notification was successfully removed.`, // TODO Show day when deleting.
                        icon: swalTypes.success,
                    });          // Re-render table
                    await loadScheduledNotifications();
                } catch (err) {
                    console.error(`❌ Failed to delete notification ${id}:`, err);
                    alert("Error deleting notification. See console for details.");
                }
            });
        });


    } catch (err) {
        console.error('Failed to fetch notifications:', err);
        container.innerHTML = '<p class="error">Error loading notifications. See console for details.</p>';
    }
}


function bucketUsersByAge(users) {
    const ageMap = {};

    users.forEach(user => {
        const age = calculateUserAge(user);
        const bucket = age <= 34 ? age : '35+';
        if (!ageMap[bucket]) ageMap[bucket] = [];
        ageMap[bucket].push(user);
    });

    return ageMap;
}

function updateTotalFollowers() {
    const clubId = getClubSession();
    const club = getAllVisibleLocations().find(c => c.id === clubId);
    const totalFolowers = club?.favorites?.length || 0;

    document.querySelectorAll('#total-followers-0, #total-followers-1')
        .forEach(el => el.textContent = totalFolowers);
}

// Create a generic toggle cell that toggles the "active" class on click
function createToggleCell(text, className, onToggle) {
    const cell = document.createElement('div');
    cell.className = `grid-cell ${className}`;
    cell.textContent = text;

    cell.addEventListener('click', () => {
        if (cell.classList.contains('disabled')) return; // 🚫 Don't toggle disabled cells

        cell.classList.toggle('active');
        if (typeof onToggle === 'function') onToggle();
        updateAllButtonsState();
    });
    return cell;
}

// Update the "Chosen" count for a given row:
function updateRowCount(row) {
    const age = row.dataset.age;
    const users = ageMap[age] || [];
    const ageCell = row.querySelector(".age-filter");
    const selectedGenders = Array.from(row.querySelectorAll(".gender-filter.active")).map(cell => cell.dataset.raw);
    const selectedNationalities = Array.from(row.querySelectorAll(".nationality-filter.active")).map(cell => cell.dataset.raw);

    let selectedUsers;
    if (ageCell.classList.contains("active")) {
        selectedUsers = users; // Age active = select all
    } else if (selectedGenders.length === 0 && selectedNationalities.length === 0) {
        selectedUsers = []; // No filters = select none
    } else {
        selectedUsers = users.filter(user => {
            const gender = getUserGender(user);
            const nationality = getUserNationality(user);

            // Match if gender is unselected (all genders) or included, AND nationality is unselected (all nationalities) or included
            const genderMatch = selectedGenders.length === 0 || selectedGenders.includes(gender);
            const nationalityMatch = selectedNationalities.length === 0 || selectedNationalities.includes(nationality);
            return genderMatch && nationalityMatch;
        });
    }

    const selectedCount = selectedUsers.length;
    const totalCount = users.length;
    const countCell = row.querySelector(".count-cell");
    countCell.textContent = `${selectedCount}/${totalCount}`;
    countCell.classList.toggle("highlight", selectedCount > 0);

// Auto-activate age cell if all followers are selected via filters
    ageCell.classList.toggle("active", selectedCount === totalCount && totalCount > 0);

    updateTotalSelected();
}

function updateTotalSelected() {
    let totalSelected = 0; // Reset to 0 each time
    const selectedFollowersElList = document.querySelectorAll('#selected-followers-0, #selected-followers-1');

    document.querySelectorAll('.grid-row').forEach(row => {
        const age = row.dataset.age;
        const users = ageMap[age] || [];
        const ageCell = row.querySelector('.age-filter');
        const activeGenders = Array.from(row.querySelectorAll('.gender-filter.active')).map(cell => cell.dataset.raw);
        const activeNationalities = Array.from(row.querySelectorAll('.nationality-filter.active')).map(cell => cell.dataset.raw);

        let matchingUsers;
        if (ageCell.classList.contains('active')) {
            matchingUsers = users; // All users in this age bucket
        } else if (activeGenders.length === 0 && activeNationalities.length === 0) {
            matchingUsers = []; // No filters, no selection
        } else {
            matchingUsers = users.filter(user => {
                const gender = getUserGender(user);
                const nationality = getUserNationality(user);
                const genderMatch = activeGenders.length === 0 || activeGenders.includes(gender);
                const nationalityMatch = activeNationalities.length === 0 || activeNationalities.includes(nationality);
                return genderMatch && nationalityMatch;
            });
        }

        totalSelected += matchingUsers.length;
    });

    selectedFollowersElList.forEach(el => el.textContent = totalSelected);
    window.totalSelected = totalSelected; // Store globally if needed
}

function buildFilterGrid() {
    //TODO only build the categories where there are people.
    const grid = document.querySelector('#follower-grid');
    if (!grid) return;
    grid.innerHTML = '';

    Object.entries(ageMap).forEach(([age, users]) => {
        const row = document.createElement('div');
        row.className = 'grid-row';
        row.dataset.age = age;

        // Age cell (not active initially)
        const ageCell = document.createElement("div");
        ageCell.className = "grid-cell age-filter";
        ageCell.textContent = age;
        ageCell.addEventListener("click", () => {
            const isActiveNow = ageCell.classList.toggle("active");
            row.querySelectorAll(".gender-filter, .nationality-filter").forEach(cell => {
                cell.classList.toggle("active", isActiveNow);
            });
            updateRowCount(row);
            updateAllButtonsState();
        });
        row.appendChild(ageCell);

        // Genders
        genderOptions.forEach(gender => {
            const genderCount = users.filter(u => getUserGender(u) === gender).length;
            const genderCell = createToggleCell('', 'gender-filter', () => {
                const row = genderCell.closest('.grid-row');
                const ageCell = row.querySelector('.age-filter');
                if (ageCell.classList.contains('active')) {
                    ageCell.classList.remove('active'); // Deactivate age cell on individual toggle
                }
                updateRowCount(row);
            });


            const label = document.createElement('span');
            label.textContent = gender;

            genderCell.appendChild(label);

            if (genderCount > 0) {
                const parens = document.createElement('span');
                parens.className = 'count-parens';
                parens.innerHTML = '&nbsp;(';

                const number = document.createElement('span');
                number.textContent = genderCount;

                const close = document.createElement('span');
                close.className = 'count-parens';
                close.textContent = ')';

                parens.style.color = 'var(--night-view-purple)';
                number.style.color = 'var(--night-view-purple)';
                close.style.color = 'var(--night-view-purple)';

                genderCell.appendChild(parens);
                genderCell.appendChild(number);
                genderCell.appendChild(close);
            } else {
                genderCell.classList.add('button-disabled');
                genderCell.classList.add('disabled'); // useful for specific CSS targeting
                genderCell.title = "No followers in this category";
                // genderCell.style.pointerEvents = 'none'; // ⛔ disable click
            }

            genderCell.dataset.raw = gender;
            row.appendChild(genderCell);
        });

// Nationalities
        nationalityOptions.forEach(nationality => {
            const nationalityCount = users.filter(u => getUserNationality(u) === nationality).length;
            const nationalityCell = createToggleCell('', 'nationality-filter', () => {
                const row = nationalityCell.closest('.grid-row');
                const ageCell = row.querySelector('.age-filter');
                if (ageCell.classList.contains('active')) {
                    ageCell.classList.remove('active'); // Deactivate age cell on individual toggle
                }
                updateRowCount(row);
            });

            const label = document.createElement('span');
            label.textContent = nationality;
            nationalityCell.appendChild(label);

            if (nationalityCount > 0) {
                const parens = document.createElement('span');
                parens.className = 'count-parens';
                parens.innerHTML = '&nbsp;(';

                const number = document.createElement('span');
                number.textContent = nationalityCount;

                const close = document.createElement('span');
                close.className = 'count-parens';
                close.textContent = ')';

                parens.style.color = 'var(--night-view-purple)';
                number.style.color = 'var(--night-view-purple)';
                close.style.color = 'var(--night-view-purple)';

                nationalityCell.appendChild(parens);
                nationalityCell.appendChild(number);
                nationalityCell.appendChild(close);
            } else {
                nationalityCell.classList.add('button-disabled');
                nationalityCell.classList.add('disabled');
                nationalityCell.title = "No followers in this category";
                nationalityCell.style.pointerEvents = 'none';
            }

            nationalityCell.dataset.raw = nationality;
            row.appendChild(nationalityCell);
        });


        // Chosen cell (initially 0 selected)
        const ageUsers = ageMap[age] || [];
        const totalInRow = ageUsers.length;
        const countCell = document.createElement("div");
        countCell.className = "grid-cell count-cell";
        countCell.textContent = `0/${totalInRow}`; // Start with 0 selected
        row.appendChild(countCell);

        grid.appendChild(row);
    });

    updateAllButtonsState(); // Ensure "all" buttons reflect initial state (not active)
}


function toggleAllCells(type) {
    let selector;
    let filterFn = cell => true; // Default filter

    if (type === 'age') {
        selector = '.age-filter';
    } else if (type === 'female') {
        selector = '.gender-filter';
        filterFn = cell => cell.dataset.raw === 'F';
    } else if (type === 'male') {
        selector = '.gender-filter';
        filterFn = cell => cell.dataset.raw === 'M';
    } else if (type === 'danish') {
        selector = '.nationality-filter';
        filterFn = cell => cell.dataset.raw === 'Danish';
    } else if (type === 'international') {
        selector = '.nationality-filter';
        filterFn = cell => cell.dataset.raw === 'International';
    } else {
        return; // Invalid type
    }

    const cells = Array.from(document.querySelectorAll(selector)).filter(cell => !cell.classList.contains('disabled') && filterFn(cell));
    if (cells.length === 0) return;

    // Check if all cells are active
    const allActive = cells.every(cell => cell.classList.contains('active'));
    const shouldActivate = !allActive;

    cells.forEach(cell => {
        if (shouldActivate) {
            cell.classList.add('active');
        } else {
            cell.classList.remove('active');
        }
    });

    // For age cells, also toggle gender and nationality cells in the row
    if (type === 'age') {
        document.querySelectorAll('.grid-row').forEach(row => {
            const ageCell = row.querySelector('.age-filter');
            const isActive = ageCell.classList.contains('active');
            row.querySelectorAll(".gender-filter, .nationality-filter").forEach(cell => {
                if (!cell.classList.contains('disabled')) {
                    if (isActive) {
                        cell.classList.add('active');
                    } else {
                        cell.classList.remove('active');
                    }
                }
            });
        });
    } else {
        // Deactivate all age cells when toggling gender or nationality
        document.querySelectorAll('.age-filter').forEach(ageCell => ageCell.classList.remove('active'));
    }

    // Update all row counts
    document.querySelectorAll('.grid-row').forEach(row => updateRowCount(row));

    // Update all buttons state
    updateAllButtonsState();
}

function updateAllButtonsState() {
    const categories = [
        {
            id: 'all-age',
            selector: '.age-filter',
            check: cells => cells.some(cell => !cell.classList.contains('disabled')) && cells.every(cell => cell.classList.contains('disabled') || cell.classList.contains('active'))
        },
        {
            id: 'all-female',
            selector: '.gender-filter',
            filter: cell => cell.dataset.raw === 'F',
            check: cells => cells.some(cell => !cell.classList.contains('disabled')) && cells.every(cell => cell.classList.contains('disabled') || cell.classList.contains('active'))
        },
        {
            id: 'all-male',
            selector: '.gender-filter',
            filter: cell => cell.dataset.raw === 'M',
            check: cells => cells.some(cell => !cell.classList.contains('disabled')) && cells.every(cell => cell.classList.contains('disabled') || cell.classList.contains('active'))
        },
        {
            id: 'all-danish',
            selector: '.nationality-filter',
            filter: cell => cell.dataset.raw === 'Danish',
            check: cells => cells.some(cell => !cell.classList.contains('disabled')) && cells.every(cell => cell.classList.contains('disabled') || cell.classList.contains('active'))
        },
        {
            id: 'all-international',
            selector: '.nationality-filter',
            filter: cell => cell.dataset.raw === 'International',
            check: cells => cells.some(cell => !cell.classList.contains('disabled')) && cells.every(cell => cell.classList.contains('disabled') || cell.classList.contains('active'))
        }
    ];

    categories.forEach(category => {
        const button = document.getElementById(category.id);
        if (button) {
            const cells = Array.from(document.querySelectorAll(category.selector));
            const filteredCells = category.filter ? cells.filter(category.filter) : cells;
            const isActive = category.check(filteredCells);
            button.classList.toggle('active', isActive);
        }
    });
}

// Send notification
document.getElementById('send-notification').addEventListener('click', async () => {
    const header = document.getElementById('notification-header').value.trim();
    const message = document.getElementById('notification-message').value.trim();
    const scheduledForInput = document.getElementById('notification-scheduled-for').value;

    if (!message) {
        showAlert({
            title: 'Missing Message',
            text: 'Please write a notification message.',
            icon: swalTypes.warning,
        });
        console.error('🚨 Notification failed: No message written.');
        return;
    }

    if (window.totalSelected === 0) {
        showAlert({
            title: 'No Followers Selected',
            text: 'Adjust your filters and try again.',
            icon: swalTypes.warning,
        });
        console.error('🚨 Notification failed: No followers selected.');
        return;
    }

    if (!scheduledForInput) {
        showAlert({
            title: 'Missing Time',
            text: 'Please choose when to send the notification.',
            icon: swalTypes.warning
        });
        console.error('🚨 Notification failed: No scheduled time selected.');
        return;
    }

    const scheduledDate = new Date(scheduledForInput);
    const nowPlus30Min = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    if (scheduledDate < nowPlus30Min) {
        showAlert({
            title: 'Invalid Time',
            text: 'Notifications must be scheduled at least 30 minutes into the future.',
            icon: swalTypes.warning,
        });
        console.error('🚨 Notification failed: Scheduled time is too soon or in the past.');
        return;
    }
    console.log('🟢 Starting notification preparation...');

    // Step 1: Collect selected user IDs and filters
    const selectedUserIds = [];
    const filters = [];
    const allRows = document.querySelectorAll('.grid-row');
    let allAgesActive = true;
    let allFemaleActive = true;
    let allMaleActive = true;

    let allDanishActive = true;
    let allInternationalActive = true;

    Object.entries(ageMap).forEach(([age, users]) => {
        const row = document.querySelector(`.grid-row[data-age="${age}"]`);
        if (!row) return;

        const ageCell = row.querySelector('.age-filter');
        const activeGenders = Array.from(row.querySelectorAll('.gender-filter.active')).map(cell => cell.dataset.raw);
        const activeNationalities = Array.from(row.querySelectorAll('.nationality-filter.active')).map(cell => cell.dataset.raw);

        // Check nationality cell availability
        const danishCell = row.querySelector('.nationality-filter[data-raw="Danish"]');
        const internationalCell = row.querySelector('.nationality-filter[data-raw="International"]');
        const hasDanish = !danishCell.classList.contains('disabled');
        const hasInternational = !internationalCell.classList.contains('disabled');

        // Determine matching users
        let matchingUsers;
        if (ageCell.classList.contains('active')) {
            matchingUsers = users;
        } else if (activeGenders.length === 0 && activeNationalities.length === 0) {
            matchingUsers = [];
        } else {
            matchingUsers = users.filter(user => {
                const gender = getUserGender(user);
                const nationality = getUserNationality(user);
                const genderMatch = activeGenders.length === 0 || activeGenders.includes(gender);
                const nationalityMatch = activeNationalities.length === 0 || activeNationalities.includes(nationality);
                return genderMatch && nationalityMatch;
            });
        }

        // Build filter for this age bucket if there are selected users
        if (matchingUsers.length > 0) {
            selectedUserIds.push(...matchingUsers.map(user => user.id));
            let filterObj;
            if (ageCell.classList.contains('active')) {
                filterObj = {age, type: 'all'};
            } else {
                filterObj = {
                    age,
                    type: 'specific',
                    genders: activeGenders,
                    nationalities: activeNationalities
                };
            }
            filters.push(filterObj);
        }

        // Update broad selection flags
        allAgesActive = allAgesActive && ageCell.classList.contains('active');
        allFemaleActive = allFemaleActive && activeGenders.includes('F');
        allMaleActive = allMaleActive && activeGenders.includes('M');
        allDanishActive = allDanishActive && (!hasDanish || danishCell.classList.contains('active'));
        allInternationalActive = allInternationalActive && (!hasInternational || internationalCell.classList.contains('active'));
    });

    // Step 2: Simplify filters if possible
    let finalFilters;
    const totalFollowers = Object.values(ageMap).flat().length;
    const hasOtherSelections = filters.some(f => f.type === 'specific' || (f.type === 'all' && filters.length < allRows.length));

// Check for "simple" filter types first
    if (allAgesActive && selectedUserIds.length === totalFollowers) {
        finalFilters = 'all';
    } else if (allDanishActive && !allInternationalActive) {
        finalFilters = 'danish';
    } else if (allInternationalActive && !allDanishActive) {
        finalFilters = 'international';
    } else if (allFemaleActive && !allMaleActive) {
        finalFilters = 'female';
    } else if (allMaleActive && !allFemaleActive) {
        finalFilters = 'male';
    } else {
        // Complex/custom filters → Build the {ages: [], genders: [], nationalities: []} map!
        const selectedAges = [];
        const selectedGenders = new Set();
        const selectedNationalities = new Set();

        document.querySelectorAll('.grid-row').forEach(row => {
            const age = row.dataset.age;
            const ageCell = row.querySelector('.age-filter');

            if (ageCell.classList.contains('active')) {
                // Entire age selected
                selectedAges.push(age);
                selectedGenders.add('F');
                selectedGenders.add('M');
                selectedNationalities.add('Danish');
                selectedNationalities.add('International');
            } else {
                // Specific selections
                const activeGenders = Array.from(row.querySelectorAll('.gender-filter.active')).map(cell => cell.dataset.raw);
                const activeNationalities = Array.from(row.querySelectorAll('.nationality-filter.active')).map(cell => cell.dataset.raw);

                if (activeGenders.length > 0 || activeNationalities.length > 0) {
                    selectedAges.push(age);


                    activeGenders.forEach(g => selectedGenders.add(g));
                    activeNationalities.forEach(n => selectedNationalities.add(n));
                }
            }
        });

        finalFilters = {
            ages: selectedAges,
            genders: Array.from(selectedGenders),
            nationalities: Array.from(selectedNationalities)
        };
    }

    console.log('✅ Selected Users:', selectedUserIds);
    console.log('🎯 Filters:', finalFilters);

    // Step 2.5: Safety check for empty complex filters
    if (typeof finalFilters === 'object') {
        const noAges = !finalFilters.ages || finalFilters.ages.length === 0;
        const noGenders = !finalFilters.genders || finalFilters.genders.length === 0;
        const noNationalities = !finalFilters.nationalities || finalFilters.nationalities.length === 0;

        if (noAges && noGenders && noNationalities) {
            showAlert({
                title: 'Missing Filters',
                text: 'Please select at least one age, gender, or nationality filter.',
                icon: swalTypes.warning
            });
            console.error('🚨 Notification failed: No filters selected.');
            return; // ❌ STOP execution
        }
    }

    // Step 3: Prepare final object to upload
    const createdBy = getSession().uid;
    const clubId = getClubSession();
    const notificationData = {
        header,
        message,
        createdBy,
        clubId,
        filters: finalFilters,
        scheduledFor: new Date(scheduledForInput).toISOString()
    };

    console.log('📦 Final Notification Data:', notificationData);

    // Step 4: Upload to Firestore
    const previewResult = await showAlert({
        title: 'Send Notification?',
        html: `
        <div style="text-align: left; font-size: 14px;">
            <p><strong>Message:</strong> ${message}</p>
            <p><strong>Scheduled For:</strong> ${formatFullDateTime(new Date(scheduledForInput))}</p>
            <p><strong>Filters:</strong> ${formatFiltersReadable(filters)}</p>
        </div>
    `,
        icon: swalTypes.info,
        confirmText: 'Send',
        cancelText: 'Edit',
        cancelButtonColor: 'var(--color-red)',            // Red confirm
        showCancel: true
    });

    if (!previewResult.isConfirmed) {
        console.log('🚫 Upload canceled by user after preview.');
        return;
    }

    // Step 5: Clear fields
    try {
        await uploadNotification(notificationData);
        console.log('✅ Notification uploaded:', notificationData);
    } catch (err) {
        console.error('❌ Upload failed:', err);
        showAlert({
            title: 'Upload Failed',
            text: 'See the console for more details.',
            icon: swalTypes.error
        });
        return;
    }

    // Step 6: Clear form and show success
    document.getElementById('notification-header').value = '';
    document.getElementById('notification-message').value = '';
    document.getElementById('notification-scheduled-for').value = '';

    await loadScheduledNotifications()
    showAlert({
        title: 'Notification Queued',
        text: `Scheduled for ${formatFullDateTime(scheduledForInput)} to ${selectedUserIds.length} follower${selectedUserIds.length === 1 ? '' : 's'}!`,
        icon: swalTypes.success,
        timer: null,
    });

});

//TODO Cant chose categories with no one!