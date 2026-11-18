// ==========================================
// CONFIG
// ==========================================

// Եթե ֆրոնտը բացվում է նույն Render սերվերից, թողեք դատարկ։
// Եթե ֆրոնտը GitHub Pages-ում է (dawwwwo20.github.io), գրեք Render-ի հասցեն,
// օրինակ՝ "https://your-app.onrender.com"
const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://zenix-ai-y404.onrender.com";
const robot = document.getElementById("robot");
const mouth = document.querySelector(".robot-mouth");

const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const voiceBtn = document.getElementById("voiceBtn");
const messages = document.getElementById("messages");

let talking = false;
let busy = false;
let history = [];

let mediaRecorder = null;
let recordedChunks = [];
let listening = false;
let starting = false;

// ==========================================
// SESSION ID (յուրաքանչյուր օգտատիրոջ առանձին հիշողության համար)
// ==========================================

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function makeSessionId() {
    if (window.crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 12) +
        Math.random().toString(36).slice(2, 12)
    );
}

let fallbackSessionId = null;

function getSessionId() {
    try {
        const saved = localStorage.getItem("zenix_session");

        if (saved && SESSION_ID_PATTERN.test(saved)) {
            return saved;
        }

        const id = makeSessionId();
        localStorage.setItem("zenix_session", id);

        return id;

    } catch {
        // localStorage-ը անհասանելի է (օր.՝ private mode)
        if (!fallbackSessionId) fallbackSessionId = makeSessionId();

        return fallbackSessionId;
    }
}

const sessionId = getSessionId();


/* ==========================================
   ZENIX USER AUTHENTICATION
========================================== */

const AUTH_TOKEN_KEY = "zenix_auth_token";

let authToken = null;

try {
    authToken = localStorage.getItem(AUTH_TOKEN_KEY);
} catch (error) {
    console.error("AUTH STORAGE ERROR:", error);
}

function getAuthToken() {
    try {
        const token =
            localStorage.getItem(AUTH_TOKEN_KEY) ||
            sessionStorage.getItem(AUTH_TOKEN_KEY);

        authToken = token;

        if (!token) {
            throw new Error("AUTH_REQUIRED");
        }

        return token;

    } catch (error) {
        if (error.message === "AUTH_REQUIRED") {
            throw error;
        }

        throw new Error("AUTH_STORAGE_ERROR");
    }
}

function saveAuthToken(token, remember = true) {
    if (typeof token !== "string" || !token.trim()) {
        throw new Error("INVALID_AUTH_TOKEN");
    }

    try {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        sessionStorage.removeItem(AUTH_TOKEN_KEY);

        if (remember) {
            localStorage.setItem(AUTH_TOKEN_KEY, token);
        } else {
            sessionStorage.setItem(AUTH_TOKEN_KEY, token);
        }

        authToken = token;

    } catch (error) {
        console.error("AUTH TOKEN SAVE ERROR:", error);
        throw new Error("AUTH_STORAGE_ERROR");
    }
}
function saveAuthUser(data, remember = true) {
    if (!data || typeof data.name !== "string" || !data.name.trim()) {
        throw new Error("INVALID_AUTH_USER");
    }

    try {
        localStorage.removeItem("zenix_user_name");
        sessionStorage.removeItem("zenix_user_name");

        const storage = remember ? localStorage : sessionStorage;

        storage.setItem("zenix_user_name", data.name.trim());

    } catch (error) {
        console.error("AUTH USER SAVE ERROR:", error);
        throw new Error("AUTH_STORAGE_ERROR");
    }
}
function logoutUser() {
    try {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem("zenix_user_name");
sessionStorage.removeItem("zenix_user_name");
    } catch (error) {
        console.error("AUTH LOGOUT ERROR:", error);
    }

    authToken = null;
    window.location.href = "register.html";
}
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[char];
    });
}


