import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js';
import { db } from '../api/firebase-api.js';

let clubs = [];
let visibleCount = 20;

document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("club-list");

    try {
        const snapshot = await getDocs(collection(db, "club_data"));
        clubs = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.displayName || data.name || "Unnamed Club",
                favorites: Array.isArray(data.favorites) ? data.favorites.length : 0
            };
        });

        // Sort by favorites descending
        clubs.sort((a, b) => b.favorites - a.favorites);

        renderClubList(container, visibleCount);

        // Add "See More" button
        if (clubs.length > visibleCount) {
            const btn = document.createElement("button");
            btn.textContent = "See More";
            btn.className = "see-more-btn";
            btn.addEventListener("click", () => {
                visibleCount += 20;
                renderClubList(container, visibleCount);
                if (visibleCount >= clubs.length) btn.remove(); // Remove button if no more to show
            });
            container.parentElement.appendChild(btn);
        }

    } catch (e) {
        console.error("Failed to load club data:", e);
        container.textContent = "Failed to load club list.";
    }
});

function renderClubList(container, count) {
    container.innerHTML = ""; // Clear previous
    clubs.slice(0, count).forEach((club, index) => {
        const div = document.createElement("div");
        div.className = "club-row";
        div.innerHTML = `<strong>${index + 1}. ${club.name}</strong> — <span>${club.favorites} follower${club.favorites !== 1 ? 's' : ''}</span>`;
        container.appendChild(div);
    });
}
