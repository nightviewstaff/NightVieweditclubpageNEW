import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js';
import { app, db } from "../api/firebase-api.js"; // Import the initialized app
import { saveSession } from "../utilities/session.js";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitButton = document.getElementById('submit-btn');
    const tagline = document.getElementById('tagline');
    const langDk = document.getElementById('lang-dk');
    const langEn = document.getElementById('lang-en');

    emailInput.focus();

    const checkInputs = () => {
        const filled = emailInput.value.trim() !== '' && passwordInput.value.trim() !== '';
        submitButton.disabled = !filled;
    };

    emailInput.addEventListener('input', checkInputs);
    passwordInput.addEventListener('input', checkInputs);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitButton.disabled = true;

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const auth = getAuth(app);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const role = await fetchUserRole(user.uid);

            saveSession(user.uid, role);

            console.log("✅ Logged in as:", userCredential.user.email);
            window.location.href = `${window.location.origin}/NightVieweditclubpage/html/club-overview.html`;
        } catch (err) {
            console.error("Login failed:", err.message);
            alert("Invalid log in");
            submitButton.disabled = false;
        }
    });

    async function fetchUserRole(uid) {
        const docSnap = await getDoc(doc(db, "user_data", uid));
        if (!docSnap.exists()) return 'user';
        const data = docSnap.data();

        if (data.is_admin === true) return 'admin';
        if (Array.isArray(data.owned_clubs) && data.owned_clubs.length > 0) return 'owner';
        if (Array.isArray(data.staff_clubs) && data.staff_clubs.length > 0) return 'staff';

        return 'user';
    }

});