function updateAuthArea() {
    const authArea = document.getElementById("authArea");

    if (!authArea) return;

    const userName =
        localStorage.getItem("zenix_user_name") ||
        sessionStorage.getItem("zenix_user_name");

    if (userName) {
        authArea.innerHTML = `
            <div class="auth-user">
                <span class="user-profile">
    <i data-lucide="user-round"></i>
                    ${escapeHTML(userName)}
                </span>

                <button class="logout-button"
                    onclick="logoutUser()"
                    title="Ելք"
                    aria-label="Ելք">
                    ↪
                </button>
            </div>
        `;
    } else {
        authArea.innerHTML = `
            <a href="register.html" class="auth-link">
                Մուտք / Գրանցում
            </a>
        `;
    }
}

updateAuthArea();

// ==========================================
// ZENIX LOGIN AND REGISTER
// ==========================================

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

const loginButton = document.getElementById("login-button");
const registerButton = document.getElementById("register-button");

const authMessage = document.getElementById("auth-message");

function showAuthMessage(message, isError = false) {
    if (!authMessage) {
        alert(message);
        return;
    }

    authMessage.hidden = false;
    authMessage.textContent = message;
    authMessage.style.color = isError ? "#ff7777" : "#00d5ff";
    authMessage.style.marginTop = "15px";
    authMessage.style.fontSize = "13px";
    authMessage.style.textAlign = "center";
}

function setAuthLoading(button, loading, originalText) {
    if (!button) return;

    button.disabled = loading;
    button.style.opacity = loading ? "0.6" : "1";
    button.style.cursor = loading ? "wait" : "pointer";

    button.innerHTML = loading
        ? "Խնդրում եմ սպասիր..."
        : originalText;
}

async function authRequest(endpoint, payload) {
    const response = await fetch(API_BASE + endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error("Սերվերը սխալ պատասխան է վերադարձրել։");
    }

    if (!response.ok || !data.success) {
        const errors = {
            ALL_FIELDS_REQUIRED: "Լրացրու բոլոր դաշտերը։",
            INVALID_NAME: "Անունը պետք է լինի 2-50 նիշ։",
            INVALID_EMAIL: "Էլեկտրոնային փոստը ճիշտ չէ։",
            INVALID_PASSWORD: "Գաղտնաբառը պետք է լինի առնվազն 8 նիշ։",
            EMAIL_ALREADY_REGISTERED: "Այս էլեկտրոնային փոստով արդեն գրանցվել ես։",
            EMAIL_AND_PASSWORD_REQUIRED: "Լրացրու էլեկտրոնային փոստն ու գաղտնաբառը։",
            INVALID_CREDENTIALS: "Էլեկտրոնային փոստը կամ գաղտնաբառը սխալ է։",
            REGISTRATION_FAILED: "Գրանցումը չհաջողվեց։",
            LOGIN_FAILED: "Մուտքը չհաջողվեց։"
        };

        throw new Error(
            errors[data.error] || data.error || "Գործողությունը չհաջողվեց։"
        );
    }

    return data;
}

// REGISTER
async function registerUser() {
    if (!registerForm || !registerButton) return;

    if (!registerForm.reportValidity()) return;

    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (password !== confirmPassword) {
        showAuthMessage("Գաղտնաբառերը չեն համընկնում։", true);
        return;
    }

    const originalText = "ԳՐԱՆՑՎԵԼ <span>→</span>";

    try {
        setAuthLoading(registerButton, true, originalText);

        const data = await authRequest("/api/register", {
            name,
            email,
            password
        });

        saveAuthToken(data.token, true);
saveAuthUser(data, true);
        showAuthMessage("Գրանցումը հաջողվեց։ Բարի գալուստ ZENIX։");

        window.location.href = "index.html";

    } catch (error) {
        console.error("ZENIX REGISTER ERROR:", error);
        showAuthMessage(error.message, true);

    } finally {
        setAuthLoading(registerButton, false, originalText);
    }
}

