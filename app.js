// GOLF BET - Logic Prototype & Supabase Connection

// CREDENCIALES CONFIGURADAS
const SUPABASE_URL = 'https://ehsylbytyanztsnwztel.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoc3lsYnl0eWFuenRzbnd6dGVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTExNDMsImV4cCI6MjA4ODIyNzE0M30.HEbAIOZ9vk2Fq4T-0fglvRpsCfG7ynJtg9MuWMIIbpA';

let supabaseClient = null;

// Inicializar Supabase
try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Conectado a la base de datos de Golf Bet en Supabase.");
} catch (error) {
    console.error("Error al conectar con Supabase:", error);
}

const courses = {
    llanogrande: {
        name: "Club Campestre Llanogrande",
        location: "Medellín, COL",
        pars: [4, 5, 4, 3, 5, 4, 4, 3, 4, 4, 5, 3, 4, 5, 4, 4, 3, 4], // Real
        indices: [1, 11, 15, 7, 3, 13, 17, 9, 5, 2, 12, 16, 8, 4, 14, 18, 10, 6]
    },
    el_rodeo: {
        name: "Club El Rodeo",
        location: "Medellín, COL",
        pars: [4, 3, 4, 5, 4, 4, 5, 3, 4, 4, 5, 4, 4, 5, 3, 3, 4, 4], // Real
        indices: [5, 15, 11, 3, 9, 13, 1, 17, 7, 6, 10, 8, 2, 4, 18, 16, 12, 14] // Approx standard distribution
    },
    la_macarena: {
        name: "Club La Macarena",
        location: "Rionegro, COL",
        pars: [4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 5, 5, 3, 4], // Real (Par 73 based on scorecard data)
        indices: [17, 9, 13, 1, 5, 11, 7, 15, 3, 14, 8, 6, 12, 4, 10, 2, 18, 16] // Real indices
    }
};

const state = {
    players: [],
    bets: [],
    comments: "",
    currentUser: null, // Guardamos el usuario logueado aquí
    activeRound: {
        id: null,
        courseName: "No seleccionado",
        pars: Array(18).fill(null),
        indices: Array(18).fill(null),
        startHole: 1
    },
    exchangeRate: 4000
};

// Utilidad Global: Formato de Moneda COP
function formatMoneyCOP(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return "$0";
    return "$" + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// ... (funciones anteriores iguales)

function isGameStarted() {
    return state.players.some(p => p.scores && p.scores.some(s => s !== null));
}

function renderCourseList(filter = '') {
    const listContainer = document.getElementById('course-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const searchTerm = filter.toLowerCase();

    listContainer.innerHTML += `
        <div class="course-option card" onclick="selectCourse('personalizado')">
            <p style="font-weight:600; margin:0; color: var(--accent-color);">+ Campo Personalizado</p>
            <p style="font-size:0.7rem; color:var(--text-secondary);">Configura los datos manualmente si no está en la lista</p>
        </div>
    `;

    Object.keys(courses).forEach(key => {
        const course = courses[key];
        if (course.name.toLowerCase().includes(searchTerm) || course.location.toLowerCase().includes(searchTerm)) {
            const totalPar = course.pars.reduce((a, b) => a + b, 0);
            listContainer.innerHTML += `
                <div class="course-option card" onclick="selectCourse('${key}')">
                    <p style="font-weight:600; margin:0;">${course.name}</p>
                    <p style="font-size:0.7rem; color:var(--text-secondary);">Par ${totalPar} • ${course.location}</p>
                </div>
            `;
        }
    });
}

function openCourseModal() {
    document.getElementById('modal-course').classList.remove('hidden');
    renderCourseList();
}

function closeCourseModal() {
    document.getElementById('modal-course').classList.add('hidden');
}

function openCustomCourseModal() {
    closeCourseModal();
    document.getElementById('modal-custom-course').classList.remove('hidden');
    document.getElementById('ai-course-search').value = '';
    document.getElementById('ai-search-status').style.display = 'none';
}

function closeCustomCourseModal() {
    document.getElementById('modal-custom-course').classList.add('hidden');
}

function showCustomAlert(title, message) {
    const alertModal = document.getElementById('modal-custom-alert');
    const titleEl = document.getElementById('custom-alert-title');
    const messageEl = document.getElementById('custom-alert-message');

    if (alertModal && titleEl && messageEl) {
        titleEl.innerText = title;
        // Permite saltos de línea con innerHTML
        messageEl.innerHTML = message.replace(/\n/g, '<br>');
        alertModal.classList.remove('hidden');
    } else {
        // Fallback en caso de que HTML no tenga el modal
        alert(`${title}\n\n${message}`);
    }
}

function closeCustomAlert() {
    const alertModal = document.getElementById('modal-custom-alert');
    if (alertModal) alertModal.classList.add('hidden');
}

async function submitCustomCourse() {
    const inputEl = document.getElementById('ai-course-search');
    const statusEl = document.getElementById('ai-search-status');
    const name = inputEl.value.trim();
    if (!name) return;

    statusEl.style.display = 'block';
    statusEl.innerText = `Buscando ${name} en nuestra base de datos...`;

    try {
        // 1. Intentar buscar en la base de datos Supabase primero
        let courseData = null;
        if (supabaseClient) {
            const { data: cachedCourse, error } = await supabaseClient
                .from('ai_courses_cache')
                .select('*')
                .ilike('name_query', name)
                .limit(1)
                .single();

            if (cachedCourse && cachedCourse.parsed_data) {
                console.log("Campo encontrado en la base de datos Supabase.");
                courseData = cachedCourse.parsed_data;
            }
        }

        // 2. Si no está en Supabase, preguntarle a DeepSeek via Vercel Function
        if (!courseData) {
            statusEl.innerText = `Consultando a IA por un campo nuevo...`;

            const apiUrl = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'https://golfbetapp.com/api/course'
                : '/api/course';

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseName: name })
            });

            if (!response.ok) throw new Error("API Falló");

            courseData = await response.json();

            // 3. Guardar el resultado en Supabase para el futuro
            if (supabaseClient) {
                try {
                    await supabaseClient.from('ai_courses_cache').insert([
                        { name_query: name.toLowerCase(), parsed_data: courseData }
                    ]);
                } catch (e) { console.error("Error guardando en caché:", e) }
            }
        }

        // Finalizar selección
        state.activeRound.courseName = courseData.name || name;
        state.activeRound.pars = courseData.pars || Array(18).fill(4);
        state.activeRound.indices = courseData.indices || Array(18).fill(null);

        closeCustomCourseModal();
        let successMsg = `Campo: ${courseData.name}\nUbicación: ${courseData.location}\nPar Total: ${courseData.totalPar || state.activeRound.pars.reduce((a, b) => a + b, 0)}`;
        showCustomAlert("¡Campo listo!", successMsg);

    } catch (error) {
        console.error(error);
        showCustomAlert("Error", "Hubo un error contactando a la IA o no se pudo encontrar. Usaremos una configuración de Par 72 estándar.");

        state.activeRound.courseName = name;
        state.activeRound.pars = [4, 5, 4, 3, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4];
        state.activeRound.indices = [1, 11, 15, 7, 3, 13, 17, 9, 5, 2, 12, 16, 8, 4, 14, 18, 10, 6];
        closeCustomCourseModal();
    }

    // Continuar con el setup
    const courseNameEl = document.getElementById('current-course-name');
    if (courseNameEl) courseNameEl.innerText = state.activeRound.courseName;

    const courseParEl = document.getElementById('current-course-par');
    if (courseParEl) {
        const tPar = state.activeRound.pars.reduce((a, b) => a + (b || 0), 0);
        courseParEl.innerText = `Par Total: ${tPar}`;
    }

    window.tempStartHole = 1;
    setStartHole(1);
    document.getElementById('modal-round-setup').classList.remove('hidden');
}

async function selectCourse(courseKey) {
    if (courseKey === 'personalizado') {
        openCustomCourseModal();
    } else {
        const course = courses[courseKey];
        state.activeRound.courseName = course.name;
        state.activeRound.pars = course.pars;
        state.activeRound.indices = course.indices;

        const courseNameEl = document.getElementById('current-course-name');
        if (courseNameEl) courseNameEl.innerText = state.activeRound.courseName;

        const courseParEl = document.getElementById('current-course-par');
        if (courseParEl) {
            const tPar = state.activeRound.pars.reduce((a, b) => a + (b || 0), 0);
            courseParEl.innerText = `Par Total: ${tPar}`;
        }

        closeCourseModal();

        // Configurar la ronda antes de empezar
        window.tempStartHole = 1;
        setStartHole(1);
        document.getElementById('modal-round-setup').classList.remove('hidden');
    }
}

// Helper methods for Round Setup Modal
function setStartHole(hole) {
    window.tempStartHole = hole;
    const btn1 = document.getElementById('btn-start-1');
    const btn10 = document.getElementById('btn-start-10');
    if (btn1 && btn10) {
        if (hole === 1) {
            btn1.style.background = 'var(--accent-color)';
            btn1.style.color = 'white';
            btn10.style.background = 'transparent';
            btn10.style.color = 'var(--accent-color)';
        } else {
            btn10.style.background = 'var(--accent-color)';
            btn10.style.color = 'white';
            btn1.style.background = 'transparent';
            btn1.style.color = 'var(--accent-color)';
        }
    }
}

function closeRoundSetupModal() {
    document.getElementById('modal-round-setup').classList.add('hidden');
}

