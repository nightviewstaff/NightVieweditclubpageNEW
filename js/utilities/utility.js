// utiliy.js

export function getTodayKey() {
    return new Date().toLocaleDateString("en-US", {weekday: "long"}).toLowerCase();
}

export function toTitleCase(str) {
    if (typeof str !== "string" || !str.trim()) return "";

    return str
        .toLowerCase()
        .split(/\s+/) // handles multiple spaces, tabs, newlines
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function nameFormatter(string) {
    if (typeof string !== 'string') return '';

    let formatted = string
        .toLowerCase()
        .replace(/[-_]+/g, ' ')              // Replace hyphens/underscores with spaces
        .replace(/\s+/g, ' ')               // Collapse multiple spaces
        .trim()                             // Remove surrounding whitespace
        .split(' ')                         // Split into words
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize
        .join(' ');                         // Rejoin words

    // ✅ Remove number-only suffix
    const parts = formatted.split(' ');
    if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
        parts.pop();
        formatted = parts.join(' ');
    }

    return formatted;
}


export function toLowerCaseString(str) {
    return typeof str === "string" ? str.toLowerCase() : "";
}

export function formatFullDateTime(dateStr) {
    const date = new Date(dateStr);

    const weekday = date.toLocaleDateString('en-US', {weekday: 'long'});
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-based
    const year = String(date.getFullYear()).slice(-2);
    const time = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // set to true for AM/PM
    });

    return `${weekday} ${day}-${month}-${year} ${time}`;
}

export function calculateUserAge(user) {
    const birthDate = new Date(user.birthdate_year, user.birthdate_month - 1, user.birthdate_day); // JS months are 0-based
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const hasHadBirthdayThisYear =
        today.getMonth() > birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

    if (!hasHadBirthdayThisYear) {
        age--;
    }

    return age;
}

export function getUserNationality(user) {
    if (user.phone.startsWith('+45')) {
        return "Danish";
    } else {
        return "International";
    }
}

export function getUserGender(user) {
    const gender = (user?.gender || '').toString().trim().toLowerCase();

    if (['f', 'female'].includes(gender)) return 'F';
    if (['m', 'male'].includes(gender)) return 'M';

    return 'M'; // Default to 'M' if unknown
}


export function generateCorrectID(name) {

    return;
}

/**
 * Converts any image File to a WebP Blob using canvas.
 * @param {File} file - The original image file.
 * @returns {Promise<Blob>} - The converted WebP blob.
 */
export async function convertToWebP(file) {

    //TODO Check if already Webp and return if.
    if (file.type === "image/webp") {
        return;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.src = e.target.result;
        };

        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("WebP conversion failed"));
            }, "image/webp", 0.8); // You can adjust quality if needed
        };

        reader.onerror = reject;
        img.onerror = reject;

        reader.readAsDataURL(file);
    });
}

export function formatFiltersReadable(filters) {
    if (filters === 'all') return 'All followers';
    if (filters === 'male') return 'All male followers';
    if (filters === 'female') return 'All female followers';
    if (filters === 'danish') return 'All Danish followers';
    if (filters === 'international') return 'All international followers';

    if (!filters || typeof filters !== 'object') return 'No filters';

    const genderMap = { F: 'Female', M: 'Male' };
    const allGenders = ['F', 'M'];
    const allNationalities = ['Danish', 'International'];

    const agePart = filters.ages && filters.ages.length > 0
        ? `Ages: ${groupConsecutiveNumbers(filters.ages)}`
        : '';

    const genderPart = filters.genders && filters.genders.length > 0
        ? filters.genders.length === allGenders.length && allGenders.every(g => filters.genders.includes(g))
            ? 'All genders'
            : `Genders: ${filters.genders.map(g => genderMap[g] || g).join(', ')}`
        : '';

    const nationalityPart = filters.nationalities && filters.nationalities.length > 0
        ? filters.nationalities.length === allNationalities.length && allNationalities.every(n => filters.nationalities.includes(n))
            ? 'All nationalities'
            : `Nationalities: ${filters.nationalities.join(', ')}`
        : '';

    return [agePart, genderPart, nationalityPart]
        .filter(Boolean)
        .join('\n');
}

function groupConsecutiveNumbers(numbers) {
    if (!numbers || numbers.length === 0) return '';

    const sorted = [...numbers].map(Number).sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === end + 1) {
            end = sorted[i];
        } else {
            ranges.push(start === end ? `${start}` : `${start}-${end}`);
            start = end = sorted[i];
        }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);

    return ranges.join(', ');
}

export function formatDayDifference(date) {
    const target = new Date(date);
    const now = new Date();

    // Reset times to compare dates only
    target.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.round((target - now) / msPerDay);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1) return `In ${diffDays} days`;
    if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
}

/**
 * Gets the next valid party day (Friday/Saturday or optionally Thursday)
 * at a smart time between preferred hours and at least 70 mins into the future.
 */
export function getNextDefaultPartyDay(includeThursday = false) {
    const now = new Date();
    const minTime = new Date(now.getTime() + 70 * 60 * 1000); // +70 minutes

    const preferredDays = includeThursday ? [4, 5, 6] : [5, 6]; // Thursday=4, Friday=5, Saturday=6

    // Time windows by day
    const timeWindows = {
        4: [17, 18, 19, 20, 21, 22],// Thursday: 17:00-22:00
        5: [17, 18, 19, 20, 21, 22], // Friday: 17:00–22:00
        6: [15, 16, 17, 18, 19, 20, 21, 22]  // Saturday: 15:00–22:00
    };

    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const testDate = new Date(now);
        testDate.setDate(now.getDate() + dayOffset);
        const dayOfWeek = testDate.getDay();

        if (!preferredDays.includes(dayOfWeek)) continue;

        for (const hour of timeWindows[dayOfWeek] || []) {
            const potential = new Date(testDate);
            potential.setHours(hour, 0, 0, 0);

            if (potential > minTime) {
                return potential;
            }
        }
    }

    // Fallback: next Friday at 17:00
    const fallback = new Date(minTime);
    const day = fallback.getDay();
    const daysUntilFriday = (5 + 7 - day) % 7 || 7;
    fallback.setDate(fallback.getDate() + daysUntilFriday);
    fallback.setHours(17, 0, 0, 0);
    return fallback;
}

export function formatGeoCoord(num) {
    const str = num.toString();
    const parts = str.split(".");
    if (parts.length === 1) return `${str}.000000`;
    const decimals = parts[1].length;
    if (decimals < 6) return `${str}${"0".repeat(6 - decimals)}`;
    return str;
  }  



export function genericPopup() {

}




