// club-overview.js
import {
    analytics,
    collection,
    db,
    deleteObject,
    doc,
    getDocs,
    getDownloadURL,
    getStorage,
    logEvent,
    ref,
    updateDoc,
    uploadBytes
} from "../api/firebase-api.js";
import {CLUB_TYPES_ENGLISH} from "../utilities/constants.js";
import {clubDataCache, setClubDataCache} from "../utilities/global.js"; // Import the setter
import {getClubSession, getSession} from "../utilities/session.js";
import {updateIPhoneDisplay} from "./iphone-display-updater.js";

// DOMContentLoaded event listener for initial setup
document.addEventListener("DOMContentLoaded", () => {
    const uid = getSession().uid;
    const role = getSession().role;

    if (uid && role) {
        const nav = document.querySelector("nav-bar");
        if (nav && typeof nav.setUser === "function") {
            nav.setUser({uid}, role);
        }
        const storedClubId = getClubSession();
        if (storedClubId) {
            loadData({uid, role}, storedClubId);
        }
    } else {
        window.location.href = "/NightVieweditclubpage/html/login.html";
    }
});

// Log page view event for analytics
logEvent(analytics, "page_view");
const storage = getStorage();

// Utility function to fetch a storage URL with a fallback
function fetchStorageUrl(path, fallbackUrl = "") {
    const storageRef = ref(storage, path);
    return getDownloadURL(storageRef)
        .then((url) => url)
        .catch((error) => {
            console.warn(`Could not fetch ${path}, using fallback`, error);
            return fallbackUrl;
        });
}

// Utility function to format opening hours (assumed implementation)
function formatOpeningHours(openingHours) {
    if (!openingHours || typeof openingHours !== "object") return "Not set";
    return Object.entries(openingHours)
        .map(([day, hours]) =>
            hours && hours.open && hours.close
                ? `${day}: ${hours.open} - ${hours.close}`
                : `${day}: Closed`
        )
        .join(", ");
}