function openSpecialRulesModal() {
    closeRoundSetupModal();
    document.getElementById('modal-special-rules').classList.remove('hidden');
}

function closeSpecialRulesModal() {
    document.getElementById('modal-special-rules').classList.add('hidden');
    document.getElementById('modal-round-setup').classList.remove('hidden'); // allow going back
}

function toggleRuleOptions(id, isChecked) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = isChecked ? 'block' : 'none';
    }
}

function confirmSpecialRulesAndStart() {
    document.getElementById('modal-special-rules').classList.add('hidden');

    // Guardar reglas en estado
    state.activeRound.rules = {
        tripa: {
            active: document.getElementById('rule-tripa-active').checked,
            amount: parseFloat(document.getElementById('rule-tripa-amount').value) || 15000,
            tripa2: document.getElementById('rule-tripa2-active').checked
        },
        media: {
            active: document.getElementById('rule-media-active').checked,
            amount: parseFloat(document.getElementById('rule-media-amount').value) || 10000
        },
        montana: {
            active: document.getElementById('rule-montana-active').checked,
            amount: parseFloat(document.getElementById('rule-montana-amount').value) || 5000
        }
    };

    startRound();
}

function startRound() {
    state.activeRound.startHole = window.tempStartHole;

    // Al iniciar nueva ronda, borramos cualquier score y data previa
    state.players.forEach(p => {
        p.scores = Array(18).fill(null);
        p.putts = Array(18).fill(null);
        p.robinData = Array(18).fill(null);
        p.mediaInfractions = Array(18).fill(false); // Para registrar al instante
        p.tripaPuntual = Array(18).fill(false);
    });

    updateUI();
}

function updateUI() {
    console.log("Golf Bet initialized...");

    // Restaurar los comentarios a la vista sin romper UI loop
    const commentsEl = document.getElementById('global-comments');
    if (commentsEl && document.activeElement !== commentsEl) {
        commentsEl.value = state.comments || "";
    }
    renderLeaderboard();
    renderFullScorecard();
    renderBets();
    renderConfigRonda();
    setupNavigation();
    recalculateNextHole();

    // Guardar estado en localStorage (Base de datos local del navegador)
    // No guardamos la instancia completa de currentUser para evitar errores de clase, solo si hay sesión
    const stateToSave = { ...state, currentUser: state.currentUser ? state.currentUser.id : null };
    localStorage.setItem('golf_bet_local_db', JSON.stringify(stateToSave));
}

function saveComments() {
    const el = document.getElementById('global-comments');
    if (el) {
        state.comments = el.value;
        const stateToSave = { ...state, currentUser: state.currentUser ? state.currentUser.id : null };
        localStorage.setItem('golf_bet_local_db', JSON.stringify(stateToSave));
    }
}

function recalculateNextHole() {
    let startHole = state.activeRound.startHole || 1;
    let sequence = [];
    if (startHole === 1) {
        for (let i = 1; i <= 18; i++) sequence.push(i);
    } else {
        for (let i = 10; i <= 18; i++) sequence.push(i);
        for (let i = 1; i <= 9; i++) sequence.push(i);
    }

    let nextHole = startHole;
    let isFinished = true;

    if (state.players.length === 0) {
        isFinished = false; // Aún vacío
    } else {
        for (let h of sequence) {
            let allFilled = state.players.every(p => p.scores && typeof p.scores[h - 1] === 'number');
            if (!allFilled) {
                nextHole = h;
                isFinished = false;
                break;
            }
        }
    }

    const btn = document.getElementById('main-action-btn');
    if (isFinished && state.players.length > 0) {
        window.currentHole = startHole; // doesn't matter much
        if (btn) {
            btn.innerText = "Ver Liquidación Final";
            btn.onclick = () => {
                renderLiquidation();
                const navItem = document.querySelector('.nav-item[data-tab="view-liquidacion"]');
                if (navItem) navItem.click();
                else {
                    // Fallback if nav item doesn't exist yet
                    document.querySelectorAll('.tab-view').forEach(v => v.classList.add('hidden'));
                    document.getElementById('view-liquidacion').classList.remove('hidden');
                }
            };
        }
    } else {
        window.currentHole = nextHole;
        if (btn) {
            btn.innerText = `Ingresar Score Hoyo ${nextHole}`;
            btn.onclick = () => { checkRobinMode(nextHole); };
        }
    }
}

// ----------------------------------------------------
// ROBIN MODE LOGIC
// ----------------------------------------------------
let robinTeams = {
    tramo1: {}, // Hoyo 1 al 6 (o 10 al 15)
    tramo2: {}, // Hoyo 7 al 12 (o 16 al 3)
    tramo3: {}  // Hoyo 13 al 18 (o 4 al 9)
};

function checkRobinMode(hole) {
    let startHole = state.activeRound.startHole || 1;
    let sequence = [];
    if (startHole === 1) {
        for (let i = 1; i <= 18; i++) sequence.push(i);
    } else {
        for (let i = 10; i <= 18; i++) sequence.push(i);
        for (let i = 1; i <= 9; i++) sequence.push(i);
    }

    const currentIndex = sequence.indexOf(hole);
    let tramoPendiente = null;
    let tramoId = null;

    if (currentIndex === 0 && Object.keys(robinTeams.tramo1).length === 0) {
        tramoPendiente = 1;
        tramoId = "tramo1";
    } else if (currentIndex === 6 && Object.keys(robinTeams.tramo2).length === 0) {
        tramoPendiente = 2;
        tramoId = "tramo2";
    } else if (currentIndex === 12 && Object.keys(robinTeams.tramo3).length === 0) {
        tramoPendiente = 3;
        tramoId = "tramo3";
    }

    if (tramoPendiente) {
        openRobinModal(tramoPendiente, tramoId);
    } else {
        openModal(hole); // Si no hay tramo por elegir, abre el modal de score normal
    }
}

function getMister() {
    return { id: "mister_bot", name: "El Mister", hcp: 0 };
}

function openRobinModal(tramoNum, tramoId) {
    window.currentTramo = tramoId; // Guardar estado globalmente
    const modal = document.getElementById('modal-robin');
    const title = document.getElementById('modal-robin-title');
    const container = document.getElementById('robin-teams-container');

    let startHole = state.activeRound.startHole || 1;
    let rangoTexto = "";

    if (startHole === 1) {
        if (tramoNum === 1) rangoTexto = "(Del 1 al 6)";
        else if (tramoNum === 2) rangoTexto = "(Del 7 al 12)";
        else if (tramoNum === 3) rangoTexto = "(Del 13 al 18)";
    } else {
        // Iniciando desde el 10
        if (tramoNum === 1) rangoTexto = "(Del 10 al 15)";
        else if (tramoNum === 2) rangoTexto = "(Del 16 al 3)";
        else if (tramoNum === 3) rangoTexto = "(Del 4 al 9)";
    }

    title.innerText = `Armar Parejas - Robin ${tramoNum} ${rangoTexto}`;

    // Preparar lista de jugadores, agregando al Mister si son impares
    let availablePlayers = [...state.players];
    if (availablePlayers.length === 3 || availablePlayers.length === 5) {
        availablePlayers.push(getMister());
    }

    let html = '';

    // CASO ESPECIAL: 6 JUGADORES (3 vs 3)
    if (availablePlayers.length === 6) {
        html += `<div class="card" style="margin-bottom: 10px; background: rgba(52, 124, 44, 0.1);">
                    <h3 style="margin-bottom: 10px; font-size: 0.9rem; color: var(--accent-color);">Equipo 1 (3 integrantes)</h3>
                    <div style="display: flex; gap: 5px; flex-direction: column;">
                        <select id="team-0-p1" class="form-input" onchange="validateRobinTeams()">
                            <option value="">Jugador 1</option>
                            ${availablePlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                        </select>
                        <select id="team-0-p2" class="form-input" onchange="validateRobinTeams()">
                            <option value="">Jugador 2</option>
                            ${availablePlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                        </select>
                        <select id="team-0-p3" class="form-input" onchange="validateRobinTeams()">
                            <option value="">Jugador 3</option>
                            ${availablePlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                        </select>
                    </div>
                 </div>
                 <div class="card" style="margin-bottom: 10px; background: rgba(52, 124, 44, 0.1);">
                    <h3 style="margin-bottom: 10px; font-size: 0.9rem; color: var(--accent-color);">Equipo 2 (3 integrantes)</h3>
                    <div style="display: flex; gap: 5px; flex-direction: column;">
                        <select id="team-1-p1" class="form-input" onchange="validateRobinTeams()">
                            <option value="">Jugador 1</option>
                            ${availablePlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                        </select>
                        <select id="team-1-p2" class="form-input" onchange="validateRobinTeams()">
                            <option value="">Jugador 2</option>
                            ${availablePlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                        </select>
                        <select id="team-1-p3" class="form-input" onchange="validateRobinTeams()">
                            <option value="">Jugador 3</option>
                            ${availablePlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                        </select>
                    </div>
                 </div>`;
    } else {
        // Modo Parejas estándar
        let pairsCount = availablePlayers.length / 2;
        for (let i = 0; i < pairsCount; i++) {
            html += `<div class="card" style="margin-bottom: 10px; background: rgba(52, 124, 44, 0.1);">
                        <h3 style="margin-bottom: 10px; font-size: 0.9rem; color: var(--accent-color);">Equipo ${i + 1}</h3>
                        <div style="display: flex; gap: 10px;">
                            <select id="team-${i}-p1" class="form-input" style="flex: 1;" onchange="validateRobinTeams()">
                                <option value="">Jugador 1</option>
                                ${availablePlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                            <select id="team-${i}-p2" class="form-input" style="flex: 1;" onchange="validateRobinTeams()">
                                <option value="">Jugador 2</option>
                                ${availablePlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>
                     </div>`;
        }
    }

    container.innerHTML = html;
    modal.classList.remove('hidden');
}

