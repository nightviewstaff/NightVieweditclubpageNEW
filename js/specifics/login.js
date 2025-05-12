// login.js

import {loginWithEmailPassword} from "../api/firebase-api.js";
import {saveSession} from "../utilities/session.js";
import {showAlert} from "../utilities/custom-alert.js";
import {swalTypes, swalPositions} from "../utilities/constants.js";


document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitButton = document.getElementById('submit-btn');

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
        try {
            const {user, role} = await loginWithEmailPassword(email, password);
            saveSession(user.uid, role);
            console.log("✅ Logged in as:", user.email);
            window.location.href = `${window.location.origin}/NightVieweditclubpage/html/club-overview.html`;
        } catch (err) {
            showAlert({
                title: 'Invalid login',
                text: 'Email or password is incorrect.',
                // footer: 'Contact business@nightview.dk if login problems persist.',
                position: swalPositions.top
            });
            console.log(err)
            submitButton.disabled = false;
        }
    });
});


