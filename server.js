    const path = require("path");
    const fs = require("fs");
    const express = require("express");
    const dotenv = require("dotenv");

    dotenv.config({ override: true });

    const app = express();

app.use((req, res, next) => {
    res.header(
        "Access-Control-Allow-Origin",
        "https://dawwwwo20.github.io"
    );

    res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
    );

    res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

const PORT = process.env.PORT || 3000;
    const MEMORY_FILE = path.join(__dirname, "memory.json");
    const MEMORY_TEMP_FILE = MEMORY_FILE + ".tmp";
    const MEMORY_BACKUP_FILE = MEMORY_FILE + ".backup";

    app.use(express.json({ limit: "15mb" }));
    app.use(express.static(__dirname));

    app.get("/", (req, res) => {
        res.sendFile(path.join(__dirname, "index.html"));
    });

    app.get("/cods.js", (req, res) => {
        res.sendFile(path.join(__dirname, "cods.js"));
    });

    // ==========================================
    // LANGUAGE REPLIES
    // ==========================================

    function reply(armenian, russian, english, language = "Armenian") {
        const lang = String(language || "").toLowerCase();

        if (lang.startsWith("russian") || lang === "ru") return russian;
        if (lang.startsWith("english") || lang === "en") return english;

        return armenian;
    }

    // ==========================================
    // MEMORY STRUCTURE
    // ==========================================

  
function emptyMemory() {
    return {
        facts: [],
        preferences: [],
        interests: [],
        devices: [],
        user_name: "",
        youtube_channel: "",
        pending_memory: null
    };
}

    function normalizeText(text) {
        return String(text || "")
            .normalize("NFC")
            .toLowerCase()
            .replace(/[՞?։!՝,]/gu, " ")
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function cleanPreferenceWord(value) {
        return String(value || "")
            .normalize("NFC")
            .replace(/[.!?։՝,]+$/gu, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function normalizePreferenceCategory(value) {
        const category = normalizeText(value);

        const aliases = {
            "միրգ": "միրգ",
            "մրգ": "միրգ",
            "գույն": "գույն",
            "խաղ": "խաղ",
            "կենդանի": "կենդանի",
            "երաժշտություն": "երաժշտություն",
            "սպորտ": "սպորտ",
            "ավտոմեքենա": "մեքենա",
            "մեքենա": "մեքենա",
"սպորտաձև": "սպորտ",
            "սպորտաձևը": "սպորտ",
            "игра": "խաղ",
            "цвет": "գույն",
            "животное": "կենդանի",
            "фрукт": "միրգ",
            "музыка": "երաժշտություն",
            "спорт": "սպորտ",
            "машина": "մեքենա",
            "автомобиль": "մեքենա",

            "game": "խաղ",
            "games": "խաղ",
            "color": "գույն",
            "colour": "գույն",
            "animal": "կենդանի",
            "fruit": "միրգ",
            "music": "երաժշտություն",
            "sport": "սպորտ",
            "car": "մեքենա",

        };

        if (aliases[category]) return aliases[category];

        return category.replace(/(?:ը|ն)$/u, "");
    }

    // ==========================================
    // MEMORY VALIDATION
    // ==========================================

   
function normalizeMemory(memory) {
    const result = emptyMemory();

    if (!memory || typeof memory !== "object" || Array.isArray(memory)) {
        return result;
    }

    // Պահպանում ենք բոլոր լրացուցիչ դաշտերը։
    Object.assign(result, memory);

    for (const key of ["facts", "preferences", "interests", "devices"]) {
        result[key] = Array.isArray(memory[key])
            ? [...new Set(
                memory[key].filter(item => typeof item === "string")
            )]
            : [];
    }

    result.user_name =
        typeof memory.user_name === "string" ? memory.user_name : "";

    result.youtube_channel =
        typeof memory.youtube_channel === "string"
            ? memory.youtube_channel
            : "";

    result.pending_memory =
        memory.pending_memory &&
        typeof memory.pending_memory === "object" &&
        !Array.isArray(memory.pending_memory)
            ? memory.pending_memory
            : null;

    return result;
}


    // ==========================================
    // MEMORY BACKUP
    // ==========================================

    function createMemoryBackup() {
        try {
            if (!fs.existsSync(MEMORY_FILE)) return true;

            const current = fs.readFileSync(MEMORY_FILE, "utf8");

            // Պահուստավորում ենք միայն վավեր JSON-ը։
            JSON.parse(current);

            fs.copyFileSync(MEMORY_FILE, MEMORY_BACKUP_FILE);

            console.log("ZENIX MEMORY BACKUP UPDATED!");
            return true;
        } catch (error) {
            console.error("MEMORY BACKUP ERROR:", error.message);
            return false;
        }
    }

    // ==========================================
    // LOAD MEMORY
    // ==========================================

    function loadMemory() {
        try {
            if (!fs.existsSync(MEMORY_FILE)) {
                return emptyMemory();
            }

            const data = fs.readFileSync(MEMORY_FILE, "utf8");
            return normalizeMemory(JSON.parse(data));

        } catch (error) {
            console.error("MEMORY READ ERROR:", error.message);

            // Եթե հիմնական հիշողությունը վնասված է,
            // փորձում ենք վերականգնել backup-ից։
            try {
                if (fs.existsSync(MEMORY_BACKUP_FILE)) {
                    const backupData = fs.readFileSync(
                        MEMORY_BACKUP_FILE,
                        "utf8"
                    );

                    const restored = normalizeMemory(JSON.parse(backupData));

                    console.log("ZENIX MEMORY RESTORED FROM BACKUP!");

                    return restored;
                }
            } catch (backupError) {
                console.error(
                    "MEMORY BACKUP READ ERROR:",
                    backupError.message
                );
            }

            return emptyMemory();
        }
    }

    // ==========================================
    // SAVE MEMORY
    // ==========================================

    function saveMemory(memory) {
        try {
            const safeMemory = normalizeMemory(memory);

            // Նախ պահուստավորում ենք գործող հիշողությունը։
            if (!createMemoryBackup()) {
                console.warn("ZENIX: BACKUP COULD NOT BE UPDATED.");
            }

            // Նախ գրում ենք ժամանակավոր ֆայլում։
            fs.writeFileSync(
                MEMORY_TEMP_FILE,
                JSON.stringify(safeMemory, null, 4),
                "utf8"
            );

            // Փոխարինում ենք հիմնական ֆայլը։
            // Հին ֆայլը նախապես չենք ջնջում։
            fs.renameSync(MEMORY_TEMP_FILE, MEMORY_FILE);

            console.log("ZENIX MEMORY SAVED!");
            return true;

        } catch (error) {
            console.error("MEMORY SAVE ERROR:", error.message);

            try {
                if (fs.existsSync(MEMORY_TEMP_FILE)) {
                    fs.unlinkSync(MEMORY_TEMP_FILE);
                }
            } catch (cleanupError) {
                console.error("MEMORY TEMP CLEANUP ERROR:", cleanupError.message);
            }

            return false;
        }
    }

    // ==========================================
    // SECURITY
    // ==========================================

   const SENSITIVE_PATTERN =
    /password|api[\s_-]*key|secret|token|գաղտնաբառ|пароль|գաղտնիք/i;
    // ==========================================
    // ADD MEMORY ITEM
    // ==========================================

        function addMemoryItem(memory, collection, value, oldValue = null) {
            if (!Array.isArray(memory[collection])) {
                memory[collection] = [];
            }

            const normalized = normalizeText(value);

            if (!normalized) return false;

            if (oldValue) {
                const oldNormalized = normalizeText(oldValue);

                memory[collection] = memory[collection].filter(
                    item => normalizeText(item) !== oldNormalized
                );
            }

            const exists = memory[collection].some(
                item => normalizeText(item) === normalized
            );

            if (!exists) {
                memory[collection].push(String(value).trim());
            }

            return true;
        }

    // ==========================================
    // MEMORY COMMANDS
    // ==========================================

   
function hasRememberCommand(message, clean = false) {
    let text = String(message || "").trim();

    const prefix =
        /^\s*(?:հիշիր|հիշի|պահիր հիշողության մեջ|remember(?:\s+that)?|запомни(?:\s+что)?)(?=\s|[,՝:]|$)/iu;

    const suffix =
        /(?:^|\s)(?:հիշիր սա|հիշիր|պահիր հիշողության մեջ|remember this|remember that|запомни это|запомни)\s*[.!?։]*$/iu;

    const hasPrefix = prefix.test(text);
    const hasSuffix = suffix.test(text);

    if (!hasPrefix && !hasSuffix) return false;

    if (!clean) return true;

    if (hasPrefix) {
        text = text.replace(prefix, "");
        text = text.replace(/^[\s,՝:]+/u, "");
    } else {
        text = text.replace(suffix, "");
    }

    text = text.replace(/^(?:որ|that|что)\s+/iu, "");

    return text.trim();
}


    // ==========================================
    // REMEMBER NAME
    // ==========================================

    function rememberName(cleaned, memory) {
        const value = String(cleaned || "")
            .trim()
            .replace(/[.!?։]+$/u, "");

        const patterns = [
            /^(?:իմ անունը|անունս)\s+(.+?)\s+է$/iu,
            /^my name is\s+(.+)$/i,
            /^меня зовут\s+(.+)$/i,
            /^im anuny\s+(.+?)\s+e$/i
        ];

        for (const pattern of patterns) {
            const match = value.match(pattern);
            if (!match) continue;

            const name = match[1].trim();

            if (
                !name ||
                name.length > 80 ||
                SENSITIVE_PATTERN.test(name)
            ) {
                return false;
            }

            memory.user_name = name;

            return saveMemory(memory) ? "name" : false;
        }

        return false;
    }

    // ==========================================
    // AUTOMATIC MEMORY DETECTION
    // ==========================================

   
function detectAutomaticMemory(message) {
    const text = String(message || "")
        .normalize("NFC")
        .trim();

    if (
        text.length < 4 ||
        text.length > 500 ||
        SENSITIVE_PATTERN.test(text)
    ) {
        return null;
    }

    // NAME
    const namePatterns = [
        /^(?:իմ անունը|անունս)\s+(.+?)\s+է[.!?։]*$/iu,
        /^my name is\s+(.+?)[.!?]*$/iu,
        /^меня зовут\s+(.+?)[.!?]*$/iu,
        /^im anuny\s+(.+?)\s+e[.!?]*$/iu
    ];

    for (const pattern of namePatterns) {
        const match = text.match(pattern);

        if (match) {
            const name = cleanPreferenceWord(match[1]);

            if (!name || name.length > 80) return null;

            return { type: "name", value: name };
        }
    }

    // ARMENIAN FAVORITE
    const armenianMatch = text.match(
        /^իմ սիրելի\s+(.+?)\s+(.+?)\s+է[.!?։]*$/iu
    );

    if (armenianMatch) {
        const category = normalizePreferenceCategory(armenianMatch[1]);
        const value = cleanPreferenceWord(armenianMatch[2]);

        if (!category || !value) return null;

        return {
            type: "preference",
            value: `Իմ սիրելի ${category} ${value} է`
        };
    }

    // ENGLISH FAVORITE
    const englishMatch = text.match(
        /^my favorite\s+(.+?)\s+is\s+(.+?)[.!?]*$/iu
    );

    if (englishMatch) {
        const category = normalizePreferenceCategory(englishMatch[1]);
        const value = cleanPreferenceWord(englishMatch[2]);

        if (!category || !value) return null;

        return {
            type: "preference",
            value: `Իմ սիրելի ${category} ${value} է`
        };
    }

    return null;
}

function updateMemoryFact(message) {
    const detected = detectAutomaticMemory(message);

    if (!detected) return false;

    const memory = loadMemory();

    if (detected.type === "preference") {
        return rememberPreference(detected.value, memory);
    }

    if (detected.type === "name") {
        return rememberName(detected.value, memory);
    }

    return false;
}

function rememberInterest(message) {
    const text = String(message || "").trim();

    if (
        text.length < 4 ||
        text.length > 500 ||
        SENSITIVE_PATTERN.test(text)
    ) {
        return false;
    }

    const patterns = [
        /^ես սիրում եմ\s+(.+?)$/iu,
        /^ինձ դուր է գալիս\s+(.+?)$/iu,
        /^i love\s+(.+)$/i,
        /^i like\s+(.+)$/i,
        /^мне нравится\s+(.+)$/iu
    ];

    let match = null;

    for (const pattern of patterns) {
        match = text.match(pattern);
        if (match) break;
    }

    if (!match) return false;

    const value = cleanPreferenceWord(match[1]);

    if (!value || value.length > 100) return false;

    const memory = loadMemory();

    const normalized = normalizeText(value);

    const exists = memory.interests.some(item =>
        normalizeText(item).includes(normalized)
    );

    if (!exists) {
        addMemoryItem(
            memory,
            "interests",
            `Ես սիրում եմ ${value}`
        );

        if (!saveMemory(memory)) return false;
    }

    return true;
}


    // ==========================================
    // SAVE AUTOMATIC MEMORY
    // ==========================================

  
function saveAutomaticMemory(message) {
    const detected = detectAutomaticMemory(message);

    if (!detected) return null;

    const value = String(detected.value || "").trim();

    if (
        !value ||
        value.length > 500 ||
        SENSITIVE_PATTERN.test(value)
    ) {
        return null;
    }

    // Չթողնել, որ փոփոխության նախադասությունը
    // սխալմամբ պահպանվի որպես նոր նախասիրություն։
    if (
        detected.type === "preference" &&
        /(այլևս|չեմ սիրում|չեմ հավանում|թողել եմ|այլևս չեմ)/iu.test(message)
    ) {
        return null;
    }

    const memory = loadMemory();

    if (detected.type === "name") {
        if (value.length > 80) return null;

        if (
            normalizeText(memory.user_name) === normalizeText(value)
        ) {
            return "exists";
        }

        memory.user_name = value;

    } else if (detected.type === "preference") {
        const match = value.match(
            /^իմ սիրելի\s+(.+?)\s+(.+?)\s+է$/iu
        );

        if (!match) return null;

        const category = normalizePreferenceCategory(match[1]);
        const newValue = cleanPreferenceWord(match[2]);

        const allowedCategories = [
            "գույն",
            "խաղ",
            "կենդանի",
            "միրգ",
            "մեքենա",
            "երաժշտություն",
            "սպորտ"
        ];

        if (
            !allowedCategories.includes(category) ||
            !newValue ||
            newValue.length > 100
        ) {
            return null;
        }

        const sameCategory = memory.preferences.filter(item => {
            const oldMatch = String(item)
                .replace(/[.!?։]+$/u, "")
                .match(/^իմ սիրելի\s+(.+?)\s+(.+?)\s+է$/iu);

            return oldMatch &&
                normalizePreferenceCategory(oldMatch[1]) === category;
        });

        const alreadyExists = sameCategory.some(item => {
            const oldMatch = String(item)
                .replace(/[.!?։]+$/u, "")
                .match(/^իմ սիրելի\s+(.+?)\s+(.+?)\s+է$/iu);

            return oldMatch &&
                normalizeText(oldMatch[2]) === normalizeText(newValue);
        });

        if (alreadyExists && sameCategory.length === 1) {
            return "exists";
        }

        // Հեռացնում ենք միայն նույն կատեգորիայի հին արժեքները
        memory.preferences = memory.preferences.filter(item => {
            const oldMatch = String(item)
                .replace(/[.!?։]+$/u, "")
                .match(/^իմ սիրելի\s+(.+?)\s+(.+?)\s+է$/iu);

            if (!oldMatch) return true;

            return normalizePreferenceCategory(oldMatch[1]) !== category;
        });

        addMemoryItem(
            memory,
            "preferences",
            `Իմ սիրելի ${category} ${newValue} է`
        );

    } else {
        return null;
    }

    if (!saveMemory(memory)) return null;

    console.log("ZENIX AUTO MEMORY SAVED:", detected);

    return "saved";
}


    // ==========================================
    // REMEMBER PREFERENCE
    // ==========================================

    function rememberPreference(cleaned, memory) {
        const value = String(cleaned || "")
            .trim()
            .replace(/[.!?։]+$/u, "");

        if (
            !value ||
            value.length > 500 ||
            SENSITIVE_PATTERN.test(value)
        ) {
            return false;
        }

        // Եթե նախասիրությունը ճանաչվում է ավտոմատ համակարգով,
        // պահում ենք նույն միասնական ձևաչափով։
        const detected = detectAutomaticMemory(value);

        if (detected && detected.type === "preference") {
            const match = detected.value.match(
                /^իմ սիրելի\s+(.+?)\s+(.+?)\s+է$/iu
            );

            if (!match) return false;

            const category = normalizePreferenceCategory(match[1]);
            const newValue = cleanPreferenceWord(match[2]);

            memory.preferences = memory.preferences.filter(item => {
                const oldMatch = String(item)
                    .replace(/[.!?։]+$/u, "")
                    .match(/^իմ սիրելի\s+(.+?)\s+(.+?)\s+է$/iu);

                if (!oldMatch) return true;

                return normalizePreferenceCategory(oldMatch[1]) !== category;
            });

            addMemoryItem(
                memory,
                "preferences",
                `Իմ սիրելի ${category} ${newValue} է`
            );

            return saveMemory(memory) ? "preference" : false;
        }

        const patterns = [
            /^(?:իմ սիրելի .+|ես սիրում եմ .+|ինձ դուր է գալիս .+|իմ նախասիրությունն է .+)$/iu,
            /^i (?:like|love) .+$/i,
            /^my favorite .+ is .+$/i,
            /^мне нравится .+$/i,
            /^мой любимый .+$/i,
            /^моя любимая .+$/i
        ];

        if (!patterns.some(pattern => pattern.test(value))) {
            return false;
        }

        const normalized = normalizeText(value);

        const exists = [
            ...memory.facts,
            ...memory.preferences
        ].some(item => normalizeText(item) === normalized);

        if (!exists) {
            memory.preferences.push(value);

            if (!saveMemory(memory)) return false;
        }

        return "preference";
    }

    // ==========================================
    // EXPLICIT MEMORY
    // ==========================================

    function rememberProfile(message) {
        if (!hasRememberCommand(message)) return false;

        const cleaned = hasRememberCommand(message, true);
        const memory = loadMemory();

        return (
            rememberName(cleaned, memory) ||
            rememberPreference(cleaned, memory)
        );
    }

    function rememberFact(message) {
        if (!hasRememberCommand(message)) return false;

        const fact = hasRememberCommand(message, true);

        if (
            !fact ||
            fact.length < 2 ||
            fact.length > 500 ||
            SENSITIVE_PATTERN.test(fact)
        ) {
            return false;
        }

        const memory = loadMemory();

        const exists = memory.facts.some(
            item => normalizeText(item) === normalizeText(fact)
        );

        if (!exists) {
            memory.facts.push(fact);

            if (!saveMemory(memory)) return false;
        }

        return true;
    }

    // ==========================================
    // MEMORY CONFIRMATION
    // ==========================================

    function askMemoryConfirmation(message) {
        const text = String(message || "").trim();

        if (
            text.length < 5 ||
            text.length > 500 ||
            /[?？՞]$/.test(text) ||
            SENSITIVE_PATTERN.test(text) ||
            hasRememberCommand(text) ||
            isForgetCommand(text)
        ) {
            return false;
        }

        const looksPersonal =
            /^(?:ես|իմ)\s+.+(?:եմ|է|ունեմ|ունի)$/iu.test(
                text.replace(/[.!։]+$/u, "").trim()
            );

        if (!looksPersonal) return false;

        const memory = loadMemory();

        memory.pending_memory = {
            type: "fact",
            value: text.replace(/[.!։]+$/u, "").trim()
        };

        return saveMemory(memory);
    }

  

function handleMemoryConfirmation(message) {
    const text = normalizeText(message);
    const memory = loadMemory();

    if (!memory.pending_memory) return null;

    const yesPatterns = [
        /^(?:այո|հա|իհարկե|լավ)(?:\s+(?:պահպանիր|պահիր|հիշիր|հիշիր սա))?$/u,
        /^(?:պահպանիր|պահիր|հիշիր|հիշիր սա)$/u,
        /^(?:yes|yeah|yes save it|save it|confirm)$/u,
        /^(?:да|да сохрани|сохрани|подтверждаю)$/u
    ];

    const noPatterns = [
        /^(?:ոչ|չէ)(?:\s+(?:մի պահպանիր|մի հիշիր))?$/u,
        /^(?:մի պահպանիր|մի հիշիր)$/u,
        /^(?:no|nope|no do not save|reject)$/u,
        /^(?:нет|нет не сохраняй|не сохраняй)$/u
    ];

    const isYes = yesPatterns.some(p => p.test(text));
    const isNo = noPatterns.some(p => p.test(text));

    if (!isYes && !isNo) return null;

    const pending = memory.pending_memory;

    // ՄԵՐԺՈՒՄ
    if (isNo) {
        memory.pending_memory = null;

        return saveMemory(memory)
            ? "cancelled"
            : "error";
    }

    // ՍՏՈՒԳՈՒՄ
    if (
        !pending ||
        typeof pending.value !== "string" ||
        !pending.value.trim() ||
        pending.value.length > 500 ||
        SENSITIVE_PATTERN.test(pending.value)
    ) {
        return "error";
    }

    let collection = null;

    // ԱՆՈՒՆ
    if (pending.type === "name") {
        if (pending.value.length > 80) return "error";

        memory.user_name = pending.value.trim();

    } else {
        const collections = {
            fact: "facts",
            interest: "interests",
            device: "devices",
            preference: "preferences"
        };

        collection = collections[pending.type];

        if (!collection) return "error";

        addMemoryItem(
            memory,
            collection,
            pending.value.trim()
        );
    }

    // ՄԱՔՐՈՒՄ ԵՆՔ PENDING-Ը
    memory.pending_memory = null;

    // ՊԱՀՊԱՆՈՒՄ ԵՆՔ ԱՄԲՈՂՋ ՓՈՓՈԽՈՒԹՅՈՒՆԸ
    const saved = saveMemory(memory);

    if (!saved) {
        console.error("ZENIX: MEMORY APPROVAL SAVE FAILED!");
        return "error";
    }

    console.log("ZENIX PENDING MEMORY APPROVED:", pending);

    return "saved";
}

function updateMemoryFact(message) {
    const detected = detectAutomaticMemory(message);

    const memory = loadMemory();

    let result = false;

    // FAVORITE PREFERENCES
    if (detected && detected.type === "preference") {
        result = rememberPreference(detected.value, memory);
    }

    // USER NAME
    else if (detected && detected.type === "name") {
        result = rememberName(detected.value, memory);
    }

    // INTERESTS
    else {
        result = rememberInterest(message);
    }

    if (result) {
        const updatedMemory = loadMemory();
        updatedMemory.pending_memory = null;

        if (!saveMemory(updatedMemory)) {
            return false;
        }
    }

    return result;
}

function updateMemoryFact(message) {
    const detected = detectAutomaticMemory(message);

    const memory = loadMemory();

    let result = false;

    // FAVORITE PREFERENCES
    if (detected && detected.type === "preference") {
        result = rememberPreference(detected.value, memory);
    }

    // USER NAME
    else if (detected && detected.type === "name") {
        result = rememberName(detected.value, memory);
    }

    // INTERESTS
    else {
        result = rememberInterest(message);
    }

    if (result) {
        const updatedMemory = loadMemory();
        updatedMemory.pending_memory = null;

        if (!saveMemory(updatedMemory)) {
            return false;
        }
    }

    return result;
}




    // ==========================================
    // UPDATE MEMORY FACT
    // ==========================================


function updateFuturePreference(message) {
    const futureMatch = String(message || "")
        .normalize("NFC")
        .trim()
        .replace(
            /\s*պահպանիր\s+այս\s+փոփոխությունը[.!?։]*$/iu,
            ""
        )
        .match(
            /^այսուհետ\s+իմ\s+սիրելի\s+(.+?)\s+(.+?)\s+է\s*,?\s*ոչ\s+թե\s+(.+?)[.!?։]*$/iu
        );

    if (!futureMatch) return false;

    const category = normalizePreferenceCategory(futureMatch[1]);
    const newValue = cleanPreferenceWord(futureMatch[2])
        .replace(/(?:ը|ն)$/u, "");
    const oldValue = normalizeText(futureMatch[3])
        .replace(/(?:ը|ն)$/u, "");

    if (
        !category ||
        !newValue ||
        !oldValue ||
        normalizeText(newValue) === oldValue ||
        newValue.length > 100 ||
        SENSITIVE_PATTERN.test(newValue)
    ) {
        return false;
    }

    const memory = loadMemory();

    const preferenceRegex =
        /^իմ սիրելի\s+(.+?)\s+(.+?)\s+է$/iu;

    const exists = memory.preferences.some(item => {
        const match = String(item)
            .replace(/[.!?։]+$/u, "")
            .match(preferenceRegex);

        return (
            match &&
            normalizePreferenceCategory(match[1]) === category &&
            normalizeText(match[2]) === oldValue
        );
    });

    if (!exists) return false;

    memory.preferences = memory.preferences.filter(item => {
        const match = String(item)
            .replace(/[.!?։]+$/u, "")
            .match(preferenceRegex);

        return !(
            match &&
            normalizePreferenceCategory(match[1]) === category
        );
    });

    addMemoryItem(
        memory,
        "preferences",
        `Իմ սիրելի ${category} ${newValue} է`
    );

    memory.pending_memory = null;

    if (!saveMemory(memory)) return false;

    console.log("ZENIX FUTURE PREFERENCE UPDATED:", {
        category,
        oldValue,
        newValue
    });

    return true;
}



    // ==========================================
    // FORGET MEMORY
    // ==========================================

  function isForgetCommand(message) {
    return /^\s*(?:մոռացիր|մոռացի|ջնջիր հիշողությունից|forget|забудь|удали из памяти)(?:\s|[,՝:]|$)/iu
        .test(String(message || ""));
}
   

function forgetFact(message) {
    if (!isForgetCommand(message)) return false;

    const text = String(message || "").trim();

    const forgetAll =
        /^(?:մոռացիր ամեն ինչ|մոռացիր բոլորը|ջնջիր ամբողջ հիշողությունը|forget everything|forget all|забудь всё|удали всю память)[.!?։]*$/iu;

    const memory = loadMemory();

    if (forgetAll.test(text)) {
        return saveMemory(emptyMemory()) ? "all" : "error";
    }

    const target = text
        .replace(
            /^\s*(?:մոռացիր|մոռացի|ջնջիր հիշողությունից|forget|забудь|удали из памяти)\s*[,՝:]?\s*/iu,
            ""
        )
        .replace(/^\s*(?:որ|that|что)\s+/iu, "")
        .replace(/[.!?։]+$/u, "")
        .trim();

    if (!target) return false;

    const normalizeWords = (value) =>
        normalizeText(value)
            .split(/\s+/u)
            .map(word => word.replace(/[ը ն]$/u, ""))
            .filter(Boolean);

    const ignoredWords = new Set([
        "իմ", "սիրելի", "մի", "է", "եմ", "ես",
        "the", "my", "favorite", "favourite"
    ]);

    const targetWords = normalizeWords(target)
        .filter(word => !ignoredWords.has(word));

    if (!targetWords.length) return "not_found";

    let found = false;

    if (
        normalizeWords(memory.user_name || "")
            .join(" ") === targetWords.join(" ")
    ) {
        memory.user_name = "";
        found = true;
    }

    for (const collection of [
        memory.facts,
        memory.preferences,
        memory.interests,
        memory.devices
    ]) {
        for (let i = collection.length - 1; i >= 0; i--) {
            const savedWords = normalizeWords(collection[i]);

            const matches = targetWords.every(word =>
                savedWords.includes(word)
            );

            if (matches) {
                collection.splice(i, 1);
                found = true;
            }
        }
    }

    if (!found) return "not_found";

    return saveMemory(memory) ? true : "error";
}

    // ==========================================
    // MEMORY QUESTIONS
    // ==========================================

    function isMemoryQuestion(message) {
        const text = normalizeText(message);

        const patterns = [
            /ինչ տեղեկություններ ես հիշում/,
            /ինչ ես հիշում իմ մասին/,
            /ինչ գիտես իմ մասին/,
            /թվարկիր.*հիշող/,
            /ինչ է պահպանված հիշողության/,
            /ինչ ես պահպանել իմ մասին/,
            /ինչ ես հիշում/,
            /ինչ տեղեկություններ գիտես իմ մասին/,
            /թվարկիր իմ մասին պահպանված տվյալները/,
            /ինչ ես պահպանել/,
            /ասա իմ մասին հիշածդ/,
            /հիշողությունդ ցույց տուր/,
            /what do you remember about me/,
            /what do you know about me/,
            /show my memories/,
            /list my memories/,
            /что ты помнишь обо мне/,
            /что ты знаешь обо мне/,
            /покажи мои воспоминания/
        ];

        return patterns.some(pattern => pattern.test(text));
    }

    // ==========================================
    // MEMORY SUMMARY
    // ==========================================

    
function getMemorySummary(memory) {
    const sections = [];

    if (memory.user_name) {
        sections.push(`Անուն՝ ${memory.user_name}`);
    }

    if (memory.youtube_channel) {
        sections.push(`YouTube ալիք՝ ${memory.youtube_channel}`);
    }

    const categories = [
        ["Փաստեր", memory.facts],
        ["Նախասիրություններ", memory.preferences],
        ["Հետաքրքրություններ", memory.interests],
        ["Սարքեր", memory.devices]
    ];

    for (const [title, items] of categories) {
        if (Array.isArray(items) && items.length > 0) {
            sections.push(
                `${title}՝\n${items.map(item => "- " + item).join("\n")}`
            );
        }
    }

    if (!sections.length) {
        return "Հիշողությանս մեջ դեռ տեղեկություններ չկան։";
    }

    return "Ահա իմ հիշողության մեջ պահպանված տեղեկությունները․\n\n" +
        sections.join("\n\n");
}

    // ==========================================
    // MEMORY ANSWERS
    // ==========================================

    function getMemoryAnswer(memory, language, question = "") {
        const text = normalizeText(question);

        const preferences = Array.isArray(memory.preferences)
            ? memory.preferences
            : [];

        function getLatestPreference(category) {
            for (let i = preferences.length - 1; i >= 0; i--) {
                const normalized = normalizeText(preferences[i]);

                const match = normalized.match(
                    /^իմ սիրելի\s+(.+?)\s+(.+?)\s+է$/u
                );

                if (!match) continue;

                if (
                    normalizePreferenceCategory(match[1]) ===
                    normalizePreferenceCategory(category)
                ) {
                    return match[2].trim();
                }
            }

            return null;
        }

        // FAVORITE GAME
        if (
            /սիրելի խաղ|ինչ խաղ եմ սիրում|favorite game|любимая игра/.test(text)
        ) {
            const game = getLatestPreference("խաղ");

            return game
                ? reply(
                    `Քո սիրելի խաղը ${game} է։ ❤️`,
                    `Твоя любимая игра — ${game}. ❤️`,
                    `Your favorite game is ${game}. ❤️`,
                    language
                )
                : null;
        }

        // FAVORITE COLOR
        if (
            /սիրելի գույն|ինչ գույն եմ սիրում|favorite color|любимый цвет/.test(text)
        ) {
            const color = getLatestPreference("գույն");

            return color
                ? reply(
                    `Քո սիրելի գույնը ${color} է։ 💚`,
                    `Твой любимый цвет — ${color}. 💚`,
                    `Your favorite color is ${color}. 💚`,
                    language
                )
                : null;
        }

        // FAVORITE ANIMAL
        if (
            /սիրելի կենդանի|ինչ կենդանի եմ սիրում|favorite animal|любимое животное/.test(text)
        ) {
            const animal = getLatestPreference("կենդանի");

            return animal
                ? reply(
                    `Քո սիրելի կենդանին ${animal} է։ 🐶`,
                    `Твоё любимое животное — ${animal}. 🐶`,
                    `Your favorite animal is ${animal}. 🐶`,
                    language
                )
                : null;
        }

        // FAVORITE FRUIT
        if (
            /սիրելի միրգ|ինչ միրգ եմ սիրում|favorite fruit|любимый фрукт|любимый плод/.test(text)
        ) {
            const fruit = getLatestPreference("միրգ");

            return fruit
                ? reply(
                    `Քո սիրելի միրգը ${fruit} է։ ❤️`,
                    `Твой любимый фрукт — ${fruit}. ❤️`,
                    `Your favorite fruit is ${fruit}. ❤️`,
                    language
                )
                : null;
        }

        // FAVORITE MUSIC
        if (
            /սիրելի երաժշտություն|favorite music|любимая музыка/.test(text)
        ) {
            const music = getLatestPreference("երաժշտություն");

            return music
                ? reply(
                    `Քո սիրելի երաժշտությունը ${music} է։ 🎵`,
                    `Твоя любимая музыка — ${music}. 🎵`,
                    `Your favorite music is ${music}. 🎵`,
                    language
                )
                : null;
        }

        // FAVORITE SPORT
        if (
            /սիրելի սպորտ|favorite sport|любимый спорт/.test(text)
        ) {
            const sport = getLatestPreference("սպորտ");

            return sport
                ? reply(
                    `Քո սիրելի սպորտը ${sport} է։ ⚽`,
                    `Твой любимый спорт — ${sport}. ⚽`,
                    `Your favorite sport is ${sport}. ⚽`,
                    language
                )
                : null;
        }

        return null;
    }

    // ==========================================
    // MEMORY STATUS API
    // ==========================================

    



app.post("/api/chat", async (req, res) => {
    try {
        const { history } = req.body;

        if (!Array.isArray(history)) {
            return res.status(400).json({
                error: "History must be an array."
            });
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                error: "GEMINI_API_KEY is missing in .env"
            });
        }

        const lastMessage = [...history]
            .reverse()
            .find(item => item.role === "user");

        const userMessage = String(lastMessage?.text || "").trim();

        if (!userMessage) {
            return res.status(400).json({
                error: "Message is empty."
            });
        }

        let memory = loadMemory();

        // ======================================
        // FORGET COMMANDS
        // ======================================

        if (isForgetCommand(userMessage)) {
            const result = forgetFact(userMessage);

            const replies = {
                all: "Քո ամբողջ հիշողությունը մաքրվել է։ ❤️",
                not_found: "Այդ տեղեկությունը հիշողությանս մեջ չգտա։",
                error: "Չհաջողվեց թարմացնել հիշողությունը։"
            };

            return res.json({
                reply: typeof result === "string"
                    ? replies[result]
                    : result
                        ? "Տեղեկությունը մոռացվեց։ ❤️"
                        : "Չհաջողվեց կատարել հրամանը։"
            });
        }

        // ======================================
        // UPDATE MEMORY
        // ======================================

       if (updateFuturePreference(userMessage)) {
    return res.json({
        reply: "Հիշողությունս հաջողությամբ թարմացրի։ ❤️"
    });
}

        if (updateMemoryFact(userMessage)) {
            return res.json({
                reply: "Հիշողությունս թարմացրի։ ❤️"
            });
        }

        // ======================================
        // EXPLICIT MEMORY COMMANDS
        // ======================================

        if (rememberProfile(userMessage) || rememberFact(userMessage)) {
            return res.json({
                reply: "Հիշեցի և պահպանեցի հիշողությանս մեջ։ ❤️"
            });
        }

        // ======================================
        // CONFIRM PENDING MEMORY
        // ======================================

        const confirmation = handleMemoryConfirmation(userMessage);

        if (confirmation === "saved") {
            return res.json({
                reply: "Լավ, պահպանեցի այս տեղեկությունը հիշողությանս մեջ։ ❤️"
            });
        }

        if (confirmation === "cancelled") {
            return res.json({
                reply: "Լավ, այս տեղեկությունը չեմ պահպանի։ ❤️"
            });
        }

        if (confirmation === "error") {
            return res.json({
                reply: "Չհաջողվեց պահպանել տեղեկությունը։"
            });
        }

        // ======================================
        // AUTOMATIC MEMORY
        // ======================================

        const automaticMemory = saveAutomaticMemory(userMessage);

        if (automaticMemory === "saved") {
            return res.json({
                reply: "Հասկացա և ավտոմատ պահպանեցի այս տեղեկությունը հիշողությանս մեջ։ ❤️"
            });
        }

        if (automaticMemory === "exists") {
            return res.json({
                reply: "Այս տեղեկությունն արդեն հիշում եմ։ ❤️"
            });
        }

        // ======================================
        // ASK FOR MEMORY CONFIRMATION
        // ======================================

        if (askMemoryConfirmation(userMessage)) {
            return res.json({
                reply: "Սա քո մասին նոր տեղեկությո՞ւն է։ Պահպանե՞մ հիշողությանս մեջ։ ❤️"
            });
        }

        // ======================================
        // MEMORY QUESTIONS
        // ======================================

        memory = loadMemory();

        if (isMemoryQuestion(userMessage)) {
            return res.json({
                reply: getMemorySummary(memory)
            });
        }

        const memoryAnswer = getMemoryAnswer(
            memory,
            "Armenian",
            userMessage
        );

        if (memoryAnswer) {
            return res.json({
                reply: memoryAnswer
            });
        }

        // ======================================
        // GEMINI CHAT
        // ======================================

        const contents = history
            .filter(item =>
                item &&
                ["user", "model"].includes(item.role) &&
                typeof item.text === "string"
            )
            .slice(-20)
            .map(item => ({
                role: item.role,
                parts: [{ text: item.text }]
            }));

        const systemPrompt = `
Դու ZENIX-ն ես՝ հայկական AI օգնական։

Պատասխանիր բնական, բարեկամական հայերենով։
Հիշիր խոսակցության համատեքստը։
Մի հորինիր օգտատիրոջ մասին տեղեկություններ։

Օգտատիրոջ անունը՝ ${memory.user_name || "անհայտ"}։

Պահպանված փաստեր՝
${memory.facts.join("\n")}

Նախասիրություններ՝
${memory.preferences.join("\n")}

Հետաքրքրություններ՝
${(memory.interests || []).join("\n")}

Սարքեր՝
${(memory.devices || []).join("\n")}

Հիշողության մեջ եղած տեղեկությունները օգտագործիր պատասխանելիս։
Մի հորինիր բացակայող տեղեկություններ։
Մի ասա, որ տեղեկություն ես պահպանել, եթե այն իրականում չի պահպանվել։
`;

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" +
            encodeURIComponent(apiKey),
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    contents,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048
                    }
                })
            }
        );

       const responseText = await response.text();