function validateRobinTeams() {
    let availablePlayers = [...state.players];
    if (availablePlayers.length === 3 || availablePlayers.length === 5) {
        availablePlayers.push(getMister());
    }

    let selectedIds = [];
    let selects = document.querySelectorAll('#robin-teams-container select');
    selects.forEach(s => { if (s.value) selectedIds.push(s.value); });

    // Obtenemos parejas ya formadas en tramos anteriores para evitar repetirlas (solo para <= 6 jugadores)
    let pastPairs = [];
    if (availablePlayers.length <= 6) {
        Object.keys(robinTeams).forEach(key => {
            if (key !== window.currentTramo && robinTeams[key]) {
                robinTeams[key].forEach(team => {
                    for (let i = 0; i < team.length; i++) {
                        for (let j = i + 1; j < team.length; j++) {
                            let sorted = [team[i], team[j]].sort();
                            pastPairs.push(sorted.join('-'));
                        }
                    }
                });
            }
        });
    }

    // Iterar de nuevo para deshabilitar las opciones
    selects.forEach(selectElement => {
        const myValue = selectElement.value;
        const myIdParts = selectElement.id.split('-'); // team-0-p1
        const teamId = myIdParts[1];

        // Otros select del mismo equipo
        const otherSelectsInTeam = Array.from(selects).filter(s => s.id.startsWith(`team-${teamId}-`) && s.id !== selectElement.id);

        Array.from(selectElement.options).forEach(option => {
            if (option.value === "" || option.value === myValue) {
                option.disabled = false;
            } else {
                let isAlreadySelected = selectedIds.includes(option.value);

                // Comprobar si formar equipo con CUALQUIERA de los otros del equipo viola parejas pasadas
                let makesInvalidPastPair = false;
                otherSelectsInTeam.forEach(otherS => {
                    if (otherS.value && option.value) {
                        let potentialPair = [option.value, otherS.value].sort().join('-');
                        if (pastPairs.includes(potentialPair)) makesInvalidPastPair = true;
                    }
                });

                option.disabled = isAlreadySelected || makesInvalidPastPair;
            }
        });
    });
}

function confirmRobinTeams() {
    let availablePlayers = [...state.players];
    if (availablePlayers.length === 3 || availablePlayers.length === 5) {
        availablePlayers.push(getMister());
    }

    let assignedIds = new Set();
    let teams = [];
    let selects = document.querySelectorAll('#robin-teams-container select');

    // Cuántos equipos hay?
    let teamIds = new Set();
    selects.forEach(s => teamIds.add(s.id.split('-')[1]));

    // Construir historial de parejas para validación final (solo para <= 6 jugadores)
    let pastPairs = [];
    if (availablePlayers.length <= 6) {
        Object.keys(robinTeams).forEach(key => {
            if (key !== window.currentTramo && robinTeams[key].length > 0) {
                robinTeams[key].forEach(team => {
                    for (let i = 0; i < team.length; i++) {
                        for (let j = i + 1; j < team.length; j++) {
                            let sorted = [team[i], team[j]].sort().join('-');
                            pastPairs.push(sorted);
                        }
                    }
                });
            }
        });
    }

    for (let tId of teamIds) {
        let teamPlayers = [];
        let teamSelects = Array.from(selects).filter(s => s.id.startsWith(`team-${tId}-`));

        for (let s of teamSelects) {
            if (!s.value) {
                alert("Por favor arma todos los equipos completamente.");
                return;
            }
            if (assignedIds.has(s.value)) {
                alert("Un jugador no puede estar en dos equipos. Revisa las selecciones.");
                return;
            }
            teamPlayers.push(s.value);
            assignedIds.add(s.value);
        }

        // Validar parejas dentro del equipo contra el pasado (solo para <= 6 jugadores)
        if (availablePlayers.length <= 6) {
            for (let i = 0; i < teamPlayers.length; i++) {
                for (let j = i + 1; j < teamPlayers.length; j++) {
                    let proposedPair = [teamPlayers[i], teamPlayers[j]].sort().join('-');
                    if (pastPairs.includes(proposedPair)) {
                        alert("Has repetido una pareja (o parte de un equipo) ya usada. Por reglas de Robin, debés rotar. ¡Inténtalo de nuevo!");
                        return;
                    }
                }
            }
        }
        teams.push(teamPlayers);
    }

    robinTeams[window.currentTramo] = teams;
    document.getElementById('modal-robin').classList.add('hidden');
    openModal(window.currentHole);
}

// Cargar estado de la base de datos local al iniciar
function loadLocalDB() {
    try {
        const saved = localStorage.getItem('golf_bet_local_db');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.players) state.players = parsed.players;
            if (parsed.bets) state.bets = parsed.bets;
            if (parsed.comments !== undefined) state.comments = parsed.comments;
            if (parsed.activeRound) state.activeRound = parsed.activeRound;
        }
    } catch (e) {
        console.error("Error cargando base de datos local", e);
    }
}

function renderBets() {
    const summaryList = document.getElementById('bets-summary-list');
    const detailedList = document.getElementById('bets-detailed-list');

    if (state.bets.length === 0) {
        summaryList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 0.8rem; padding: 10px;">No hay apuestas activas.</p>';
        detailedList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 0.8rem; padding: 20px;">No hay apuestas configuradas.</p>';
        return;
    }

    summaryList.innerHTML = '';
    detailedList.innerHTML = '';

    state.bets.forEach(bet => {
        const formattedCop = formatMoneyCOP(bet.amount);

        // Render Summary
        summaryList.innerHTML += `
            <div class="bet-item">
                <span class="bet-name">${bet.title}</span>
                <div style="text-align: right;">
                    <p class="bet-value" style="color: var(--accent-color);">${formattedCop}</p>
                </div>
            </div>
        `;

        // Render Detailed
        detailedList.innerHTML += `
            <div class="bet-item" style="border-bottom: 1px solid var(--glass-border); padding-bottom: 15px; margin-bottom: 15px;">
                <div>
                    <p class="bet-name">${bet.title}</p>
                    <p style="font-size: 0.7rem; color: var(--text-secondary);">${bet.type} - Activa</p>
                </div>
                <div style="text-align: right;">
                    <p class="bet-value" style="color: var(--accent-color);">${formattedCop}</p>
                </div>
            </div>
        `;
    });
}


