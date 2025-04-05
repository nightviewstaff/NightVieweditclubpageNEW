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

export let mainOfferImgUrl;
let localClubData; // Local copy of club data for changes

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
            localClubData = {...dbData};


            mainOfferImgUrl = dbData.main_offer_img
                ? await fetchStorageUrl(`main_offers/${dbData.main_offer_img}`, null)
                : null;


            console.log("Fetched club data for", selectedClubId, ":", dbData);

            // Populate clubData object
            const clubData = {

                name: dbData.name || "Unknown Club",
                logo: await fetchStorageUrl(
                    `club_logos/${dbData.logo}`,
                    "../images/default_logo.png"
                ).then((url) => {
                    console.log(`Club logo URL for ${dbData.logo}:`, url);
                    return url;
                }),
                ageRestriction:
                    dbData.age_restriction && dbData.age_restriction >= 16
                        ? `${dbData.age_restriction}+`
                        : "Unknown age restriction",
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
                            ? ageToDisplay < 18
                                ? "Not set"
                                : `${ageToDisplay}+`
                            : "Not set";
                }

                const hasSpecificOffer = dbData.opening_hours?.[day]?.daily_offer && dbData.opening_hours[day].daily_offer !== "";

                const hasMainOffer = mainOfferImgUrl !== null;
                if (offerButton) {
                    if (hasSpecificOffer) {
                        offerButton.textContent = "View Specific Offer";
                    } else if (hasMainOffer) {
                        offerButton.textContent = "View Main Offer";
                    } else {
                        offerButton.textContent = "Add Offer";
                    }
                    offerButton.classList.toggle("has-offer", hasSpecificOffer || hasMainOffer);
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
            ageRestriction: ageElem?.value?.replace("+", "") || "18",
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

    // Use modern MutationObserver instead of DOMSubtreeModified
    const ageElem = document.getElementById(`${today}-age`);
    const hoursElem = document.getElementById(`${today}-hours`);

    const observer = new MutationObserver(dynamicPreviewUpdate);
    if (ageElem) observer.observe(ageElem, {attributes: true, childList: true, subtree: true});
    if (hoursElem) observer.observe(hoursElem, {attributes: true, childList: true, subtree: true});

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
    popup.setAttribute("tabindex", "0"); // Make the popup focusable

    // Add header
    const header = document.createElement("h3");
    header.className = "popup-header";
    const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
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

    // Add Enter key support
    popup.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveButton.click();
        }
    });

    // Position popup near the hours element
    const rect = hoursElement.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(popup);

    // Focus the popup for immediate keyboard interaction
    popup.focus();

    // Close popup when clicking outside
    const closePopup = (e) => {
        if (!popup.contains(e.target) && e.target !== hoursElement) {
            popup.remove();
            document.removeEventListener("click", closePopup);
        }
    };
    setTimeout(() => document.addEventListener("click", closePopup), 0);
}

function showAgePicker(day, ageElement, onAgeSelect) {
    // Remove any existing popups
    const existingPopup = document.querySelector(".age-picker-popup");
    if (existingPopup) existingPopup.remove();

    // Create popup
    const popup = document.createElement("div");
    popup.className = "age-picker-popup";
    popup.setAttribute("tabindex", "0"); // Make the popup focusable

    // Add header
    const header = document.createElement("h3");
    header.className = "popup-header";
    const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
    header.textContent = `Age Restriction ${capitalizedDay}`;
    popup.appendChild(header);

    // Age input
    const ageLabel = document.createElement("label");
    ageLabel.textContent = "Age Limit:";
    const ageInput = document.createElement("input");
    ageInput.type = "number";
    ageInput.min = 16;
    ageInput.max = 35;
    // Set default to 16 if no age is chosen
    const currentAge = parseInt(ageElement.value.replace("+", ""));
    ageInput.value = ageElement.value === "Not set" || isNaN(currentAge) ? 16 : currentAge;
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
        const displayAge = newAge < 18 ? "??" : `${newAge}+`; // Fixed condition to < 18
        ageElement.value = displayAge;
        onAgeSelect(day, newAge);
        popup.remove();
    });
    popup.appendChild(saveButton);

    // Add Enter key support
    popup.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveButton.click();
        }
    });

    // Position popup near the age element
    const rect = ageElement.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(popup);

    // Focus the popup for immediate keyboard interaction
    popup.focus();

    // Close popup when clicking outside
    const closePopup = (e) => {
        if (!popup.contains(e.target) && e.target !== ageElement) {
            popup.remove();
            document.removeEventListener("click", closePopup);
        }
    };
    setTimeout(() => document.addEventListener("click", closePopup), 0);
}

