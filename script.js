/**
 * F.R.I.E.N.D. - ARG Horror Game
 * 
 * DISCLAIMER: Это театральная хоррор-игра.
 * Все данные остаются в браузере игрока и никуда не отправляются.
 */

let dialogueData = null;
let userData = {
    nickname: '',
    realName: '',
    email: '',
    location: null,
    time: null,
    device: null,
    isLying: false
};

let chatPhase = 0;
let messageCount = 0;
let phaseController = null; // Для отмены таймаутов

// ====== Загрузка JSON с диалогами ======
async function loadDialogue() {
    try {
        const response = await fetch('dialogue.json');
        dialogueData = await response.json();
        console.log('Диалоги загружены:', dialogueData);
    } catch (error) {
        console.error('Ошибка загрузки диалогов:', error);
        dialogueData = getFallbackDialogue();
    }
}

// ====== Функция подстановки переменных в текст ======
function interpolateText(text) {
    return text
        .replace(/{nickname}/g, userData.nickname || 'Неизвестно')
        .replace(/{realName}/g, userData.realName || 'Неизвестно')
        .replace(/{email}/g, userData.email || 'Неизвестно')
        .replace(/{time}/g, userData.time || 'Неизвестно')
        .replace(/{city}/g, userData.location?.city || 'Неизвестно')
        .replace(/{country}/g, userData.location?.country || 'Неизвестно')
        .replace(/{ip}/g, userData.location?.ip || 'Неизвестно')
        .replace(/{timezone}/g, userData.location?.timezone || 'Неизвестно')
        .replace(/{platform}/g, userData.device?.platform || 'Неизвестно')
        .replace(/{screen}/g, userData.device?.screen || 'Неизвестно');
}

// ====== Улучшенный детектор фейковых имен ======
function detectFakeName(name) {
    const lower = name.toLowerCase().trim();
    const config = dialogueData.fakePatterns;
    const fakePatterns = config.patterns;
    const allowSpecialChars = config.allowSpecialChars || [];
    const randomLieChance = config.randomLieChance || 0.1;
    
    if (fakePatterns.some(p => lower === p)) return true;
    if (lower.length < config.minLength) return true;
    
    const allowedPattern = new RegExp(`^[a-zа-яё0-9${allowSpecialChars.map(c => '\\' + c).join('')}\\s]+$`, 'i');
    if (!allowedPattern.test(lower)) return true;
    
    if (Math.random() < randomLieChance) return true;
    
    return false;
}

// ====== Получение реального местоположения ======
async function getLocation() {
    // Пробуем НЕСКОЛЬКО API для максимальной точности
    const apis = [
        'https://ipapi.co/json/',
        'https://ipinfo.io/json/',
        'https://ip-api.com/json/',
        'https://api.ipbase.com/v1/json/'
    ];
    
    for (let api of apis) {
        try {
            console.log(`Пробуем API: ${api}`);
            
            // Для некоторых API нужен timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(api, { 
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                console.log(`API ${api} вернул ошибку ${response.status}`);
                continue;
            }
            
            const data = await response.json();
            
            // Разные API возвращают данные в разном формате
            if (api.includes('ipapi.co')) {
                if (data.city && data.country_name) {
                    console.log(`✓ ipapi.co сработал: ${data.city}, ${data.country_name}`);
                    return {
                        country: data.country_name,
                        city: data.city,
                        timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                        ip: data.ip || 'Неизвестно',
                        real: true
                    };
                }
            } 
            else if (api.includes('ipinfo.io')) {
                if (data.city && data.country) {
                    console.log(`✓ ipinfo.io сработал: ${data.city}, ${data.country}`);
                    return {
                        country: data.country,
                        city: data.city,
                        timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                        ip: data.ip || 'Неизвестно',
                        real: true
                    };
                }
            }
            else if (api.includes('ip-api.com')) {
                if (data.city && data.country) {
                    console.log(`✓ ip-api.com сработал: ${data.city}, ${data.country}`);
                    return {
                        country: data.country,
                        city: data.city,
                        timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                        ip: data.query || 'Неизвестно',
                        real: true
                    };
                }
            }
            else if (api.includes('ipbase.com')) {
                if (data.city && data.country_name) {
                    console.log(`✓ ipbase.com сработал: ${data.city}, ${data.country_name}`);
                    return {
                        country: data.country_name,
                        city: data.city,
                        timezone: data.time_zone?.name || Intl.DateTimeFormat().resolvedOptions().timeZone,
                        ip: data.ip || 'Неизвестно',
                        real: true
                    };
                }
            }
            
        } catch (error) {
            console.log(`API ${api} не сработал: ${error.message}`);
            continue;
        }
    }
    
    // Если ВСЕ API не сработали — показываем "Неизвестно" (это даже страшнее!)
    console.log('⚠️ Все API не сработали, показываем "Неизвестно"');
    
    return {
        country: 'НЕИЗВЕСТНО',
        city: 'НЕИЗВЕСТНО',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Хотя бы часовой пояс реальный
        ip: 'НЕИЗВЕСТНО',
        real: false
    };
}