let data;

try {
    data = JSON.parse(responseText);
} catch (error) {
    console.error("GEMINI NON-JSON RESPONSE:", responseText);

    return res.status(502).json({
        error: "Gemini returned HTML or invalid JSON."
    });
}

       if (!response.ok) {
    console.error("GEMINI ERROR:", data);

    return res.status(502).json({
        error: data.error?.message || "Gemini API error",
        status: response.status
    });
}

        const reply = data.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim();

        if (!reply) {
            return res.status(500).json({
                error: "Gemini returned an empty response."
            });
        }

        res.json({ reply });

    } catch (error) {
        console.error("ZENIX CHAT ERROR:", error);

        res.status(500).json({
            error: error.message || "Internal server error"
        });
    }
});



    // ==========================================
    // GOOGLE NEWS SEARCH
    // ==========================================

    async function searchGoogleNews(query) {
        try {
            const originalQuery = String(query || "")
                .normalize("NFC")
                .trim();

            const isGTA6Query =
                /\bGTA\s*[- ]?\s*6\b|Grand Theft Auto\s*(?:VI|6)\b/i
                    .test(originalQuery);

            let searchQuery = originalQuery;

            if (isGTA6Query) {
                searchQuery = "GTA 6";
            }

            if (!searchQuery) return [];

            const params = new URLSearchParams({
                q: isGTA6Query ? '"GTA 6"' : searchQuery,
                hl: "en-US",
                gl: "US",
                ceid: "US:en"
            });

            const url =
                "https://news.google.com/rss/search?" +
                params.toString();

            console.log("ZENIX RSS SEARCH QUERY:", searchQuery);

            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 ZENIX/1.0",
                    "Accept": "application/rss+xml, application/xml, text/xml"
                },
                signal: AbortSignal.timeout(15000)
            });

            console.log("ZENIX RSS STATUS:", response.status);

            if (!response.ok) {
                throw new Error("News search failed: " + response.status);
            }

            const xml = await response.text();

            function decodeXML(value) {
                return String(value || "")
                    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
                    .replace(/&amp;/g, "&")
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;|&apos;/g, "'")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .replace(/&#(\d+);/g, (_, code) =>
                        String.fromCodePoint(Number(code))
                    )
                    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
                        String.fromCodePoint(parseInt(code, 16))
                    )
                    .trim();
            }

            function getValue(item, tag) {
                const regex = new RegExp(
                    `<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,
                    "i"
                );

                const match = item.match(regex);

                return match ? decodeXML(match[1]) : "";
            }

            function getSourceUrl(item) {
                const match = item.match(
                    /<source\b[^>]*\burl=["']([^"']+)["']/i
                );

                return match ? decodeXML(match[1]) : "";
            }

            const items = xml.match(
                /<item\b[^>]*>[\s\S]*?<\/item>/gi
            ) || [];

            const gta6Pattern =
                /\bGTA\s*[- ]?\s*6\b|\bGrand Theft Auto\s*(?:VI|6)\b/i;

            let results = items.map(item => ({
                title: getValue(item, "title"),
                link: getValue(item, "link"),
                date: getValue(item, "pubDate"),
                source: getValue(item, "source"),
                sourceUrl: getSourceUrl(item)
            }));

            results = results.filter(item => {
                if (!item.title || !item.link) return false;

                if (isGTA6Query) {
                    const match = item.title.match(gta6Pattern);

                    if (!match || match.index > 35) return false;

                    const excludedTopics = [
                        /air force 1/i,
                        /10 things that have happened in f1/i,
                        /before we got gta 6/i
                    ];

                    if (
                        excludedTopics.some(pattern =>
                            pattern.test(item.title)
                        )
                    ) {
                        return false;
                    }
                }

                return true;
            });

            const uniqueResults = [
                ...new Map(
                    results.map(item => [item.link, item])
                ).values()
            ];

            uniqueResults.sort((a, b) => {
                const dateA = Date.parse(a.date) || 0;
                const dateB = Date.parse(b.date) || 0;

                return dateB - dateA;
            });

            const finalResults = uniqueResults.slice(0, 10);

            console.log("ZENIX RSS RAW RESULTS:", items.length);
            console.log("ZENIX RSS FILTERED RESULTS:", finalResults.length);

            return finalResults;

        } catch (error) {
            console.error("ZENIX NEWS SEARCH ERROR:", error.message);
            return [];
        }
    }

    // ==========================================
    // NEWS VERIFICATION HELPERS
    // ==========================================

    function getNewsPublicationDate(date) {
        if (!date) return "Ամսաթիվը նշված չէ";

        const parsedDate = new Date(date);

        if (isNaN(parsedDate.getTime())) {
            return "Ամսաթիվը հնարավոր չէ ստուգել";
        }

        return parsedDate.toISOString();
    }

    function getNewsSourceStatus(item) {
        const officialDomains = [
            "rockstargames.com",
            "take2games.com"
        ];

        try {
            const hostname = new URL(item.sourceUrl).hostname
                .toLowerCase()
                .replace(/^www\./, "");

            if (officialDomains.some(domain =>
                hostname === domain ||
                hostname.endsWith("." + domain)
            )) {
                return "OFFICIAL SOURCE DOMAIN - ARTICLE CONTENT NOT VERIFIED";
            }

        } catch {}

        return "MEDIA REPORT - NOT OFFICIALLY VERIFIED";
    }

    // ==========================================
    // BUILD NEWS CONTEXT
    // ==========================================

    function buildNewsContext(newsResults) {
        if (!newsResults.length) {
            return `
    GOOGLE NEWS SEARCH:

    Google News-ը արդյունքներ չի վերադարձրել։

    Մի հորինիր նորություններ։
    Մի պնդիր, որ որևէ տեղեկություն ստուգվել է։
    Հստակ ասա օգտատիրոջը, որ որոնումը արդյունք չի տվել։
    `;
        }

        const articles = newsResults.map((item, index) => {
            return [
                `${index + 1}. TITLE: ${item.title}`,
                `LINK: ${item.link}`,
                `PUBLICATION DATE: ${getNewsPublicationDate(item.date)}`,
                `SOURCE: ${item.source || "Unknown"}`,
                `SOURCE URL: ${item.sourceUrl || "Unknown"}`,
                `SOURCE STATUS: ${getNewsSourceStatus(item)}`,
                "ARTICLE CONTENT: NOT PROVIDED - DO NOT ASSUME ITS CONTENT"
            ].join("\n");
        }).join("\n\n");

        return `
    GOOGLE NEWS SEARCH RESULTS:

    ${articles}

    STRICT NEWS VERIFICATION RULES:

    1. A headline is not proof of the claim it makes.

    2. Do not invent article content, quotes, announcements,
    dates, statements or additional details.

    3. An official source domain is not enough to prove
    that the headline's claim is true.
    The article's actual content must support the claim.

    4. Distinguish these categories:

    OFFICIAL:
    The relevant claim is explicitly supported by
    an official company or organization source.

    REPORTED:
    A news outlet has reported the claim,
    but official confirmation has not been established.

    UNCONFIRMED:
    The claim is based on rumors, speculation
    or insufficient evidence.

    5. If only the headline and link are available,
    say that the article content has not been checked.

    6. Never say Rockstar officially confirmed something
    unless an actual official source supports that claim.

    7. Never treat Google News search results
    as automatic proof of a claim.

    8. Always show the publication date.
    If the date is missing, say so.

    9. Never present an old article as today's news.

    10. If publication dates are old,
    clearly identify them as older reports.

    11. If different sources disagree,
    explain the disagreement.

    12. Include the article link when discussing it.

    13. Never create fake links or fake sources.

    14. If there is insufficient evidence,
    say clearly that the information cannot be verified.

    15. Accuracy is more important than giving
    a confident or complete-sounding answer.
    `;
    }

    // ==========================================
    // ZENIX AI CHAT API
    // ==========================================

    // ZENIX NAME USAGE CONTROL
    const nameUsage = new Map();

    function canUseUserName(sessionId) {
        const now = Date.now();
        const lastUsed = nameUsage.get(sessionId);

        // Առնվազն 3 պատասխան պետք է անցնի
        if (lastUsed && now - lastUsed < 60000) {
            return false;
        }

        nameUsage.set(sessionId, now);
        return true;
    }

    // ==========================================
    // START SERVER
    // ==========================================

    app.listen(PORT, () => {
        console.log(`ZENIX server running at http://localhost:${PORT}`);
    });