function showOfferPopup(day, clubId, offerUrl, specificOfferPath, offerButton, hasSpecificOffer) {
    const popup = document.createElement("div");
    popup.className = "offer-popup";

    const header = document.createElement("h3");
    header.className = "popup-header";
    const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
    header.textContent = `Offer for ${capitalizedDay}`;
    popup.appendChild(header);

    const img = document.createElement("img");
    img.src = offerUrl || "../images/default_offer.png";
    img.alt = `Offer for ${day}`;
    img.style.maxWidth = "100%";
    img.style.maxHeight = "80vh";
    popup.appendChild(img);

    if (hasSpecificOffer) {
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete Specific Offer";
        deleteButton.addEventListener("click", async () => {
            if (confirm(`Are you sure you want to delete the specific offer for ${day}?`)) {
                localClubData.daily_offers[day] = ""; // Update locally
                offerButton.textContent = mainOfferImgUrl ? "View Main Offer" : "Add Offer";
                offerButton.classList.toggle("has-offer", mainOfferImgUrl !== null);
                alert(`Specific offer picture for ${day} deleted successfully. (Will be removed from storage on save)`);
                popup.remove();

                if (day === getTodayKey()) {
                    updateOfferImage(clubId, day);
                }
            }
        });
        popup.appendChild(deleteButton);
    }

    const uploadButton = document.createElement("button");
    uploadButton.textContent = "Upload Specific Offer";
    uploadButton.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.click();
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;

            try {
                const storagePath = `daily_offers/${clubId}_${day}.webp`;
                await uploadBytes(ref(storage, storagePath), file);
                localClubData.daily_offers[day] = `${clubId}_${day}.webp`; // Update locally
                offerButton.textContent = "View Specific Offer";
                offerButton.classList.add("has-offer");
                alert(`Specific offer picture for ${day} uploaded successfully.`);
                popup.remove();

                if (day === getTodayKey()) {
                    updateOfferImage(clubId, day);
                }
            } catch (error) {
                console.error(`Error uploading specific offer picture for ${day}:`, error);
                alert(`Failed to upload specific offer picture for ${day}.`);
            }
        };
    });
    popup.appendChild(uploadButton);

    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    popup.style.zIndex = "1000";

    document.body.appendChild(popup);

    const closePopup = (e) => {
        if (!popup.contains(e.target)) {
            popup.remove();
            document.removeEventListener("click", closePopup);
        }
    };
    setTimeout(() => document.addEventListener("click", closePopup), 0);
}

async function handleOfferAction(day, clubId, offerButton) {
    const hasSpecificOffer = offerButton.textContent === "View Specific Offer";
    const hasMainOffer = mainOfferImgUrl !== null;

    if (hasSpecificOffer || hasMainOffer) {
        const offerUrl = hasSpecificOffer
            ? await getOfferImageUrl(clubId, day)
            : mainOfferImgUrl;
        const specificOfferPath = hasSpecificOffer ? `daily_offers/${localClubData.daily_offers[day]}` : null;
        showOfferPopup(day, clubId, offerUrl, specificOfferPath, offerButton, hasSpecificOffer);
    } else {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.click();
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;

            offerButton.textContent = "Uploading...";
            offerButton.disabled = true;

            try {
                const storagePath = `daily_offers/${clubId}_${day}.webp`;
                await uploadBytes(ref(storage, storagePath), file);
                localClubData.daily_offers[day] = `${clubId}_${day}.webp`; // Update locally
                offerButton.textContent = "View Specific Offer";
                offerButton.classList.add("has-offer");
                alert(`Specific offer picture for ${day} uploaded successfully.`);

                if (day === getTodayKey()) {
                    updateOfferImage(clubId, day);
                }
            } catch (error) {
                console.error(`Error uploading specific offer picture for ${day}:`, error);
                alert(`Failed to upload specific offer picture for ${day}.`);
            } finally {
                offerButton.disabled = false;
            }
        };
    }
}

export async function getOfferImageUrl(clubId, day) {
    const clubData = clubDataCache.find(club => club.id === clubId) || localClubData;
    const dayData = clubData?.opening_hours?.[day];

    const offerFileName = dayData?.daily_offer ?? null;
    if (offerFileName) {
        const storagePath = `daily_offers/${offerFileName}`;
        try {
            const url = await getDownloadURL(ref(storage, storagePath));
            return url;
        } catch (error) {
            console.warn(`No offer image found for ${day}:`, error);
            return null;
        }
    }
    return null;
}


async function updateOfferImage(clubId, day) {
    const offerImage = document.querySelector(".offer-image img");
    const offerHeader = document.querySelector(".offer-image h2");
    if (day === getTodayKey()) {
        let offerUrl = await getOfferImageUrl(clubId, day); // Daily offer first
        if (!offerUrl) {
            offerUrl = mainOfferImgUrl; // Fall back to main offer
        }
        if (offerUrl) {
            offerImage.src = offerUrl;
            offerImage.style.display = "block";
            offerHeader.style.display = "block";
        } else {
            offerImage.style.display = "none";
            offerHeader.style.display = "none";
        }
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
