// login.js

import {loginWithEmailPassword} from "/js/api/firebase-api.js";
import {saveSession} from "/js/utilities/session.js";
import {showAlert} from "/js/utilities/custom-alert.js";
import {swalPositions} from "/js/utilities/constants.js";
import {hideLoading, showLoading} from "/js/utilities/loading-indicator.js";


document.addEventListener('DOMContentLoaded', () => {
    // showLoading(); // Test
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

    [emailInput, passwordInput].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent default enter behavior
                if (!submitButton.disabled) {
                    form.requestSubmit(); // Triggers form's submit event
                }
            }
        });
    });

    form.addEventListener('submit', async (e) => {
        showLoading();
        e.preventDefault();
        submitButton.disabled = true;
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        try {
            const {user, role} = await loginWithEmailPassword(email, password);
            saveSession(user.uid, role);
            console.log("✅ Logged in as:", user.email);
            window.location.href = `${window.location.origin}/club-overview.html`;
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
        hideLoading();
    });
});