// LOGIN
async function loginUser() {
    if (!loginForm || !loginButton) return;

    if (!loginForm.reportValidity()) return;

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    const remember = document.getElementById("remember-me")?.checked ?? false;

    const originalText = "ՄՈՒՏՔ ԳՈՐԾԵԼ <span>→</span>";

    try {
        setAuthLoading(loginButton, true, originalText);

        const data = await authRequest("/api/login", {
            email,
            password
        });

        saveAuthToken(data.token, remember);
saveAuthUser(data, remember);
        showAuthMessage("Մուտքը հաջողվեց։ Բարի վերադարձ։");

        window.location.href = "index.html";

    } catch (error) {
        console.error("ZENIX LOGIN ERROR:", error);
        showAuthMessage(error.message, true);

    } finally {
        setAuthLoading(loginButton, false, originalText);
    }
}

if (loginButton) {
    loginButton.addEventListener("click", loginUser);
}

if (registerButton) {
    registerButton.addEventListener("click", registerUser);
}

if (loginForm) {
    loginForm.addEventListener("submit", event => {
        event.preventDefault();
        loginUser();
    });
}

if (registerForm) {
    registerForm.addEventListener("submit", event => {
        event.preventDefault();
        registerUser();
    });
}

if (authMessage) {
    const forgotPassword = document.getElementById("forgot-password");

    if (forgotPassword) {
        forgotPassword.addEventListener("click", event => {
            event.preventDefault();

            showAuthMessage(
                "Գաղտնաբառի վերականգնումը դեռ միացված չէ։"
            );
        });
    }
}
// ==========================================
// ROBOT ANIMATIONS
// ==========================================


function startTalking() {
    talking = true;

    if (mouth) mouth.classList.add("talking");
    if (robot) robot.classList.add("talking");
}

function stopTalking() {
    talking = false;

    if (mouth) mouth.classList.remove("talking");
    if (robot) robot.classList.remove("talking");
}

function robotTalk() {
    startTalking();

    setTimeout(() => {
        stopTalking();
    }, 1800);
}

// ZENIX greeting animation
function waveRobot() {
    if (!robot) return;

    robot.classList.remove("waving");

    // Restart animation
    void robot.offsetWidth;

    robot.classList.add("waving");

    setTimeout(() => {
        robot.classList.remove("waving");
    }, 3400);
}

// Detect greetings
function checkGreeting(text) {
    const normalized = text
        .toLowerCase()
        .normalize("NFC")
        .replace(/[!?.,։՝՛]/g, "")
        .trim();

    const greetings = [
        "բարև",
        "բարև ձեզ",
        "բարև զենիքս",
        "բարև zenix",
        "hello",
        "hi",
        "privet",
        "привет",
        "здравствуй"
    ];

    return greetings.some(greeting =>
        normalized === greeting ||
        normalized.startsWith(greeting + " ")
    );
}

// ==========================================
// CHAT MESSAGES
// ==========================================

function addMessage(text, sender = "bot") {
    const message = document.createElement("div");

    message.className = sender === "user"
        ? "message user-message"
        : "message";

    message.textContent = text;

    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;

    return message;
}

function showLoading() {
    const loading = document.createElement("div");

    loading.className = "message loading-message";
    loading.textContent = "ZENIX մտածում է... 💙";

    messages.appendChild(loading);
    messages.scrollTop = messages.scrollHeight;

    return loading;
}

// ==========================================
// VOICE OUTPUT (դեռ անջատված է. տե՛ս sendMessage)
// ==========================================

// Convert base64 audio to WAV
function base64ToWav(base64, sampleRate = 24000) {
    const binary = atob(base64);
    const length = binary.length;

    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);

    function writeString(offset, value) {
        for (let i = 0; i < value.length; i++) {
            view.setUint8(offset + i, value.charCodeAt(i));
        }
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length, true);

    for (let i = 0; i < length; i++) {
        view.setUint8(44 + i, binary.charCodeAt(i));
    }

    return new Blob([buffer], { type: "audio/wav" });
}

