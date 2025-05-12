import {
    addDoc,
    collection,
    db,
    deleteDoc,
    doc,
    getDocs,
    serverTimestamp,
} from "../api/firebase-api.js";
import { databaseCollections, swalTypes } from "../utilities/constants.js";
import { getSession } from "../utilities/session.js";
import { toTitleCase } from "../utilities/utility.js";
import { showAlert } from "../utilities/custom-alert.js";
import {hideLoading, showLoading} from "../utilities/loading-indicator.js";

let clubs = [];
let visibleCount = 20;
let tagMap = new Map(); // name -> emoji (or SVG)
let selectedEmoji = "";

document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("club-list");
    const tagNameInput = document.getElementById("tag-name-input");
    const addBtn = document.getElementById("add-tag-btn");
    const emojiPicker = document.getElementById("emoji-picker");
    const chosenEmojiDisplay = document.getElementById("chosen-emoji-display");

    // Load existing tags
    const tagSnap = await getDocs(collection(db, databaseCollections.clubTags));
    tagSnap.forEach((doc) => {
        const data = doc.data();
        if (data.name && data.emoji) {
            tagMap.set(toTitleCase(data.name), data.emoji);
        }
    });

    // Load club data
    try {
        const snapshot = await getDocs(collection(db, "club_data"));
        clubs = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.displayName || data.name || "Unnamed Club",
                favorites: Array.isArray(data.favorites) ? data.favorites.length : 0,
                tags: data.tags || [],
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
                if (visibleCount >= clubs.length) btn.remove();
            });
            container.parentElement.appendChild(btn);
        }
    } catch (e) {
        console.error("Failed to load club data:", e);
        container.textContent = "Failed to load club list.";
    }

    // Initialize emoji picker
    emojiPicker.addEventListener("emoji-click", (event) => {
        selectedEmoji = event.detail.unicode;
        chosenEmojiDisplay.textContent = selectedEmoji;
    });

    // Add Tag Button Logic
    const addTag = async () => {
        showLoading();
        const rawName = tagNameInput.value.trim();
        const name = rawName.toLowerCase();

        if (!name || !selectedEmoji) {
            showAlert({
                title: "Missing Fields",
                text: "Please fill in both fields.",
                icon: swalTypes.warning,
            });
            return;
        }

        // Prevent duplicate tag names
        const tagSnap = await getDocs(collection(db, databaseCollections.clubTags));
        const existingNames = new Set();
        tagSnap.forEach((doc) => {
            const data = doc.data();
            if (data.name) existingNames.add(data.name.toLowerCase());
        });

        if (existingNames.has(name)) {
            showAlert({
                title: "Duplicate Tag",
                text: `Tag "${name}" already exists.`,
                icon: swalTypes.warning,
            });
            return;
        }

        try {
            await addDoc(collection(db, databaseCollections.clubTags), {
                name,
                emoji: selectedEmoji,
                created_at: serverTimestamp(),
                created_by: getSession().uid,
            });
            tagNameInput.value = "";
            selectedEmoji = "";
            chosenEmojiDisplay.textContent = "None";
            loadTags(); // refresh UI
        } catch (e) {
            console.error("Failed to add tag:", e);
            showAlert({
                title: "Error",
                text: "Failed to add tag.",
                icon: swalTypes.error,
            });
        }
        hideLoading();
    };

    addBtn.addEventListener("click", addTag);

    tagNameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addTag();
        }
    });

    // Load tags on startup
    loadTags();
});

function renderClubList(container, count) {
    container.innerHTML = "";
    clubs.slice(0, count).forEach((club, index) => {
        const div = document.createElement("div");
        div.className = "club-row";
        let tagsHtml = "";
        if (club.tags && club.tags.length) {
            tagsHtml = club.tags
                .map((tag) => {
                    const displayName = toTitleCase(tag);
                    const emoji = tagMap.get(displayName) || "🏷️";
                    return `<span class="club-tag">${emoji} ${displayName}</span>`;
                })
                .join(" ");
        }

        div.innerHTML = `
      <strong>${index + 1}. ${club.name}</strong> — 
      <span>${club.favorites} follower${
            club.favorites !== 1 ? "s" : ""
        }</span>
      <div class="club-tags">${tagsHtml}</div>
    `;
        container.appendChild(div);
    });
}

export async function loadTags() {
    const tagContainer = document.getElementById("tag-list");
    tagContainer.innerHTML = "";

    const tagSnap = await getDocs(collection(db, databaseCollections.clubTags));
    const tags = tagSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Sort by name
    tags.sort((a, b) => a.name.localeCompare(b.name));

    tags.forEach((tag) => {
        const tagDiv = document.createElement("div");
        tagDiv.className = "tag-row";
        tagDiv.style.cursor = "pointer";
        tagDiv.setAttribute("data-id", tag.id);
        tagDiv.setAttribute("data-name", tag.name);

        const isUrl =
            typeof tag.emoji === "string" && tag.emoji.startsWith("http");
        const emojiHtml = isUrl
            ? `<img src="${tag.emoji}" class="emoji-icon" alt="${tag.name}" />`
            : tag.emoji;

        tagDiv.innerHTML = `${emojiHtml} <strong>${toTitleCase(tag.name)}</strong>`;
        tagContainer.appendChild(tagDiv);

        tagDiv.addEventListener("click", async () => {
            const tagId = tagDiv.getAttribute("data-id");
            const tagName = tagDiv.getAttribute("data-name");
            const emoji = tag.emoji || "";

            const result = await showAlert({
                title: "Delete Tag?",
                text: `Are you sure you want to delete "${emoji}${toTitleCase(
                    tagName
                )}"?`,
                icon: swalTypes.warning,
                showCancel: true,
                confirmText: "Yes, delete it",
                confirmButtonColor: "var(--color-red)",
                cancelButtonColor: "var(--night-view-green)",
            });

            if (result.isConfirmed) {
                try {
                    const tagDocRef = doc(db, databaseCollections.clubTags, tagId);
                    await deleteDoc(tagDocRef);

                    showAlert({
                        title: "Deleted!",
                        text: `"${toTitleCase(tagName)}" has been removed.`,
                        icon: swalTypes.success,
                    });

                    loadTags();
                } catch (err) {
                    console.error("Error deleting tag:", err);
                    showAlert({
                        title: "Error",
                        text: "Something went wrong while deleting the tag.",
                        icon: swalTypes.error,
                    });
                }
            }
        });
    });
}