function renderLeaderboard() {
    const list = document.getElementById('player-list');
    if (!list) return;

    if (state.players.length === 0) {
        list.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 20px; color: var(--text-secondary);">No hay jugadores. Añade uno para empezar.</td></tr>';
        return;
    }

    // Computar Tripa 2 primero (solo el ultimo paga por tramo en Robin)
    let tramoHoles = [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12], [13, 14, 15, 16, 17, 18]];
    let isRobinMode = state.bets.some(b => b.title.toLowerCase().includes('robin'));

    let rulesDesc = state.activeRound.rules || {};
    let tripaRules = rulesDesc.tripa || { active: true, amount: 15000, tripa2: false };
    let mediaRules = rulesDesc.media || { active: true };

    list.innerHTML = '';
    state.players.forEach(player => {
        const total = (player.scores || []).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);

        let tagsHtml = '';

        // Procesar 'Invita a Media'
        if (mediaRules.active && player.mediaInfractions && player.mediaInfractions.some(m => m === true)) {
            tagsHtml += `<span style="display:inline-block; margin-top:5px; background: rgba(255, 77, 77, 0.2); color: #ffbcbc; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: bold;">Invita a Media</span><br>`;
        }

        // Procesar 'Tripa'
        if (tripaRules.active && player.tripaPuntual) {
            let multiasTripa = 0;

            if (tripaRules.tripa2 && isRobinMode) {
                // Tripa 2 (Solo el ÚLTIMO del tramo paga) - Necesitamos ver en base a los hoyos llenados temporalmente
                // Aquí calcularemos cuántas veces fue el último de 'su' tramo.
                tramoHoles.forEach(tHoles => {
                    // Buscar el índice más alto de hoyo en este tramo donde ALGUIEN hizo tripa
                    let highestHoleWithTripa = -1;

                    tHoles.forEach(h => {
                        let holeIndex = h - 1;
                        let anyoneDidTripa = state.players.some(p => p.tripaPuntual && p.tripaPuntual[holeIndex] === true);
                        if (anyoneDidTripa) highestHoleWithTripa = holeIndex;
                    });

                    // Si hubo alguna tripa en el campo y yo soy quien la hizo en el maximo, me la cuentan 
                    if (highestHoleWithTripa !== -1) {
                        if (player.tripaPuntual[highestHoleWithTripa]) multiasTripa++;
                    }
                });
            } else {
                // Tripa 1 Clásica - todas cuentan
                multiasTripa = player.tripaPuntual.filter(t => t === true).length;
            }

            if (multiasTripa > 0) {
                // Regla Uno contra Todos: El infractor paga el monto base a CADA uno de los demás.
                // Total a pagar = Monto * (Número de jugadores - 1)
                const otherPlayersCount = state.players.length - 1;
                const totalDebt = multiasTripa * tripaRules.amount * otherPlayersCount;
                const copAmount = formatMoneyCOP(totalDebt);

                tagsHtml += `<span style="display:inline-block; margin-top:5px; background: rgba(255, 170, 0, 0.2); color: #ffcc00; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: bold;">Tripa x${multiasTripa} (Debe ${copAmount})</span><br>`;
                tagsHtml += `<span style="font-size: 0.55rem; color: var(--text-secondary); opacity: 0.8;">* Cobro individual de ${formatMoneyCOP(tripaRules.amount)} por participante</span>`;
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="player-info">
                    <div class="avatar">${player.name.substring(0, 2).toUpperCase()}</div>
                    <div>
                        <p style="font-weight: 600;">${player.name}</p>
                        <p style="font-size: 0.7rem; color: var(--text-secondary);">HCP: ${player.hcp}</p>
                        ${tagsHtml}
                    </div>
                </div>
            </td>
            <td class="score-cell positive">${total}</td>
        `;
        list.appendChild(tr);
    });
}


function openPlayerModal() {
    document.getElementById('modal-player').classList.remove('hidden');
}

function closePlayerModal() {
    document.getElementById('modal-player').classList.add('hidden');
}

function addPlayer() {
    const name = document.getElementById('new-player-name').value;
    const hcp = document.getElementById('new-player-hcp').value;

    if (!name) {
        alert("Ponle un nombre al jugador");
        return;
    }

    const newPlayer = {
        id: Date.now(),
        name: name,
        hcp: parseFloat(hcp) || 0,
        scores: Array(18).fill(null),
        putts: Array(18).fill(null)
    };

    state.players.push(newPlayer);

    // Limpiar y cerrar
    document.getElementById('new-player-name').value = '';
    document.getElementById('new-player-hcp').value = '';
    closePlayerModal();

    // Refrescar UI
    updateUI();
}

function renderFullScorecard() {
    renderCompactTable('table-front', 1, 9);
    renderCompactTable('table-back', 10, 18);
}

function renderCompactTable(tableId, startHole, endHole) {
    const table = document.getElementById(tableId);
    if (!table) return;

    let html = `<thead><tr><th class="player-name-cell">H</th>`;
    for (let i = startHole; i <= endHole; i++) {
        html += `<th onclick="openModal(${i})" style="cursor:pointer; color:var(--accent-color); text-decoration:underline;" title="Editar Hoyo ${i}">${i}</th>`;
    }
    html += `<th>Tot</th></tr>`;

    // Fila de Par
    html += `<tr><td class="player-name-cell">Par</td>`;
    let parSum = 0;
    for (let i = startHole; i <= endHole; i++) {
        const p = state.activeRound.pars[i - 1];
        html += `<td style="color: var(--text-secondary);">${p || '-'}</td>`;
        if (p) parSum += p;
    }
    html += `<td style="color: var(--text-secondary);">${parSum}</td></tr>`;

    // Fila de Ventaja (Handicap Index)
    html += `<tr><td class="player-name-cell" style="font-size: 0.75rem;">Ventaja</td>`;
    for (let i = startHole; i <= endHole; i++) {
        const hcpIdx = state.activeRound.indices ? state.activeRound.indices[i - 1] : null;
        html += `<td style="color: var(--accent-color); font-size: 0.75rem;">${hcpIdx || '-'}</td>`;
    }
    html += `<td>-</td></tr></thead><tbody>`;

    // Filas de Jugadores
    state.players.forEach(player => {
        html += `<tr><td class="player-name-cell">${player.name}</td>`;
        let rowSum = 0;
        for (let i = startHole; i <= endHole; i++) {
            const score = player.scores[i - 1] || '-';
            html += `<td>${score}</td>`;
            if (typeof score === 'number') rowSum += score;
        }
        html += `<td style="font-weight:700;">${rowSum || '-'}</td></tr>`;
    });

    html += `</tbody>`;
    table.innerHTML = html;
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.tab-view');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            if (!tabId) return;

            // Actualizar clase activa en nav
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Mostrar/Ocultar vistas
            views.forEach(view => {
                if (view.id === tabId) {
                    view.classList.remove('hidden');
                } else {
                    view.classList.add('hidden');
                }
            });
        });
    });
}

// Lógica de Autenticación Prototipo
function switchAuth(type) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabs = document.querySelectorAll('.auth-tab');

    if (type === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
    }
}

async function handleLogin() {
    const email = document.querySelector('#login-form input[type="email"]').value;
    const password = document.querySelector('#login-form input[type="password"]').value;

    if (!email || !password) {
        alert("Por favor rellena todos los campos");
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        alert("Error al entrar: " + error.message);
    } else {
        showProfile(data.user);
    }
}

async function handleRegister() {
    const email = document.querySelector('#register-form input[type="email"]').value;
    const password = document.querySelector('#register-form input[type="password"]').value;
    const name = document.querySelector('#register-form input[type="text"]').value;

    if (!email || !password || !name) {
        alert("Por favor rellena todos los campos");
        return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: { display_name: name },
            emailRedirectTo: window.location.origin + window.location.pathname
        }
    });

    if (error) {
        alert("Error al registrarse: " + error.message);
    } else {
        alert("¡Cuenta creada exitosamente! Bienvenido.");
        showProfile(data.user);
    }
}

async function showProfile(user) {
    state.currentUser = user; // Sincronizamos con el estado global

    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('profile-details').classList.remove('hidden');

    // Actualizar info visual
    const name = user.user_metadata.display_name || user.email.split('@')[0];
    document.getElementById('profile-name').innerText = name;
    document.getElementById('profile-email-display').innerText = user.email;
    document.getElementById('profile-avatar').innerText = name.substring(0, 2).toUpperCase();

    // Obtener handicap o crear perfil si no existe en la base de datos
    let currentHcp = 0;
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('handicap')
        .eq('id', user.id)
        .single();

    if (error && error.code === 'PGRST116') {
        // Falló porque no existe la fila, lo creamos y guardamos la info
        await supabaseClient.from('profiles').insert({
            id: user.id,
            email: user.email,
            display_name: name,
            handicap: 0
        });
    } else if (data) {
        currentHcp = data.handicap || 0;
    }

    document.getElementById('profile-hcp').value = currentHcp;

    // Si la lista de jugadores está vacía, nos añadimos nosotros mismos automáticamente
    if (state.players.length === 0) {
        state.players.push({
            id: user.id,
            name: name,
            hcp: currentHcp,
            scores: Array(18).fill(null),
            putts: Array(18).fill(null)
        });
    }

    updateUI();
}

async function updateHandicap() {
    const newHcp = document.getElementById('profile-hcp').value;
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) return;

    const { error } = await supabaseClient
        .from('profiles')
        .update({ handicap: parseFloat(newHcp) })
        .eq('id', user.id);

    if (error) {
        alert("Error al actualizar handicap: " + error.message);
    } else {
        alert("Handicap actualizado correctamente.");
    }
}

async function simulateLogout() {
    await supabaseClient.auth.signOut();
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('profile-details').classList.add('hidden');
}

function openBetModal() {
    document.getElementById('modal-bet').classList.remove('hidden');
}

function closeBetModal() {
    document.getElementById('modal-bet').classList.add('hidden');
    const descEl = document.getElementById('bet-description');
    if (descEl) descEl.innerText = "";
}

function selectSuggestion(title, amount, currency, description = "") {
    document.getElementById('bet-title').value = title;
    document.getElementById('bet-amount').value = amount;
    document.getElementById('bet-currency').value = currency;

    // Activar input Robin
    const pointGroup = document.getElementById('bet-point-group');
    if (pointGroup) {
        if (title.toLowerCase().includes('robin')) {
            pointGroup.style.display = 'block';
            document.getElementById('bet-point-amount').value = '5000';
            document.getElementById('bet-amount').value = '15000';
        } else {
            pointGroup.style.display = 'none';
        }
    }

    const descEl = document.getElementById('bet-description');
    if (descEl) {
        descEl.innerText = description;
    }

    // Feedback visual opcional: resaltar chip activo
    const chips = document.querySelectorAll('.chip');
    chips.forEach(c => {
        if (c.innerText.includes(title)) c.classList.add('active');
        else c.classList.remove('active');
    });
}

function addBet() {
    const title = document.getElementById('bet-title').value;
    const amount = document.getElementById('bet-amount').value;
    const currency = document.getElementById('bet-currency').value;
    const pointVal = document.getElementById('bet-point-amount')?.value;

    if (!title || !amount) {
        alert("Completa el título y el monto de la apuesta");
        return;
    }

    const newBet = {
        id: Date.now(),
        title: title,
        type: 'Personalizada',
        amount: parseFloat(amount),
        currency: currency,
        pointValue: title.toLowerCase().includes('robin') ? parseFloat(pointVal) : null
    };

    state.bets.push(newBet);

    // Limpiar campos
    document.getElementById('bet-title').value = '';
    document.getElementById('bet-amount').value = '';

    closeBetModal();
    updateUI();
}

function checkEnvironment() {
    if (window.location.protocol === 'file:') {
        console.warn("Estás en modo file://. Las redirecciones de Supabase requieren un servidor http para ser capturadas correctamente.");
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    checkEnvironment();
    loadLocalDB(); // Cargar base de datos local
    updateUI();    // Actualizar pantalla con los datos cargados

    // Lógica del Botón Principal de Score es asignada por recalculateNextHole en updateUI

    // Verificar si ya hay una sesión activa
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            showProfile(session.user);
        }
    }
});

let currentHole = window.currentHole || 1;

function openModal(overrideHole) {
    if (typeof overrideHole === 'number') {
        window.currentHole = overrideHole;
    }

    // fallback in case window.currentHole isn't a number
    if (typeof window.currentHole !== 'number' || isNaN(window.currentHole)) window.currentHole = 1;

    document.getElementById('modal-score').classList.remove('hidden');
    document.getElementById('modal-title').innerText = `Hoyo ${window.currentHole}`;

    const currentPar = state.activeRound.pars[window.currentHole - 1];
    const parLabel = document.getElementById('modal-hole-par');
    if (parLabel) {
        parLabel.innerText = currentPar ? `Par ${currentPar}` : 'Par --';
    }

    const isRobinMode = state.bets.some(b => b.title.toLowerCase().includes('robin'));

    const container = document.getElementById('score-players-container');
    if (!container) return;

    container.innerHTML = '';

    if (state.players.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Añade jugadores primero.</p>';
        return;
    }

    // Injectar Mister si estamos en modo Robin y somos impares
    let renderPlayers = [...state.players];
    if (state.players.length === 3 || state.players.length === 5) {
        renderPlayers.push(getMister());
    }

    renderPlayers.forEach(player => {
        let savedScore = null;
        let savedPutts = null;

        if (player.id === "mister_bot") {
            // Regla de Mister: Montaña (Par + 1 si el hoyo lo amerita o ajustado) => Según requerimiento: SIEMPRE Montaña, 2 putts y par.
            // Asumiremos que el requerimiento "Montaña, dos putts y par" significa Score = Par.
            // "Montaña" en golf colombiano usualmente refiere a fairways o tiros rectos al par.
            savedScore = currentPar || 4;
            savedPutts = 2;
        } else {
            const scoreVal = player.scores ? player.scores[window.currentHole - 1] : null;
            const puttVal = player.putts ? player.putts[window.currentHole - 1] : null;
            savedScore = (scoreVal !== undefined && scoreVal !== null) ? scoreVal : null;
            savedPutts = (puttVal !== undefined && puttVal !== null) ? puttVal : null;
        }

        const defaultScore = savedScore !== null ? savedScore : (currentPar || 4);
        const defaultPutts = savedPutts !== null ? savedPutts : 2;

        const isMister = player.id === "mister_bot";
        const disabledHtml = isMister ? "disabled" : "";
        const misterStyle = isMister ? "opacity: 0.7; filter: grayscale(1);" : "";

        // Robin Custom Checkboxes
        let specialChecksHtml = '';
        if (isRobinMode) {
            let sSandyPar = false, sMon = false;

            if (isMister) {
                sMon = true; // El Mister siempre hace montaña
            } else if (player.robinData && player.robinData[window.currentHole - 1]) {
                const rd = player.robinData[window.currentHole - 1];
                sSandyPar = rd.sandyPar; sMon = rd.montana;
            }

            specialChecksHtml = `
                <div class="form-group" style="margin-top: 15px; display: flex; gap: 15px; justify-content: center;">
                    <label class="custom-checkbox-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-secondary); font-size: 0.85rem; font-weight: 500;">
                        <input type="checkbox" id="check-sandypar-${player.id}" class="custom-checkbox" ${sSandyPar ? 'checked' : ''} ${disabledHtml}> 
                        <span class="custom-checkbox-text">Sandy Par</span>
                    </label>
                </div>
            `;
        }

        // Media Custom Checkboxes
        let mediaChecksHtml = '';
        if (state.activeRound.rules && state.activeRound.rules.media && state.activeRound.rules.media.active && !isMister) {
            let mMarcas = false;
            let mGreen = false;
            if (player.mediaData && player.mediaData[window.currentHole - 1]) {
                mMarcas = player.mediaData[window.currentHole - 1].marcas;
                mGreen = player.mediaData[window.currentHole - 1].green;
            }

            mediaChecksHtml = `
                <div class="form-group" style="margin-top: 15px; background: rgba(255, 77, 77, 0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(255, 77, 77, 0.2);">
                    <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: #ffbcbc; text-align: center; font-weight: 600;">🍻 Infracciones 'Invita a Media'</p>
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <label class="custom-checkbox-label danger" style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-secondary); font-size: 0.8rem;">
                            <input type="checkbox" id="check-media-marcas-${player.id}" class="custom-checkbox danger" ${mMarcas ? 'checked' : ''}> 
                            <span class="custom-checkbox-text">No pasó marcas rojas</span>
                        </label>
                        <label class="custom-checkbox-label danger" style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-secondary); font-size: 0.8rem;">
                            <input type="checkbox" id="check-media-green-${player.id}" class="custom-checkbox danger" ${mGreen ? 'checked' : ''}> 
                            <span class="custom-checkbox-text">Puteó y la sacó del green</span>
                        </label>
                    </div>
                </div>
            `;
        }

        container.innerHTML += `
            <div style="border-bottom: 1px solid var(--glass-border); padding-bottom: 15px; ${misterStyle}">
                <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 1rem; color: var(--accent-color);">${player.name}</h3>
                
                <div class="form-group" style="margin-bottom: 10px;">
                    <label>Golpes (Strokes)</label>
                    <div class="counter-input">
                        <button onclick="changeValue('strokes-${player.id}', -1, 1)" ${disabledHtml}>-</button>
                        <input type="number" id="input-strokes-${player.id}" value="${defaultScore}" readonly>
                        <button onclick="changeValue('strokes-${player.id}', 1, 1)" ${disabledHtml}>+</button>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                    <label>Putts</label>
                    <div class="counter-input">
                        <button onclick="changeValue('putts-${player.id}', -1, 0)" ${disabledHtml}>-</button>
                        <input type="number" id="input-putts-${player.id}" value="${defaultPutts}" readonly>
                        <button onclick="changeValue('putts-${player.id}', 1, 0)" ${disabledHtml}>+</button>
                    </div>
                </div>
                ${specialChecksHtml}
                ${mediaChecksHtml}
            </div>
        `;
    });
}

function closeModal() {
    document.getElementById('modal-score').classList.add('hidden');
}

function changeValue(id, delta, minVal = 1) {
    const input = document.getElementById(`input-${id}`);
    if (!input) return;
    let val = parseInt(input.value) + delta;
    if (val < minVal) val = minVal;
    input.value = val;
}

async function saveScore() {
    // Verificamos si hay usuario en el estado global
    if (!state.currentUser) {
        alert("Inicia sesión para guardar tu score.");
        const tabPerfil = document.querySelector('.nav-item[data-tab="view-perfil"]');
        if (tabPerfil) tabPerfil.click(); // Dirigir al perfil para login
        return;
    }

    if (state.players.length === 0) {
        alert("Primero añade al menos un jugador en la pestaña Ronda.");
        return;
    }

    const isRobinMode = state.bets.some(b => b.title.toLowerCase().includes('robin'));

    // Actualizamos el estado local de todos los jugadores iterando por la UI
    // Tambien nos preparamos para el calculo
    let holeDataList = {};

    let actualPlayersToSave = [...state.players];
    if (isRobinMode && (actualPlayersToSave.length === 3 || actualPlayersToSave.length === 5)) {
        actualPlayersToSave.push(getMister());
        // Agregamos a Mister temporalmente solo para extraer sus datos y calcular, luego se borra de la lista si es necesario,
        // Pero Robin requiere guardar Mister para los equipos. 
        // Como Mister no es un jugador real permanente asi que crearemos una lista en memoria.
    }

    actualPlayersToSave.forEach(player => {
        const isMister = player.id === "mister_bot";

        let strokes = 4, putts = 2;
        let cSandyPar = false, cMon = false;
        let cMediaMarcas = false, cMediaGreen = false;

        if (isMister) {
            strokes = state.activeRound.pars[window.currentHole - 1] || 4;
            putts = 2;
            cSandyPar = false;
            // El Mister siempre cumple Escenario A (Par y 2 putts)
            cMon = true;
        } else {
            const strokesInput = document.getElementById(`input-strokes-${player.id}`);
            const puttsInput = document.getElementById(`input-putts-${player.id}`);
            if (strokesInput && puttsInput) {
                strokes = parseInt(strokesInput.value);
                putts = parseInt(puttsInput.value);
            }

            const currentPar = state.activeRound.pars[window.currentHole - 1] || 4;

            // Lógica Automática de Montaña
            // Escenario A: Par y exactamente 2 putts
            const isParWith2Putts = (strokes === currentPar && putts === 2);
            // Escenario B: Birdie o mejor y exactamente 1 putt
            const isBirdieWith1Putt = (strokes < currentPar && putts === 1);

            cMon = isParWith2Putts || isBirdieWith1Putt;

            if (isRobinMode) {
                cSandyPar = document.getElementById(`check-sandypar-${player.id}`)?.checked || false;
            }

            // Revisa Infracciones Media
            cMediaMarcas = document.getElementById(`check-media-marcas-${player.id}`)?.checked || false;
            cMediaGreen = document.getElementById(`check-media-green-${player.id}`)?.checked || false;
        }

        // Si es mister, no lo guardamos en state.players, no es necesario, lo calcularemos al vuelo
        if (!isMister) {
            if (!player.scores) player.scores = Array(18).fill(null);
            player.scores[window.currentHole - 1] = strokes;

            if (!player.putts) player.putts = Array(18).fill(null);
            player.putts[window.currentHole - 1] = putts;

            if (isRobinMode) {
                if (!player.robinData) player.robinData = Array(18).fill(null);
                player.robinData[window.currentHole - 1] = { sandyPar: cSandyPar, montana: cMon, pointsWon: 0 };
            }

            // Guardar Data de Reglas de la Casa (Media y Tripa)
            if (!player.mediaData) player.mediaData = Array(18).fill(null);
            player.mediaData[window.currentHole - 1] = { marcas: cMediaMarcas, green: cMediaGreen };

            if (!player.mediaInfractions) player.mediaInfractions = Array(18).fill(false);
            if (!player.tripaPuntual) player.tripaPuntual = Array(18).fill(false);

            // Multa Invita a media si hace 4 putts, o seleccionó marcas/green
            player.mediaInfractions[window.currentHole - 1] = (putts >= 4) || cMediaMarcas || cMediaGreen;

            // Multa Tripa directa si hace 3 putts (4 putts ya es Media)
            // Asumiremos las tripas incluso con más putts o que 3 es la condición. Generalmente son "3 putts".
            player.tripaPuntual[window.currentHole - 1] = (putts === 3);
        }

        // Lógica matemática para ventaja de hoyo
        let roundedHcp = Math.round((player.hcp || 0) / 3) * 3;
        let pIndex = state.activeRound.indices[window.currentHole - 1];
        let hcpAdvantage = (pIndex && pIndex <= roundedHcp) ? 1 : 0;
        let netScore = strokes - hcpAdvantage;

        holeDataList[player.id] = { player, strokes, putts, cSandyPar, cMon, netScore, isMister };
    });

    if (isRobinMode && robinTeams[window.currentTramo]) {
        calculateRobinPoints(holeDataList);
    }

    closeModal();
    updateUI();
}

function calculateRobinPoints(hData) {
    let teams = robinTeams[window.currentTramo];
    if (!teams || teams.length === 0) return;

    let teamStats = [];

    // Calcula metricas de equipos
    teams.forEach((t, index) => {
        let p1 = hData[t[0]];
        let p2 = hData[t[1]];
        if (!p1 || !p2) return;

        let bestNet = Math.min(p1.netScore, p2.netScore);
        let pairSum = p1.netScore + p2.netScore;
        let pairPutts = p1.putts + p2.putts;
        let hadMontana = p1.cMon || p2.cMon;
        let hadVerdie = (p1.strokes <= (state.activeRound.pars[window.currentHole - 1] - 1)) || (p2.strokes <= (state.activeRound.pars[window.currentHole - 1] - 1));
        let hadSandyPar = p1.cSandyPar || p2.cSandyPar;

        teamStats.push({ index, bestNet, pairSum, pairPutts, hadMontana, hadVerdie, hadSandyPar });
    });

    // 1 punto por cada logro (6 Puntos)
    let metrics = [
        { key: 'bestNet', type: 'min' },
        { key: 'pairSum', type: 'min' },
        { key: 'pairPutts', type: 'min' },
        { key: 'hadMontana', type: 'boolean' },
        { key: 'hadVerdie', type: 'boolean' },
        { key: 'hadSandyPar', type: 'boolean' }
    ];

    metrics.forEach(m => {
        let winners = [];
        if (m.type === 'min') {
            let minVal = Math.min(...teamStats.map(ts => ts[m.key]));
            winners = teamStats.filter(ts => ts[m.key] === minVal).map(ts => ts.index);
        } else {
            winners = teamStats.filter(ts => ts[m.key]).map(ts => ts.index);
        }

        // Repartir 1 punto a las parejas ganadoras o empatadas 
        // (Si no hay ninguna 'boolean' ganadora, nadie gana ese punto)
        if (winners.length > 0) {
            let ptsEach = 1 / winners.length;
            winners.forEach(wIndex => {
                let pair = teams[wIndex];
                pair.forEach(pid => {
                    let rMember = state.players.find(p => p.id == pid);
                    if (rMember && rMember.robinData) {
                        rMember.robinData[window.currentHole - 1].pointsWon += ptsEach;
                    }
                });
            });
        }
    });
}

// Función global que calcula el balance de dinero/puntos de la apuesta Robin (incluyendo la regla Culimbis x2)
function getRobinBalances() {
    let balances = {}; // player_id -> dinero neto a favor/contra
    let totalPoints = {}; // player_id -> total puntos ganados para estadística

    // Iniciar contadores
    let allPlayers = state.players.filter(p => p.id !== "mister_bot");
    allPlayers.forEach(p => { balances[p.id] = 0; totalPoints[p.id] = 0; });

    const robinBet = state.bets.find(b => b.title.toLowerCase().includes('robin'));
    if (!robinBet) return { balances, totalPoints };
    let pointValue = robinBet.pointValue || 5000;

    let startHole = state.activeRound.startHole || 1;
    let sequence = [];
    if (startHole === 1) {
        for (let i = 1; i <= 18; i++) sequence.push(i);
    } else {
        for (let i = 10; i <= 18; i++) sequence.push(i);
        for (let i = 1; i <= 9; i++) sequence.push(i);
    }

    let tramosList = [
        { id: 'tramo1', holes: sequence.slice(0, 6) },
        { id: 'tramo2', holes: sequence.slice(6, 12) },
        { id: 'tramo3', holes: sequence.slice(12, 18) }
    ];

    tramosList.forEach(tramoInfo => {
        let teams = robinTeams[tramoInfo.id];
        if (!teams || Object.keys(teams).length === 0) return; // Tramo no jugado o no armado

        let tramoPointsByPair = {}; // indice_pareja -> puntos
        teams.forEach((t, i) => tramoPointsByPair[i] = 0);

        // Sumar puntos en ese tramo
        tramoInfo.holes.forEach(holeNum => {
            let holeIndex = holeNum - 1;
            teams.forEach((t, i) => {
                let p1 = allPlayers.find(p => p.id == t[0]) || { robinData: [] };
                // Los puntos ganados son idénticos para p1 y p2 de la pareja, así que miramos p1
                let pts = (p1.robinData[holeIndex] && p1.robinData[holeIndex].pointsWon) ? p1.robinData[holeIndex].pointsWon : 0;
                tramoPointsByPair[i] += pts;

                // Añadimos a las estadísticas globales
                if (t[0] !== "mister_bot") totalPoints[t[0]] += pts;
                if (t[1] !== "mister_bot") totalPoints[t[1]] += pts;
            });
        });

        // Calcular balances entre los equipos aplicando diferencias de puntos CADA CONTRA CADA (Round Robin)
        // Regla CULIMBIS: Si un equipo sacó 0 puntos en los 6 hoyos completos, sus deudas se multiplican por 2.

        let numHolesPlayed = tramoInfo.holes.filter(h => {
            // Comprobar si al menos algun jugador tiene robinData para este hoyo asumiendo que ya fue jugado
            return allPlayers.some(p => p.robinData && p.robinData[h - 1] && typeof p.robinData[h - 1].pointsWon === 'number');
        }).length;

        // Solo se aplica el castigo Culimbis si el tramo se jugó por completo (6 hoyos jugados)
        let isTramoComplete = numHolesPlayed === 6;

        for (let a = 0; a < teams.length; a++) {
            for (let b = a + 1; b < teams.length; b++) {
                let ptsA = tramoPointsByPair[a];
                let ptsB = tramoPointsByPair[b];

                let diff = ptsA - ptsB;
                let moneyTransfer = diff * pointValue;

                // Aplicar multiplicadores según si un equipo es Culimbis o el otro.
                // Equipo A culimbis (0 puntos y perdió contra B)
                if (isTramoComplete && ptsA === 0 && ptsB > 0) moneyTransfer *= 2;
                // Equipo B culimbis (0 puntos y perdió contra A)
                else if (isTramoComplete && ptsB === 0 && ptsA > 0) moneyTransfer *= 2;

                // Aplicamos las deudas al wallet de cada individuo 
                // Aumentamos a los miembros del equipo A (Si moneyTransfer es positivo A ganó a B, si es negativo A perdió con B)
                let pA1 = teams[a][0], pA2 = teams[a][1];
                let pB1 = teams[b][0], pB2 = teams[b][1];

                if (pA1 !== "mister_bot" && balances[pA1] !== undefined) balances[pA1] += moneyTransfer;
                if (pA2 !== "mister_bot" && balances[pA2] !== undefined) balances[pA2] += moneyTransfer;

                if (pB1 !== "mister_bot" && balances[pB1] !== undefined) balances[pB1] -= moneyTransfer;
                if (pB2 !== "mister_bot" && balances[pB2] !== undefined) balances[pB2] -= moneyTransfer;
            }
        }
    });

    return { balances, totalPoints };
}

function renderConfigRonda() {
    // 1. Montos y Multas
    const tripaAmountInput = document.getElementById('config-tripa-amount');
    if (tripaAmountInput && state.activeRound.rules && state.activeRound.rules.tripa) {
        const amount = state.activeRound.rules.tripa.amount || 15000;
        tripaAmountInput.value = amount;

        // Mostrar impacto real basado en jugadores
        const numOthers = Math.max(0, state.players.length - 1);
        const totalImpact = amount * numOthers;
        const configSection = tripaAmountInput.closest('section');
        if (configSection) {
            let infoEl = document.getElementById('config-tripa-info');
            if (!infoEl) {
                infoEl = document.createElement('p');
                infoEl.id = 'config-tripa-info';
                infoEl.style.fontSize = '0.75rem';
                infoEl.style.marginTop = '10px';
                infoEl.style.color = 'var(--text-secondary)';
                tripaAmountInput.parentElement.after(infoEl);
            }
            infoEl.innerHTML = `Regla: <strong>Uno contra Todos</strong>.<br>Con ${state.players.length} jugadores, el infractor pagará <strong>${formatMoneyCOP(totalImpact)}</strong> en total (${formatMoneyCOP(amount)} a cada oponente).`;
        }
    }

    // 1.1 Robin Settings
    const robinBet = state.bets.find(b => b.title.toLowerCase().includes('robin'));
    const robinSettingsDiv = document.getElementById('config-robin-settings');
    if (robinSettingsDiv) {
        if (robinBet) {
            robinSettingsDiv.style.display = 'block';
            document.getElementById('config-robin-base').value = robinBet.amount || 20000;
            document.getElementById('config-robin-point').value = robinBet.pointValue || 5000;
        } else {
            robinSettingsDiv.style.display = 'none';
        }
    }

    // 1.2 Extra Rules Settings
    if (state.activeRound.rules) {
        const mediaInput = document.getElementById('config-media-amount');
        const montanaInput = document.getElementById('config-montana-amount');
        if (mediaInput) mediaInput.value = state.activeRound.rules.media?.amount || 10000;
        if (montanaInput) montanaInput.value = state.activeRound.rules.montana?.amount || 5000;
    }

    // 2. Lista de Jugadores para eliminar
    const playersList = document.getElementById('config-players-list');
    if (playersList) {
        if (state.players.length === 0) {
            playersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 0.8rem;">No hay jugadores en la ronda.</p>';
        } else {
            playersList.innerHTML = state.players.map(p => `
                <div class="bet-item" style="border-bottom: 1px solid var(--glass-border); padding: 10px 0;">
                    <span style="font-weight:600;">${p.name}</span>
                    <button onclick="confirmDeletePlayerFromConfig('${p.id}')" style="background:#ff4d4d; color:white; border:none; border-radius:4px; padding:4px 8px; font-size:0.7rem; cursor:pointer;">ELIMINAR</button>
                </div>
            `).join('');
        }
    }

    // 3. Lista de Apuestas para eliminar/ajustar
    const betsList = document.getElementById('config-bets-list');
    if (betsList) {
        if (state.bets.length === 0) {
            betsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 0.8rem;">No hay apuestas configuradas.</p>';
        } else {
            betsList.innerHTML = state.bets.map(b => `
                <div class="bet-item" style="border-bottom: 1px solid var(--glass-border); padding: 10px 0;">
                    <div>
                        <p style="margin:0; font-weight:600;">${b.title}</p>
                        <p style="margin:0; font-size:0.7rem; color:var(--text-secondary);">${formatMoneyCOP(b.amount)} - ${b.type}</p>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button onclick="editBetAmountFromConfig('${b.id}')" style="background:var(--accent-color); color:white; border:none; border-radius:4px; padding:4px 8px; font-size:0.7rem; cursor:pointer;">EDITAR</button>
                        <button onclick="confirmDeleteBetFromConfig('${b.id}')" style="background:#ff4d4d; color:white; border:none; border-radius:4px; padding:4px 8px; font-size:0.7rem; cursor:pointer;">BORRAR</button>
                    </div>
                </div>
            `).join('');
        }
    }
}

function updateConfigAmounts() {
    const newAmount = parseFloat(document.getElementById('config-tripa-amount').value);
    if (isNaN(newAmount)) return;

    const numOthers = Math.max(0, state.players.length - 1);
    const totalImpact = newAmount * numOthers;

    if (confirm(`¿Confirmas el nuevo monto base de ${formatMoneyCOP(newAmount)}?\n\nPor regla 'Uno contra Todos', cada tripa costará ${formatMoneyCOP(totalImpact)} al infractor en total.`)) {
        if (!state.activeRound.rules) state.activeRound.rules = {};
        if (!state.activeRound.rules.tripa) state.activeRound.rules.tripa = { active: true, amount: 15000, tripa2: false };

        state.activeRound.rules.tripa.amount = newAmount;
        updateUI();
        showCustomAlert("Ajuste Aplicado", "El valor de la multa ha sido actualizado bajo la modalidad de cobro individual.");
    }
}

function updateRobinConfig() {
    const newBase = parseFloat(document.getElementById('config-robin-base').value);
    const newPoint = parseFloat(document.getElementById('config-robin-point').value);

    if (isNaN(newBase) || isNaN(newPoint)) {
        alert("Por favor ingresa montos válidos.");
        return;
    }

    if (confirm(`¿Confirmas los cambios en la apuesta Robin?\n\nNuevo Monto Base: ${formatMoneyCOP(newBase)}\nNuevo Valor por Punto: ${formatMoneyCOP(newPoint)}`)) {
        const robinBet = state.bets.find(b => b.title.toLowerCase().includes('robin'));
        if (robinBet) {
            robinBet.amount = newBase;
            robinBet.pointValue = newPoint;
            updateUI();
            showCustomAlert("Robin Actualizado", "Los montos se han recalculado exitosamente.");
        }
    }
}

function confirmDeletePlayerFromConfig(id) {
    if (confirm("¿Estás seguro de que deseas eliminar este jugador? Se perderán sus scores y se ajustarán las apuestas de equipo instantáneamente.")) {
        state.players = state.players.filter(p => String(p.id) !== String(id));
        updateUI();
    }
}

function confirmDeleteBetFromConfig(id) {
    if (confirm("¿Estás seguro de que deseas eliminar esta apuesta de la ronda? Los saldos se recalcularán sin incluirla.")) {
        state.bets = state.bets.filter(b => String(b.id) !== String(id));
        updateUI();
    }
}

function editBetAmountFromConfig(id) {
    const bet = state.bets.find(b => String(b.id) === String(id));
    if (!bet) return;

    const newAmount = prompt(`Ingresa el nuevo monto para "${bet.title}":`, bet.amount);
    if (newAmount !== null) {
        const parsed = parseFloat(newAmount);
        if (!isNaN(parsed)) {
            bet.amount = parsed;
            updateUI();
            showCustomAlert("Apuesta Actualizada", `El monto de "${bet.title}" ha sido cambiado a ${formatMoneyCOP(parsed)}.`);
        }
    }
}

function updateConfigExtraRules() {
    if (!state.activeRound.rules) state.activeRound.rules = { tripa: { amount: 15000 }, media: {}, montana: {} };
    if (!state.activeRound.rules.media) state.activeRound.rules.media = { active: true, amount: 10000 };
    if (!state.activeRound.rules.montana) state.activeRound.rules.montana = { active: true, amount: 5000 };

    const newMedia = parseFloat(document.getElementById('config-media-amount').value);
    const newMontana = parseFloat(document.getElementById('config-montana-amount').value);

    if (!isNaN(newMedia)) state.activeRound.rules.media.amount = newMedia;
    if (!isNaN(newMontana)) state.activeRound.rules.montana.amount = newMontana;

    updateUI();
    showCustomAlert("Reglas Actualizadas", "Los valores de multas y bonos han sido guardados correctamente.");
}

// --- LIQUIDACIÓN Y NETTING ---

function renderLiquidation() {
    const summaryEl = document.getElementById('liquidation-summary');
    const transfersEl = document.getElementById('liquidation-transfers');
    const statsEl = document.getElementById('liquidation-stats');
    if (!summaryEl || !transfersEl || !statsEl) return;

    // 0. Validación de Integridad
    let missingInfo = [];
    state.players.forEach(p => {
        const nulls = p.scores.filter(s => s === null).length;
        if (nulls > 0) missingInfo.push(`${p.name} (${nulls} hoyos pendientes)`);
    });
    if (missingInfo.length > 0) {
        summaryEl.innerHTML = `<p style="color:#ff4d4d; font-size:0.85rem;"><strong>Auditoría Fallida:</strong> Faltan datos por registrar.<br>${missingInfo.join('<br>')}</p>`;
        return;
    }

    // 1. Auditoría de Variables (Barrido Total)
    const playerBalances = {}; // {id: {total: 0, details: []}}
    const totalStats = {}; // {id: {montanas: 0, tripas: 0, medias: 0}}
    const rules = state.activeRound.rules || { tripa: { amount: 15000 }, media: { amount: 10000 }, montana: { amount: 5000 } };

    state.players.forEach(p => {
        playerBalances[p.id] = { total: 0, details: [] };
        totalStats[p.id] = { montanas: 0, tripas: 0, medias: 0 };
    });

    // 1.1 Robin (Base + Puntos)
    const robin = getRobinBalances();
    Object.keys(robin.balances).forEach(pid => {
        if (!playerBalances[pid]) return;
        const amount = robin.balances[pid];
        if (amount !== 0) {
            playerBalances[pid].total += amount;
            playerBalances[pid].details.push({ concept: 'Robin (Tramo + Puntos)', amount });
        }
    });

    // 1.2 Penalizaciones (Tripa y Media)
    state.players.forEach(p => {
        // La Tripa (Uno contra Todos)
        let countTripas = (p.tripaPuntual || []).filter(t => t === true).length;
        if (countTripas > 0) {
            totalStats[p.id].tripas = countTripas;
            const otherPlayersCount = state.players.length - 1;
            const debtPerTripa = rules.tripa.amount * otherPlayersCount;
            const totalTripaDebt = countTripas * debtPerTripa;

            playerBalances[p.id].total -= totalTripaDebt;
            playerBalances[p.id].details.push({ concept: `${countTripas} Tripas (Uno c/ Todos)`, amount: -totalTripaDebt });

            // Créditos para oponentes
            state.players.forEach(other => {
                if (other.id !== p.id) {
                    const credit = countTripas * rules.tripa.amount;
                    playerBalances[other.id].total += credit;
                    playerBalances[other.id].details.push({ concept: `Crédito Tripa de ${p.name}`, amount: credit });
                }
            });
        }

        // Invita a Media
        let countMedias = (p.mediaInfractions || []).filter(m => m === true).length;
        if (countMedias > 0) {
            totalStats[p.id].medias = countMedias;
            const mediaVal = rules.media.amount || 10000;
            const totalMediaDebt = countMedias * mediaVal;
            playerBalances[p.id].total -= totalMediaDebt;
            playerBalances[p.id].details.push({ concept: `${countMedias} Medias Cometidas`, amount: -totalMediaDebt });
            // Nota: El dinero de la media usualmente va a un fondo común (o se reparte). 
            // Aquí lo repartiremos entre los demás por simplicidad de liquidación.
            const creditPerOther = totalMediaDebt / (state.players.length - 1);
            state.players.forEach(other => {
                if (other.id !== p.id) {
                    playerBalances[other.id].total += creditPerOther;
                    playerBalances[other.id].details.push({ concept: `Bono Media de ${p.name}`, amount: creditPerOther });
                }
            });
        }
    });

    // 1.3 Bonificaciones Automáticas (Montaña)
    if (rules.montana?.active) {
        state.players.forEach(p => {
            let countM = 0;
            if (p.scores && p.putts) {
                p.scores.forEach((s, idx) => {
                    if (s === null) return;
                    const par = state.activeRound.pars[idx];
                    const pts = p.putts[idx];
                    // Regla: Par con 2 putts o Birdie con 1 putt
                    if ((s === par && pts === 2) || (s <= par - 1 && pts === 1)) countM++;
                });
            }
            totalStats[p.id].montanas = countM;
            if (countM > 0) {
                const monVal = rules.montana.amount || 5000;
                const totalMonBonus = countM * monVal * (state.players.length - 1);
                playerBalances[p.id].total += totalMonBonus;
                playerBalances[p.id].details.push({ concept: `${countM} Montañas Ganadas`, amount: totalMonBonus });

                // Deuda para los demás
                state.players.forEach(other => {
                    if (other.id !== p.id) {
                        playerBalances[other.id].total -= (countM * monVal);
                        playerBalances[other.id].details.push({ concept: `Debe Montaña a ${p.name}`, amount: -(countM * monVal) });
                    }
                });
            }
        });
    }

    // 1.4 Auditoría de Apuestas Extra (Skins, Match Play, Nassau)
    state.bets.forEach(bet => {
        const title = bet.title.toLowerCase();
        if (title.includes('robin')) return;

        if (title.includes('skins')) {
            // Lógica Skins: El score neto más bajo en solitario gana el skin.
            let skinsAmount = bet.amount || 10000;
            let carryOver = 0;

            for (let i = 0; i < 18; i++) {
                let pot = skinsAmount + carryOver;
                let scores = state.players.map(p => {
                    let roundedHcp = Math.round((p.hcp || 0) / 3) * 3;
                    let pIndex = state.activeRound.indices[i];
                    let hcpAdvantage = (pIndex && pIndex <= roundedHcp) ? 1 : 0;
                    return { id: p.id, net: (p.scores[i] || 99) - hcpAdvantage };
                });

                let minScore = Math.min(...scores.map(s => s.net));
                let winners = scores.filter(s => s.net === minScore);

                if (winners.length === 1 && winners[0].net < 99) {
                    let winId = winners[0].id;
                    const totalWin = pot * (state.players.length - 1);
                    playerBalances[winId].total += totalWin;
                    playerBalances[winId].details.push({ concept: `Skin Hoyo ${i + 1}`, amount: totalWin });

                    state.players.forEach(other => {
                        if (other.id !== winId) {
                            playerBalances[other.id].total -= pot;
                            playerBalances[other.id].details.push({ concept: `Skin H${i + 1} a ${state.players.find(p => p.id === winId).name}`, amount: -pot });
                        }
                    });
                    carryOver = 0;
                } else {
                    carryOver = pot; // Se arrastra al siguiente hoyo
                }
            }
        } else if (title.includes('match') || title.includes('hoyos')) {
            // Match Play Simplificado (El que gane más hoyos netos se lleva el pozo de todos)
            let matchWinCount = {};
            state.players.forEach(p => matchWinCount[p.id] = 0);

            for (let i = 0; i < 18; i++) {
                let scores = state.players.map(p => {
                    let roundedHcp = Math.round((p.hcp || 0) / 3) * 3;
                    let pIndex = state.activeRound.indices[i];
                    let hcpAdvantage = (pIndex && pIndex <= roundedHcp) ? 1 : 0;
                    return { id: p.id, net: (p.scores[i] || 99) - hcpAdvantage };
                });
                let minScore = Math.min(...scores.map(s => s.net));
                let winners = scores.filter(s => s.net === minScore);
                if (winners.length === 1 && winners[0].net < 99) matchWinCount[winners[0].id]++;
            }

            let maxHoyos = Math.max(...Object.values(matchWinCount));
            let overallWinners = state.players.filter(p => matchWinCount[p.id] === maxHoyos);

            if (overallWinners.length < state.players.length) {
                let winAmount = (bet.amount || 0);
                overallWinners.forEach(w => {
                    const totalGain = winAmount * (state.players.length - overallWinners.length) / overallWinners.length;
                    playerBalances[w.id].total += totalGain;
                    playerBalances[w.id].details.push({ concept: `Ganador Match Play (${maxHoyos} hoyos)`, amount: totalGain });

                    state.players.forEach(other => {
                        if (!overallWinners.find(ow => ow.id === other.id)) {
                            const loss = winAmount / overallWinners.length;
                            playerBalances[other.id].total -= loss;
                            playerBalances[other.id].details.push({ concept: `Perdió Match Play`, amount: -loss });
                        }
                    });
                });
            }
        }
    });

    // 2. Reporte de Cierre Detallado (Narrativo)
    summaryEl.innerHTML = state.players.map(p => {
        const bal = playerBalances[p.id];
        const statusColor = bal.total >= 0 ? 'var(--accent-color)' : '#ff4d4d';
        return `
            <div style="margin-bottom: 20px; border-bottom: 1px solid var(--glass-border); padding-bottom: 12px;">
                <p style="font-weight:800; color: ${statusColor}; margin:0; font-size: 1rem;">
                    ${p.name}: ${bal.total >= 0 ? '+' : ''}${formatMoneyCOP(Math.round(bal.total))}
                </p>
                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top:6px; line-height:1.4;">
                    ${bal.details.length > 0 ? bal.details.map(d => `• ${d.concept}: <strong>${d.amount > 0 ? '+' : ''}${formatMoneyCOP(Math.round(d.amount))}</strong>`).join('<br>') : 'Sin movimientos registrados.'}
                </div>
            </div>
        `;
    }).join('');

    // 3. Algoritmo de Compensación (Netting)
    const creditors = [];
    const debtors = [];
    state.players.forEach(p => {
        const balance = Math.round(playerBalances[p.id].total);
        if (balance > 10) creditors.push({ id: p.id, name: p.name, balance });
        else if (balance < -10) debtors.push({ id: p.id, name: p.name, balance: Math.abs(balance) });
    });

    // Ordenar para mejor compensación
    creditors.sort((a, b) => b.balance - a.balance);
    debtors.sort((a, b) => b.balance - a.balance);

    let transfersHtml = '';
    while (debtors.length > 0 && creditors.length > 0) {
        let debtor = debtors[0];
        let creditor = creditors[0];
        let amount = Math.min(debtor.balance, creditor.balance);

        transfersHtml += `
            <div class="bet-item" style="padding: 12px 0; border-bottom: 1px solid var(--glass-border); flex-direction: column; align-items: flex-start;">
                <p style="margin:0; font-size: 0.85rem;">
                    <strong style="color:#ff4d4d;">${debtor.name}</strong> le paga 
                    <strong style="color:var(--accent-color); font-size:1.1rem;">${formatMoneyCOP(Math.round(amount))}</strong> a 
                    <strong style="color:var(--accent-color);">${creditor.name}</strong>
                </p>
                <p style="margin:2px 0 0 0; font-size:0.65rem; color:var(--text-secondary);">Transacción para quedar a Paz y Salvo.</p>
            </div>
        `;

        debtor.balance -= amount;
        creditor.balance -= amount;

        if (debtor.balance < 10) debtors.shift();
        if (creditor.balance < 10) creditors.shift();
    }
    transfersEl.innerHTML = transfersHtml || '<p style="text-align:center; font-size:0.8rem; color:var(--text-secondary); padding: 10px;">¡Mesa Equilibrada! No hay deudas pendientes.</p>';
}

// Exportar para uso futuro en módulos
if (typeof module !== 'undefined') {
    module.exports = { calculateAdvantages };
}