// Browser voice fallback
function speakWithBrowser(text) {
    return new Promise((resolve, reject) => {
        if (
            !("speechSynthesis" in window) ||
            typeof SpeechSynthesisUtterance === "undefined"
        ) {
            reject(new Error("Browser speech is not supported."));
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        utterance.lang = "hy-AM";
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 1;

        const voices = window.speechSynthesis.getVoices();

        const armenianVoice = voices.find(voice =>
            /^hy(-|$)/i.test(voice.lang)
        );

        if (armenianVoice) {
            utterance.voice = armenianVoice;
        }

        utterance.onstart = () => {
            startTalking();
        };

        utterance.onend = () => {
            stopTalking();
            resolve();
        };

        utterance.onerror = event => {
            stopTalking();
            reject(new Error(event.error || "Browser voice error"));
        };

        window.speechSynthesis.speak(utterance);
    });
}

// Main ZENIX voice
async function speakReply(text) {
    let audioUrl = null;

    try {
        const response = await fetch(API_BASE + "/api/speech", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Speech API error");
        }

        if (!data.audio) {
            throw new Error("No audio received.");
        }

        const mimeType = String(data.mimeType || "").toLowerCase();

        let audioBlob;

        if (mimeType.includes("wav")) {
            const binary = atob(data.audio);
            const bytes = new Uint8Array(binary.length);

            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            audioBlob = new Blob([bytes], { type: "audio/wav" });
        } else {
            const match = mimeType.match(/rate=(\d+)/i);
            const sampleRate = match ? Number(match[1]) : 24000;

            audioBlob = base64ToWav(data.audio, sampleRate);
        }

        audioUrl = URL.createObjectURL(audioBlob);

        const audio = new Audio(audioUrl);

        startTalking();

        await new Promise((resolve, reject) => {
            audio.onended = resolve;

            audio.onerror = () => {
                reject(new Error("Audio playback failed."));
            };

            audio.play().catch(reject);
        });

    } catch (error) {
        stopTalking();

        console.warn(
            "GEMINI VOICE UNAVAILABLE. USING BROWSER VOICE:",
            error.message
        );

        try {
            await speakWithBrowser(text);

        } catch (browserError) {
            stopTalking();

            console.error("BROWSER VOICE ERROR:", browserError);

            addMessage("ZENIX-ի ձայնը հիմա անհասանելի է։ ❤️");
        }

    } finally {
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
    }
}

// ==========================================
// SEND MESSAGE
// ==========================================
async function sendMessage() {
    if (!input || !messages) return;

    const text = input.value.trim();

    if (!text || busy) return;

    let token;

    try {
        token = getAuthToken();
    } catch (error) {
        logoutUser();
        return;
    }

    if (checkGreeting(text)) {
        waveRobot();
    }

    busy = true;

    input.value = "";

    addMessage(text, "user");

    history.push({
        role: "user",
        text
    });

    const loading = showLoading();

    if (sendBtn) sendBtn.disabled = true;

    try {
        const response = await fetch(API_BASE + "/api/chat", {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },

            body: JSON.stringify({
                history
            })
        });

        const data = await response.json();

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (!response.ok) {
            throw new Error(
                data.error || "ZENIX CHAT ERROR"
            );
        }

        if (typeof data.reply !== "string" || !data.reply.trim()) {
            throw new Error("ZENIX-ը դատարկ պատասխան է վերադարձրել։");
        }

        history.push({
            role: "assistant",
            text: data.reply
        });

        addMessage(data.reply, "bot");

        robotTalk();

    } catch (error) {
        console.error("ZENIX CHAT ERROR:", error);

        addMessage(
            "Ներողություն, կապի ժամանակ սխալ առաջացավ։ Փորձիր կրկին։"
        );

    } finally {
        loading.remove();

        busy = false;

        if (sendBtn) sendBtn.disabled = false;

        if (input) input.focus();
    }
}
// Send button
if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
}