// Main function to fetch and display club data
async function loadData(user, selectedClubId) {
    console.log("loadData called with user:", user, "selectedClubId:", selectedClubId);
    try {
        let querySnapshot = null;
        if (!clubDataCache) {
            querySnapshot = await getDocs(collection(db, "club_data"));
            setClubDataCache(querySnapshot.docs.map((docSnap) => ({  // Use setter instead of direct assignment
                id: docSnap.id,
                ...docSnap.data(),
            })));
            console.log("Fetched fresh clubDataCache:", clubDataCache);
            setClubDataCache(clubDataCache);
        } else {
            querySnapshot = {
                docs: clubDataCache.map((doc) => ({id: doc.id, data: () => doc})),
            };
            console.log("Using cached clubData:", clubDataCache);
        }

        if (querySnapshot.docs.length > 0) {
            // Filter clubs based on user role
            const allowedClubs = querySnapshot.docs.filter((doc) => {
                const data = doc.data();
                if (user.role === "admin") return true;
                if (
                    user.role === "owner" &&
                    Array.isArray(data.owners) &&
                    data.owners.includes(user.uid)
                )
                    return true;
                return false;
            });

            if (allowedClubs.length === 0) {
                console.log("No clubs accessible for this user.");
                alert("You do not have permission to view any clubs.");
                return;
            }

            // Find the selected club by ID
            const doc = allowedClubs.find((doc) => doc.id === selectedClubId);
            if (!doc) {
                console.log(`Club with ID ${selectedClubId} not found or not authorized.`);
                alert("You do not have permission to view this club or it doesn’t exist.");
                return;
            }

            const dbData = doc.data();
            // Inside loadData, after const dbData = doc.data();
            console.log("Club data:", dbData); // Log full data to inspect


            console.log("Fetched club data for", selectedClubId, ":", dbData);

            // Populate clubData object
            const clubData = {
                logo: await fetchStorageUrl(
                    `club_logos/${dbData.logo}`,
                    "../images/default_logo.png"
                ).then((url) => {
                    console.log(`Club logo URL for ${dbData.logo}:`, url);
                    return url;
                }),
                name: dbData.name || "Unknown Club",
                ageRestriction:
                    dbData.age_restriction && dbData.age_restriction >= 16
                        ? `${dbData.age_restriction}+`
                        : "Not set",
                openingHours: formatOpeningHours(dbData.opening_hours),
                distance: "300 m",
                isFavorite: true,
                typeOfClub: dbData.type_of_club || "unknown",
            };

            // Update Left Container UI Elements

            // Header Section
            const clubNameH1 = document.querySelector(".header-title");
            if (clubNameH1) clubNameH1.textContent = clubData.name;

            const clubLogoImg = document.getElementById("clubLogoImg");
            if (clubLogoImg) clubLogoImg.src = clubData.logo;

            const clubTypeImg = document.getElementById("clubTypeImg");
            if (clubTypeImg) {
                clubTypeImg.src = dbData.type_of_club
                    ? `../images/clubtype/${dbData.type_of_club}_icon.png`
                    : "../images/default_type.png";
            }

            // Basic Info Section
            const clubNameInput = document.getElementById("clubNameInput");
            if (clubNameInput) clubNameInput.value = clubData.name;

            const clubDisplayName = document.getElementById("clubDisplayName");
            if (clubDisplayName) clubDisplayName.value = dbData.displayName || clubData.name;

            const typeOfClubSelect = document.getElementById("typeOfClubSelect");
            if (typeOfClubSelect) {
                typeOfClubSelect.innerHTML = "";
                Object.entries(CLUB_TYPES_ENGLISH).forEach(([dbValue, displayLabel]) => {
                    const option = document.createElement("option");
                    option.value = dbValue;
                    option.textContent = displayLabel;
                    typeOfClubSelect.appendChild(option);
                });
                typeOfClubSelect.value = dbData.type_of_club || "";
            }

            // Location Section
            const lat = document.getElementById("lat");
            if (lat) lat.value = dbData.lat ?? "";

            const lon = document.getElementById("lon");
            if (lon) lon.value = dbData.lon ?? "";
// Corners update
            if (Array.isArray(dbData.corners)) {
                dbData.corners.forEach((corner, index) => {
                    const latInput = document.getElementById(`corner${index + 1}-lat`);
                    const lonInput = document.getElementById(`corner${index + 1}-lon`);
                    if (latInput) latInput.value = corner._lat !== undefined ? corner._lat : "";
                    if (lonInput) lonInput.value = corner._long !== undefined ? corner._long : "";
                });
            } else {
                // Clear inputs if no corners data
                for (let i = 1; i <= 4; i++) {
                    const latInput = document.getElementById(`corner${i}-lat`);
                    const lonInput = document.getElementById(`corner${i}-lon`);
                    if (latInput) latInput.value = "";
                    if (lonInput) lonInput.value = "";
                }
            }


            // Details Section
            const maxVisitors = document.getElementById("maxVisitors");
            if (maxVisitors) maxVisitors.value = dbData.total_possible_amount_of_visitors ?? "";

            // Details Section
            const entryPrice = document.getElementById("entryPrice");
            if (entryPrice) {
                entryPrice.value = dbData.entry_price ?? "0"; // Default to "0" if undefined
                console.log("Entry Price set to:", entryPrice.value); // Debug log
            }

            const primaryColor = document.getElementById("primaryColor");
            if (primaryColor) {
                primaryColor.value = dbData.primary_color ?? "NightView Green"; // Default to black
                console.log("Primary Color set to:", primaryColor.value);
            }

            const secondaryColor = document.getElementById("secondaryColor");
            if (secondaryColor) {
                secondaryColor.value = dbData.secondary_color ?? "NightView Black"; // Default to white
                console.log("Secondary Color set to:", secondaryColor.value);
            }

            const font = document.getElementById("font");
            if (font) {
                font.value = dbData.font ?? "NightView Font"; // Default to Arial
                console.log("Font set to:", font.value);
            }

            // Weekdays Section
            const days = [
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
                "sunday",
            ];
            days.forEach((day) => {
                const hoursElement = document.getElementById(`${day}-hours`);
                const ageElement = document.getElementById(`${day}-age`);
                const offerButton = document.getElementById(`${day}-offer`);

                const dayHours = dbData.opening_hours?.[day];
                if (hoursElement)
                    hoursElement.value = dayHours
                        ? `${dayHours.open} - ${dayHours.close}`
                        : "Closed";

                const dayAgeRestriction = dayHours?.ageRestriction;
                const ageToDisplay =
                    dayAgeRestriction !== undefined && dayAgeRestriction !== null
                        ? dayAgeRestriction
                        : dbData.age_restriction;
                if (ageElement) {
                    ageElement.value =
                        ageToDisplay !== undefined && ageToDisplay !== null
                            ? ageToDisplay < 16
                                ? "Not set"
                                : `${ageToDisplay}+`
                            : "Not set";
                }

                const hasOffer = dbData.daily_offers?.[day] && dbData.daily_offers[day] !== "";
                if (offerButton) {
                    offerButton.textContent = hasOffer ? "Offer Available" : "No Offer";
                    if (hasOffer) offerButton.classList.add("has-offer");
                    offerButton.addEventListener("click", () =>
                        handleOfferAction(day, doc.id, offerButton)
                    );
                }
            });
            days.forEach((day) => {
                const hoursElement = document.getElementById(`${day}-hours`);
                const hoursContainer = hoursElement?.parentElement; // Get the parent .detail-box
                if (hoursContainer) {
                    hoursContainer.addEventListener("click", () => {
                        showTimePicker(day, hoursElement, (day, newHours) => {
                            // Update the UI
                            hoursElement.value = newHours;
                            // Trigger preview update if it's today's hours
                            if (day === getTodayKey()) {
                                const event = new Event("input");
                                hoursElement.dispatchEvent(event);
                            }
                        });
                    });
                }
            });

            days.forEach((day) => {
                const ageElement = document.getElementById(`${day}-age`);
                const ageContainer = ageElement?.parentElement; // Get the parent .detail-box-age
                if (ageContainer) {
                    ageContainer.setAttribute("tabindex", "0"); // Make it focusable for accessibility
                    const openAgePicker = () => {
                        showAgePicker(day, ageElement, (day, newAge) => {
                            // Update the UI
                            const displayAge = newAge < 16 ? "??" : `${newAge}+`;
                            ageElement.value = displayAge;
                            // Trigger preview update if it's today's age
                            if (day === getTodayKey()) {
                                const event = new Event("DOMSubtreeModified");
                                ageElement.dispatchEvent(event);
                            }
                        });
                    };
                    ageContainer.addEventListener("click", openAgePicker);
                    ageContainer.addEventListener("keydown", (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openAgePicker();
                        }
                    });
                }
            });


        } else {
            console.log("No documents found in collection.");
            alert("No club data available.");
        }
    } catch (error) {
        console.error("Error fetching club data:", error);
        alert("An error occurred while loading data.");
    }
    setupLivePreviewBindings();
    bindLeftInputs();
}