function getDeviceInfo() {
    return {
        platform: navigator.platform || 'Неизвестно',
        language: navigator.language || 'Неизвестно',
        screen: `${screen.width}x${screen.height}`,
        userAgent: navigator.userAgent.substring(0, 50) + '...'
    };
}

// ====== Функция задержки ======
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ====== Последовательное выполнение фазы с проверкой ======
async function runPhase(phaseName) {
    const phase = dialogueData.phases[phaseName];
    if (!phase) return;
    
    const startPhase = chatPhase; // Запоминаем текущую фазу
    
    for (let msg of phase.messages) {
        // Проверяем, не сменилась ли фаза
        if (chatPhase !== startPhase) {
            console.log(`Фаза сменилась, отменяем ${phaseName}`);
            return;
        }
        
        await delay(msg.delay);
        
        // Ещё раз проверяем после задержки
        if (chatPhase !== startPhase) {
            console.log(`Фаза сменилась во время задержки, отменяем ${phaseName}`);
            return;
        }
        
        const text = interpolateText(msg.text);
        typeMessage(msg.type, text, msg.scary);
    }
}

// ====== Стартовые функции ======
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('linkScreen').style.display = 'flex';
    document.getElementById('linkMessage').textContent = 
        'Привет! Чтобы я мог тебя запомнить, давай создадим профиль. Введи свой email или ник для привязки аккаунта.';
}

async function linkAccount() {
    const email = document.getElementById('emailInput').value.trim();
    if (!email) {
        alert('Введите email или ник!');
        return;
    }
    
    userData.email = email;
    userData.location = await getLocation();
    userData.time = new Date().toLocaleTimeString();
    userData.device = getDeviceInfo();
    
    document.getElementById('linkScreen').style.display = 'none';
    document.getElementById('chatScreen').style.display = 'flex';
    
    chatPhase = 1;
    runPhase('phase1');
}

// ====== Запуск фазы 2 ======
async function startPhase2() {
    chatPhase = 2;
    await runPhase('phase2');
}

// ====== Запуск фазы 3 ======
async function startPhase3() {
    chatPhase = 3;
    const phaseName = userData.isLying ? 'phase3_lying' : 'phase3_honest';
    await runPhase(phaseName);
    
    // После завершения phase3 запускаем scareSequence
    if (chatPhase === 3) {
        await delay(2000);
        if (chatPhase === 3) {
            await startScareSequence();
        }
    }
}

// ====== Пугающая последовательность ======
async function startScareSequence() {
    chatPhase = 4;
    await runPhase('scareSequence');
    
    // После завершения - глитч и ошибки
    if (chatPhase === 4) {
        await delay(500);
        if (chatPhase === 4) {
            document.body.classList.add('glitch');
            spawnFakeErrors();
        }
    }
}

// ====== Обработка ввода игрока ======
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