// Enter key
if (input) {
    input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
}

// ==========================================
// MICROPHONE
// ==========================================

// Start microphone recording
async function startListening() {
    if (listening || starting) return;

    if (
        !navigator.mediaDevices?.getUserMedia ||
        !window.MediaRecorder
    ) {
        addMessage("Քո դիտարկիչը չի աջակցում ձայնագրությանը։");
        return;
    }

    starting = true;
    let stream = null;

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        recordedChunks = [];

        const mimeTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4"
        ];

        const mimeType = mimeTypes.find(type =>
            MediaRecorder.isTypeSupported(type)
        );

        const recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);

        mediaRecorder = recorder;

        recorder.ondataavailable = event => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        recorder.onstop = async () => {
            const actualMimeType = recorder.mimeType || "audio/webm";

            const blob = new Blob(recordedChunks, {
                type: actualMimeType
            });

            stream.getTracks().forEach(track => track.stop());

            await sendAudioForTranscription(blob, actualMimeType);
        };

        recorder.start();

        listening = true;

        voiceBtn.textContent = "⏹";
        voiceBtn.classList.add("listening");

        addMessage("Լսում եմ քեզ... Խոսիր, հետո սեղմիր ⏹ ❤️");

    } catch (error) {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        listening = false;

        addMessage("Չհաջողվեց միացնել խոսափողը։ Թույլատրիր մուտքը։");

        console.error("MICROPHONE ERROR:", error);

    } finally {
        starting = false;
    }
}

// Stop recording
function stopListening() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }

    listening = false;

    if (voiceBtn) {
        voiceBtn.textContent = "🎤";
        voiceBtn.classList.remove("listening");
    }
}

// Send recorded audio to server
async function sendAudioForTranscription(blob, mimeType) {
    if (!blob.size) {
        addMessage("Ձայնագրությունը դատարկ է։");
        return;
    }

    const reader = new FileReader();

    reader.onloadend = async () => {
        try {
            const base64 = reader.result.split(",")[1];

            addMessage("ZENIX-ը լսում է ձայնագրությունը... 🎧");

            const response = await fetch(API_BASE + "/api/transcribe", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    audio: base64,
                    mimeType
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Ձայնի ճանաչման սխալ");
            }

            if (!data.text) {
                throw new Error("Չհաջողվեց ճանաչել խոսքը։");
            }

            input.value = data.text;

            await sendMessage();

        } catch (error) {
            console.error("TRANSCRIPTION ERROR:", error);

            const message = String(error.message || "").toLowerCase();

            if (
                message.includes("quota") ||
                message.includes("429") ||
                message.includes("resource_exhausted")
            ) {
                addMessage(
                    "ZENIX-ի ձայնային ծառայության անվճար սահմանաչափը սպառվել է։ ❤️ Փորձիր ավելի ուշ։"
                );
            } else {
                addMessage(
                    "Ձայնի ճանաչման ժամանակ սխալ տեղի ունեցավ։ Խնդրում եմ կրկին փորձիր։"
                );
            }
        }
    };

    reader.onerror = () => {
        addMessage("Չհաջողվեց կարդալ ձայնագրությունը։");
        console.error("AUDIO FILE ERROR:", reader.error);
    };

    reader.readAsDataURL(blob);
}

// Microphone button
if (voiceBtn) {
    voiceBtn.type = "button";

    voiceBtn.addEventListener("click", () => {
        if (listening) {
            stopListening();
        } else {
            startListening();
        }
    });
}

// ==========================================
// START
// ==========================================

console.log("ZENIX CHAT CONNECTED! 💙");

// Ողջույնի անիմացիա էջը բացվելիս (ինքն էլ անջատվում է)
waveRobot();