function showAgePicker(day, ageElement, onAgeSelect) {
    // Remove any existing popups
    const existingPopup = document.querySelector(".age-picker-popup");
    if (existingPopup) existingPopup.remove();

    // Create popup
    const popup = document.createElement("div");
    popup.className = "age-picker-popup";

    // Add header
    const header = document.createElement("h3");
    header.className = "popup-header";
    const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1); // Capitalize the day
    header.textContent = `Age Restriction ${capitalizedDay}`;
    popup.appendChild(header);

    // Age input
    const ageLabel = document.createElement("label");
    ageLabel.textContent = "Age Limit:";
    const ageInput = document.createElement("input");
    ageInput.type = "number";
    ageInput.min = 16;
    ageInput.max = 35;
    ageInput.value = ageElement.value || "";
    popup.appendChild(ageLabel);
    popup.appendChild(ageInput);

    // Save button
    const saveButton = document.createElement("button");
    saveButton.textContent = "Save";
    saveButton.addEventListener("click", () => {
        let newAge = parseInt(ageInput.value);
        if (isNaN(newAge) || newAge < 16 || newAge > 35) {
            alert("Please enter an age between 16 and 35.");
            return;
        }
        const displayAge = newAge < 16 ? "??" : `${newAge}+`;
        ageElement.value = displayAge;
        onAgeSelect(day, newAge);
        popup.remove();
    });
    popup.appendChild(saveButton);

    // Position popup near the age element
    const rect = ageElement.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(popup);

    // Close popup when clicking outside
    const closePopup = (e) => {
        if (!popup.contains(e.target) && e.target !== ageElement) {
            popup.remove();
            document.removeEventListener("click", closePopup);
        }
    };
    setTimeout(() => document.addEventListener("click", closePopup), 0);
}

