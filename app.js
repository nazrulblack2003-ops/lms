const API_URL = 'http://localhost:3000/api';
const TOKEN_KEY = 'lms_token';
const USER_KEY = 'lms_user';


function saveAuth(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function getUser() {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
}

function getUserRole() {
    const user = getUser();
    return user ? user.role : null;
}

function isAuthenticated() {
    return !!getToken();
}

function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = 'index.html';
}


async function apiRequest(endpoint, method = 'GET', data = null) {
    const url = `${API_URL}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const token = getToken();
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Request failed');
        }

        return result;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}


function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showLogin() {
    showModal('loginModal');
}

function showRegister() {
    showModal('registerModal');
}


if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    
    if (isAuthenticated()) {
        const role = getUserRole();
        if (role === 'learner') {
            window.location.href = 'learner-dashboard.html';
        } else if (role === 'instructor') {
            window.location.href = 'instructor-dashboard.html';
        } else if (role === 'organization') {
            window.location.href = 'organization-dashboard.html';
        }
    }

    
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await apiRequest('/auth/login', 'POST', { email, password });

            saveAuth(response.token, response.user);

            
            const role = response.user.role;
            if (role === 'learner') {
                window.location.href = 'learner-dashboard.html';
            } else if (role === 'instructor') {
                window.location.href = 'instructor-dashboard.html';
            } else if (role === 'organization') {
                window.location.href = 'organization-dashboard.html';
            }
        } catch (error) {
            const errorElement = document.getElementById('loginError');
            errorElement.textContent = error.message || 'Login failed';
            errorElement.classList.remove('hidden');
        }
    });

    
    document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const role = document.getElementById('registerRole').value;

        if (!role) {
            const errorElement = document.getElementById('registerError');
            errorElement.textContent = 'Please select a role';
            errorElement.classList.remove('hidden');
            return;
        }

        try {
            const response = await apiRequest('/auth/register', 'POST', {
                username,
                email,
                password,
                role
            });

            saveAuth(response.token, response.user);

            
            if (role === 'learner') {
                window.location.href = 'learner-dashboard.html';
            } else if (role === 'instructor') {
                window.location.href = 'instructor-dashboard.html';
            } else if (role === 'organization') {
                window.location.href = 'organization-dashboard.html';
            }
        } catch (error) {
            const errorElement = document.getElementById('registerError');
            errorElement.textContent = error.message || 'Registration failed';
            errorElement.classList.remove('hidden');
        }
    });

    
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });
}