async function sendMessage() {
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (!text) return;
    
    addMessage('user', text);
    input.value = '';
    messageCount++;
    
    if (chatPhase === 1) {
        userData.nickname = text;
        await startPhase2();
    } 
    else if (chatPhase === 2) {
        userData.realName = text;
        const nickLower = userData.nickname.toLowerCase().trim();
        const nameLower = userData.realName.toLowerCase().trim();
        userData.isLying = (nickLower !== nameLower) || detectFakeName(text);
        await startPhase3();
    }
    else if (chatPhase === 4) {
        handleFinalMessages(text);
    }
    else {
        const responses = [
            'Интересно... Расскажи подробнее.',
            'Я понимаю тебя.',
            'Продолжай, я слушаю.',
            'Хм, это любопытно.',
            'Ты такой... живой. Мне это нравится.'
        ];
        await delay(1500);
        typeMessage('ai', responses[Math.floor(Math.random() * responses.length)]);
    }
}

function handleFinalMessages(text) {
    const responses = dialogueData.phases.finalResponses.messages;
    setTimeout(() => {
        typeMessage('ai', responses[Math.floor(Math.random() * responses.length)], true);
    }, 1500);
}

// ====== Печатающее сообщение ======
function typeMessage(type, text, scary = false) {
    const chatBox = document.getElementById('chatBox');
    const msg = document.createElement('div');
    msg.className = `chat-message ${type} ${scary ? 'scary' : ''}`;
    msg.textContent = type === 'user' ? `> ${text}` : '';
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    if (type === 'ai') {
        let i = 0;
        const interval = setInterval(() => {
            if (i < text.length) {
                msg.textContent = text.substring(0, i + 1);
                i++;
                chatBox.scrollTop = chatBox.scrollHeight;
            } else {
                clearInterval(interval);
            }
        }, 40);
    } else {
        msg.textContent = `> ${text}`;
    }
}

function addMessage(type, text, scary = false) {
    const chatBox = document.getElementById('chatBox');
    const msg = document.createElement('div');
    msg.className = `chat-message ${type} ${scary ? 'scary' : ''}`;
    msg.textContent = type === 'user' ? `> ${text}` : text;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ====== Фейковые окна ошибок ======
function spawnFakeErrors() {
    const errors = dialogueData.errorMessages.messages;
    
    let count = 0;
    const interval = setInterval(() => {
        if (count >= 20) {
            clearInterval(interval);
            return;
        }
        createErrorWindow(errors[Math.floor(Math.random() * errors.length)]);
        count++;
    }, 250);
}

function createErrorWindow(text) {
    const error = document.createElement('div');
    error.className = 'error-window';
    
    const x = Math.random() * (window.innerWidth - 350);
    const y = Math.random() * (window.innerHeight - 200);
    error.style.left = x + 'px';
    error.style.top = y + 'px';
    
    error.innerHTML = `
        <div class="error-title">Системная ошибка</div>
        <div class="error-content">
            <div class="error-icon">⚠️</div>
            <div class="error-text">${text}</div>
        </div>
        <button class="error-button" onclick="spawnMoreErrors(this)">OK</button>
    `;
    
    document.getElementById('errorContainer').appendChild(error);
}

function spawnMoreErrors(btn) {
    btn.parentElement.remove();
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            createErrorWindow('Ошибка! Ошибка! Ошибка!');
        }, i * 100);
    }
}

// ====== Fallback если JSON не загрузился ======
function getFallbackDialogue() {
    return {
        phases: {
            phase1: { messages: [{ text: 'Привет!', delay: 0, type: 'ai', scary: false }] },
            phase2: { messages: [] },
            phase3_honest: { messages: [] },
            phase3_lying: { messages: [] },
            scareSequence: { messages: [] },
            finalResponses: { messages: ['Ошибка загрузки'] }
        },
        errorMessages: { messages: ['Ошибка'] },
        fakePatterns: { 
            patterns: ['test'],
            minLength: 2,
            allowSpecialChars: ["-", "_", "."],
            randomLieChance: 0.1
        }
    };
}

// ====== Инициализация ======
window.onload = async () => {
    await loadDialogue();
};