function bindLeftInputs() {
    const nameInput = document.getElementById("clubNameInput");
    const typeSelect = document.getElementById("typeOfClubSelect");
    const primaryColor = document.getElementById("primaryColor");
    const secondaryColor = document.getElementById("secondaryColor");

    if (nameInput) {
        nameInput.addEventListener("input", () => {
            document.querySelector(".header-title").textContent = nameInput.value;
        });
    }

    if (typeSelect) {
        typeSelect.addEventListener("change", () => {
            const img = document.getElementById("clubTypeImg");
            if (img)
                img.src = typeSelect.value
                    ? `../images/clubtype/${typeSelect.value}_icon.png`
                    : "../images/default_type.png";
        });
    }

    // Add color picker for primary color
    if (primaryColor) {
        primaryColor.addEventListener("click", () => {
            showColorPicker(primaryColor, (color) => {
                primaryColor.value = color;
                // Trigger iPhone display update
                const event = new Event("input");
                primaryColor.dispatchEvent(event);
            });
        });
    }

    // Add color picker for secondary (background) color
    if (secondaryColor) {
        secondaryColor.addEventListener("click", () => {
            showColorPicker(secondaryColor, (color) => {
                secondaryColor.value = color;
                // Trigger iPhone display update
                const event = new Event("input");
                secondaryColor.dispatchEvent(event);
            });
        });
    }
}


function getTodayKey() {
    return new Date().toLocaleDateString("en-US", {weekday: "long"}).toLowerCase();
}

function setupLivePreviewBindings() {
    const today = getTodayKey();

    const inputs = {
        displayName: document.getElementById("clubDisplayName"),
        logo: document.getElementById("clubLogoImg"),
        type: document.getElementById("typeOfClubSelect"),
        maxVisitors: document.getElementById("maxVisitors"),
        entryPrice: document.getElementById("entryPrice"),
        primaryColor: document.getElementById("primaryColor"),
        secondaryColor: document.getElementById("secondaryColor"),
        font: document.getElementById("font"),
        lat: document.getElementById("lat"),
        lon: document.getElementById("lon")
    };

    const dynamicPreviewUpdate = () => {
        const ageElem = document.getElementById(`${today}-age`);
        const hoursElem = document.getElementById(`${today}-hours`);

        const data = {
            displayName: inputs.displayName.value,
            logo: inputs.logo.src,
            type: inputs.type.value,
            ageRestriction: ageElem?.textContent?.replace("+", "") || "18",
            entryPrice: parseFloat(inputs.entryPrice.value || "0"),
            primaryColor: inputs.primaryColor.value,
            secondaryColor: inputs.secondaryColor.value,
            font: inputs.font.value,
            lat: parseFloat(inputs.lat.value),
            lon: parseFloat(inputs.lon.value),
            openingHours: hoursElem?.value || "Closed"
        };

        updateIPhoneDisplay(data);
    };

    // Bind to all static inputs
    Object.values(inputs).forEach((input) => {
        if (input) input.addEventListener("input", dynamicPreviewUpdate);
    });

    // Bind to today's hours input
    const hoursElem = document.getElementById(`${today}-hours`);
    if (hoursElem) hoursElem.addEventListener("input", dynamicPreviewUpdate);

    // Bind to today's age element (still using DOMSubtreeModified if needed)
    const ageElem = document.getElementById(`${today}-age`);
    if (ageElem) ageElem.addEventListener("DOMSubtreeModified", dynamicPreviewUpdate);

    // Initial update
    dynamicPreviewUpdate();
}

function showColorPicker(inputElement, onColorSelect) {
    const existingPopup = document.querySelector(".color-picker-popup");
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement("div");
    popup.className = "color-picker-popup";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = inputElement.value || "#000000";
    popup.appendChild(colorInput);

    const rect = inputElement.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(popup);

    // Trigger native color picker immediately
    requestAnimationFrame(() => colorInput.click());

    colorInput.addEventListener("input", () => {
        inputElement.value = colorInput.value;
        onColorSelect(colorInput.value);
    });

    const closePopup = (e) => {
        if (!popup.contains(e.target) && e.target !== inputElement) {
            popup.remove();
            document.removeEventListener("click", closePopup);
        }
    };
    setTimeout(() => document.addEventListener("click", closePopup), 0);
}

