
    const robot = document.getElementById("robot");
    const eyes = document.querySelectorAll(".eye");
    const arms = document.querySelectorAll(".arm");
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

    // Chat messages

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

    // ZENIX speaks

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

            console.log(
                "ZENIX BROWSER VOICE:",
                armenianVoice?.name || "Default browser voice",
                armenianVoice?.lang || "hy-AM"
            );

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
            const response = await fetch("/api/speech", {
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

                audioBlob = new Blob([bytes], {
                    type: "audio/wav"
                });
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

                console.error(
                    "BROWSER VOICE ERROR:",
                    browserError
                );

                addMessage(
                    "ZENIX-ի ձայնը հիմա անհասանելի է։ ❤️"
                );
            }

        } finally {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        }
    }


    // Send message
    async function sendMessage() {
        const text = input.value.trim();
    if (checkGreeting(text)) {
        waveRobot();
    }
        if (!text || busy) return;

        busy = true;

        if (sendBtn) sendBtn.disabled = true;

        addMessage(text, "user");

        history.push({
            role: "user",
            text
        });

        input.value = "";

        const loading = showLoading();

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ history })
            });
    console.log("ZENIX SERVER STATUS:", response.status);

    const data = await response.json();

            loading.remove();

            if (!response.ok) {
                throw new Error(data.error || "Սերվերի սխալ");
            }

            const reply = data.reply || "Չկարողացա պատասխանել։";

            addMessage(reply);

            history.push({
                role: "model",
                text: reply
            });

            if (history.length > 20) {
                history = history.slice(-20);
            }

        
    // ZENIX VOICE DISABLED
        } catch (error) {
            loading.remove();

            addMessage("Սխալ՝ " + error.message);

            console.error("CHAT ERROR:", error);

        } finally {
            busy = false;

            if (sendBtn) sendBtn.disabled = false;

            input.focus();
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
                const actualMimeType =
                    recorder.mimeType || "audio/webm";

                const blob = new Blob(recordedChunks, {
                    type: actualMimeType
                });

                stream.getTracks().forEach(track => track.stop());

                await sendAudioForTranscription(
                    blob,
                    actualMimeType
                );
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

                const response = await fetch("/api/transcribe", {
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
                    throw new Error(
                        data.error || "Ձայնի ճանաչման սխալ"
                    );
                }

                if (!data.text) {
                    throw new Error("Չհաջողվեց ճանաչել խոսքը։");
                }

                input.value = data.text;

                await sendMessage();

            } catch (error) {
                console.error("TRANSCRIPTION ERROR:", error);

                const message = String(
                    error.message || ""
                ).toLowerCase();

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

    console.log("ZENIX MICROPHONE EVENT REGISTERED!");
    console.log("ZENIX CHAT CONNECTED! 💙");
    document.getElementById("robot").classList.add("waving");
    getComputedStyle(document.querySelector(".right-arm")).animationName