function showTimePicker(day, hoursElement, onTimeSelect) {
    // Remove any existing popups
    const existingPopup = document.querySelector(".time-picker-popup");
    if (existingPopup) existingPopup.remove();

    // Create popup
    const popup = document.createElement("div");
    popup.className = "time-picker-popup";

    // Add header
    const header = document.createElement("h3");
    header.className = "popup-header";
    const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1); // Capitalize the day
    header.textContent = `Opening Hours ${capitalizedDay}`;
    popup.appendChild(header);

    // Open time input
    const openLabel = document.createElement("label");
    openLabel.textContent = "Open Time:";
    const openInput = document.createElement("input");
    openInput.type = "time";
    openInput.value = hoursElement.value.split(" - ")[0] || "";
    popup.appendChild(openLabel);
    popup.appendChild(openInput);

    // Close time input
    const closeLabel = document.createElement("label");
    closeLabel.textContent = "Close Time:";
    const closeInput = document.createElement("input");
    closeInput.type = "time";
    closeInput.value = hoursElement.value.split(" - ")[1] || "";
    popup.appendChild(closeLabel);
    popup.appendChild(closeInput);

    // Save button
    const saveButton = document.createElement("button");
    saveButton.textContent = "Save";
    saveButton.addEventListener("click", () => {
        const openTime = openInput.value;
        const closeTime = closeInput.value;
        const newHours = openTime && closeTime ? `${openTime} - ${closeTime}` : "Closed";
        hoursElement.value = newHours;
        onTimeSelect(day, newHours);
        popup.remove();
    });
    popup.appendChild(saveButton);

    // Position popup near the hours element
    const rect = hoursElement.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(popup);

    // Close popup when clicking outside
    const closePopup = (e) => {
        if (!popup.contains(e.target) && e.target !== hoursElement) {
            popup.remove();
            document.removeEventListener("click", closePopup);
        }
    };
    setTimeout(() => document.addEventListener("click", closePopup), 0);
}



// Function to handle adding or deleting an offer picture
async function handleOfferAction(day, clubId, offerButton) {
    const storagePath = `daily_offers/${clubId}_${day}.jpg`;
    const storageRef = ref(storage, storagePath);
    const hasOffer = offerButton.textContent === "Offer Available";

    if (hasOffer) {
        try {
            await deleteObject(storageRef);
            const clubDocRef = doc(db, "club_data", clubId);
            await updateDoc(clubDocRef, {[`daily_offers.${day}`]: ""});
            offerButton.textContent = "No Offer";
            offerButton.classList.remove("has-offer");
            alert(`Offer picture for ${day} deleted successfully.`);
        } catch (error) {
            console.error(`Error deleting offer picture for ${day}:`, error);
            alert(`Failed to delete offer picture for ${day}.`);
        }
    } else {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.click();
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            try {
                await uploadBytes(storageRef, file);
                const clubDocRef = doc(db, "club_data", clubId);
                await updateDoc(clubDocRef, {
                    [`daily_offers.${day}`]: `${clubId}_${day}.jpg`,
                });
                offerButton.textContent = "Offer Available";
                offerButton.classList.add("has-offer");
                alert(`Offer picture for ${day} uploaded successfully.`);
            } catch (error) {
                console.error(`Error uploading offer picture for ${day}:`, error);
                alert(`Failed to upload offer picture for ${day}.`);
            }
        };
    }
}

// Event listener for club change
window.addEventListener("clubChanged", () => {
    const selectedClubId = getClubSession();
    const uid = getSession().uid;
    const role = getSession().role;
    if (selectedClubId && window.currentUser) {
        loadData({uid, role}, selectedClubId);
    } else {
        console.log("No selected club or user context available.");
    }
});

document.getElementById("resetButton").addEventListener("click", () => {
    const uid = getSession().uid;
    const role = getSession().role;
    const clubId = getClubSession(); // or track the current clubId globally

    if (uid && role && clubId) {
        loadData({uid, role}, clubId);
    } else {
        alert("Cannot reset — missing user or club info.");
    }



});
