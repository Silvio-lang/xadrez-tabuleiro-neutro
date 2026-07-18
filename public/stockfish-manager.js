// stockfish-manager.js
// Manages communication with the Stockfish Web Worker and AI logic.

// Import necessary functions from game-state.js and ui.js
// Ensure these functions are correctly exported in the respective files
import { getJogoInstance, getGameState, moverPeca, setGameState, setScoreAtual, getCapturedPieces } from './game-state.js';
// Import all necessary UI update functions directly
import { mostrarMensagemTemporaria, atualizarAvaliacao, mostrarEmojiAvaliacao, mostrarSugestoes as updateUISuggestions } from './ui.js';

import { atualizarInfo } from './ui.js';

// Stockfish Worker instance
let stockfish = null; // The Web Worker object for Stockfish
// Queue for messages received from Stockfish
let stockfishMessageQueue = []; // Stores incoming messages to be processed sequentially
// Flag to indicate if a Stockfish message is currently being processed
let isProcessingStockfishMessage = false; // Prevents multiple messages from being processed at once
// Tracks the current task requested from Stockfish (e.g., 'ia_play', 'evaluate', 'suggestions')
let currentStockfishTask = null; // Helps contextually handle Stockfish responses
// Flag to indicate if Stockfish is currently busy processing a request
let stockfishOcupado = false; // Prevents sending new commands while Stockfish is busy

// AI related variables
let currentLevel = "8-0"; // Current AI difficulty level (format: depth-error_chance)
let sugestoesIA = []; // Array to store AI move suggestions for the user
let pioresJogadas = []; // Array to store potentially bad moves during calculation (for error simulation)
// scoreAtual is now managed in game-state.js, but we need a local variable for processing messages
let latestScore = 0; // Stores the most recent evaluation score received from Stockfish 'info' messages
let avaliacaoEmoji = null; // Emoji representation of the evaluation (managed locally for display logic)
let timeoutAvaliacao = null; // Timeout ID for hiding the evaluation emoji

// Mapping of level values (depth-error_chance) to display names for the UI
// Kept this as it might be useful for displaying the level name as text
const levelNames = {
    '1-50': 'Iniciante 1',
    '2-30': 'Iniciante 2',
    '3-10': 'Iniciante 3',
    '4-0': 'Fraco',
    '8-0': 'Médio',
    '12-0': 'Forte',
    '16-0': 'Muito Forte'
};

// Removed levelAvatars and avatarNames mappings

/**
 * Initializes the Stockfish Web Worker.
 * Creates the worker, sets up message and error handlers, and sends initial UCI commands.
 * Returns a Promise that resolves when Stockfish signals it's ready ("readyok").
 * @returns {Promise<void>} A promise that resolves when Stockfish is ready.
 */
export function inicializarStockfish() {
    return new Promise((resolve, reject) => {
        console.log("Inicializando Stockfish...");
        // Reset state related to Stockfish before initialization
        stockfishOcupado = false;
        currentStockfishTask = null;
        stockfishMessageQueue = [];
        isProcessingStockfishMessage = false;
        latestScore = 0; // Reset latest score on initialization

        // Check for Web Worker support in the browser environment
        if (!window.Worker) {
            reject(new Error("Web Worker não é suportado neste dispositivo."));
            mostrarMensagemTemporaria("Erro: Este dispositivo não suporta o Stockfish. Tente usar um computador.");
            return;
        }

        // Terminate existing worker if any to ensure a clean start
        if (stockfish) stockfish.terminate();

        try {
            // Create a new Stockfish worker instance. The path should be relative to jogo.html
            // Ensure the stockfish-16.1-lite-single.js file is in the correct location.
            stockfish = new Worker("stockfish-16.1-lite-single.js");
            console.log("Stockfish Worker criado com sucesso.");
            // Set the message handler to process incoming messages from the worker
            stockfish.onmessage = handleStockfishMessage;
        } catch (e) {
            // Handle errors that occur during the worker creation process
            reject(new Error("Erro ao carregar o Stockfish: " + e.message));
            mostrarMensagemTemporaria("Erro: Não foi possível carregar o Stockfish. Verifique se o arquivo stockfish-16.1-lite-single.js está na mesma pasta que o Xadrez.html.");
            return;
        }

        // Set the error handler for the worker to catch any errors within the worker
        stockfish.onerror = (error) => {
            console.error("Erro no Stockfish Worker:", error);
            reject(new Error("Erro ao carregar Stockfish: " + error.message));
            mostrarMensagemTemporaria("Erro: Falha ao carregar o Stockfish. Verifique se o arquivo stockfish-16.1-lite-single.js está na mesma pasta que o Xadrez.html.");
        };

        // Send initial UCI (Universal Chess Interface) commands to set up Stockfish
        stockfish.postMessage("uci"); // Request UCI identification
        stockfish.postMessage("ucinewgame"); // Inform Stockfish about a new game session
        stockfish.postMessage("isready"); // Ask Stockfish if it's ready to receive commands

        // Listen specifically for the "readyok" message, which confirms Stockfish is ready
        let readyOkReceived = false;
        const readyListener = (e) => {
            if (e.data === "readyok") {
                console.log("Stockfish pronto para uso!");
                readyOkReceived = true;
                // Remove this temporary listener once readyok is received
                stockfish.removeEventListener('message', readyListener);
                resolve(); // Resolve the promise, indicating successful initialization
            } else {
                // Process other messages that might arrive before "readyok" (e.g., "uciok")
                handleStockfishMessage(e);
            }
        };
        stockfish.addEventListener('message', readyListener);

        // Set a timeout for the initialization process to prevent indefinite waiting
        setTimeout(() => {
            if (!readyOkReceived) {
                // If "readyok" is not received within the timeout, remove the listener and reject the promise
                stockfish.removeEventListener('message', readyListener);
                reject(new Error("Timeout ao iniciar Stockfish"));
                mostrarMensagemTemporaria("Erro: Stockfish não respondeu a tempo. Tente recarregar a página ou verificar os arquivos.");
            }
        }, 20000); // 20 seconds timeout
    });
}

/**
 * Restarts the Stockfish Web Worker.
 * Terminates the current worker instance and initializes a new one.
 */
export function reiniciarStockfish() {
    console.log("Reiniciando Stockfish...");
    if (stockfish) {
        stockfish.terminate(); // Terminate the existing worker
        stockfish = null; // Clear the reference
    }
    // Reset state and re-initialize Stockfish by calling the initialization function
    stockfishOcupado = false;
    stockfishMessageQueue = [];
    isProcessingStockfishMessage = false;
    currentStockfishTask = null;
    latestScore = 0; // Reset latest score
    inicializarStockfish()
        .then(() => mostrarMensagemTemporaria("Stockfish reiniciado e pronto!", 3000)) // Success message
        .catch((error) => mostrarMensagemTemporaria("Falha ao reiniciar Stockfish: " + error.message, 5000)); // Error message
}

/**
 * Handles messages received from the Stockfish Web Worker.
 * Adds incoming messages to a queue for sequential processing.
 * This prevents potential issues with processing messages out of order.
 * @param {MessageEvent} e - The message event containing data from the worker.
 */
function handleStockfishMessage(e) {
    stockfishMessageQueue.push(e.data); // Add the received message data to the end of the queue
    processStockfishQueue(); // Attempt to process the queue (will only proceed if not already processing)
}

/**
 * Processes messages from the Stockfish queue sequentially.
 * Retrieves messages from the queue and handles them based on their content.
 */
function processStockfishQueue() {
    // Only process if not already processing a message AND there are messages in the queue
    if (isProcessingStockfishMessage || stockfishMessageQueue.length === 0) {
        return;
    }

    isProcessingStockfishMessage = true; // Set processing flag to true
    const data = stockfishMessageQueue.shift(); // Get the next message from the front of the queue

    try {
        // Process the message based on its starting content
        if (data === "uciok") {
            console.log("Stockfish inicializado (uciok).");
        } else if (data === "readyok") {
            console.log("Stockfish pronto (readyok).");
        } else if (data.startsWith("info")) {
            // 'info' messages contain various information, including evaluation and principal variation
            if (data.includes("score cp") || data.includes("score mate")) {
                handleScoreInfo(data); // Process score information
            }
            if (data.includes(" pv ")) {
                handlePvInfo(data); // Process principal variation (PV) information (used for suggestions)
            }
        } else if (data.startsWith("bestmove")) {
            // The 'bestmove' message indicates the move calculated by Stockfish
            handleBestMove(data); // Process the best move
        }
    } catch (error) {
        // Log any errors that occur during message processing
        console.error("Erro processando mensagem do Stockfish:", error, "Mensagem:", data);
    } finally {
        isProcessingStockfishMessage = false; // Reset processing flag
        processStockfishQueue(); // Attempt to process the next message in the queue
    }
}

/**
 * Extracts and updates the evaluation score from Stockfish 'info' messages.
 * Updates the local `latestScore` and triggers UI updates if the current task is 'evaluate'.
 * @param {string} data - The 'info' message string from Stockfish.
 */
function handleScoreInfo(data) {
    const jogo = getJogoInstance(); // Get the current game instance
    const gameState = getGameState(); // Get the current game state

    // Only update score if the current task is IA play or evaluation
    if (currentStockfishTask === 'ia_play' || currentStockfishTask === 'evaluate') {
        const scoreMatch = data.match(/score cp (-?\d+)/); // Match centipawn score (cp)
        const mateMatch = data.match(/score mate (-?\d+)/); // Match mate score

        if (scoreMatch) {
            const valor = parseInt(scoreMatch[1]); // Extract centipawn value
            // Adjust score based on whose turn it is (from AI's perspective vs user's perspective)
            // If it's the user's turn, the score is from Stockfish's perspective (positive is good for Stockfish's side)
            // If it's IA's turn, the score is also from Stockfish's perspective.
            // We want the score relative to the *current* player's turn in the UI.
            // Let's keep it simple: score is from the perspective of the side whose turn it is.
            latestScore = jogo.turn() === 'w' ? valor : -valor;


            if (currentStockfishTask === 'evaluate') {
                setScoreAtual(latestScore); // Update the score in game-state
                mostrarEmojiAvaliacao(latestScore); // Update UI with emoji based on the latest score
                atualizarAvaliacao(); // Update UI with text evaluation
            }
        } else if (mateMatch) {
            const mateValor = parseInt(mateMatch[1]); // Extract mate value
            // Represent mate score with a large absolute value (10000) for sorting/comparison
            // The sign indicates which side is mating.
            latestScore = (jogo.turn() === 'w' ? mateValor : -mateValor) > 0 ? 10000 : -10000;


            if (currentStockfishTask === 'evaluate') {
                 setScoreAtual(latestScore); // Update the score in game-state
                mostrarEmojiAvaliacao(latestScore); // Update UI with emoji
                atualizarAvaliacao(); // Update UI with text evaluation
            }
        }
    }

    // Collect potential 'bad' moves during IA play calculation (for error simulation)
    // This info is typically included in 'info' lines that also contain 'pv'
    if (currentStockfishTask === 'ia_play' && (data.includes("score cp") || data.includes("score mate")) && data.includes(" pv ")) {
        const pvMatch = data.match(/ pv ([a-h][1-8][a-h][1-8])/); // Match the move string in the PV (e.g., 'e2e4')
        if (pvMatch) {
            const movimento = pvMatch[1];
            const scoreMatch = data.match(/score cp (-?\d+)/);
            const mateMatch = data.match(/score mate (-?\d+)/);
            let score = 0;
            if (scoreMatch) score = parseInt(scoreMatch[1]);
            else if (mateMatch) score = (parseInt(mateMatch[1]) > 0 ? 10000 : -10000);

            const scoreParaTurnoAtual = score; // Score from Stockfish's perspective for the current turn
            // Add the move and its score to the pioresJogadas list if not already present
            if (!pioresJogadas.some(j => j.movimento === movimento)) {
                pioresJogadas.push({ movimento, score: scoreParaTurnoAtual });
            }
        }
    }
}

/**
 * Extracts and stores principal variation (pv) moves from Stockfish 'info' messages.
 * These moves represent the lines of play Stockfish is considering.
 * Used for generating move suggestions for the user.
 * @param {string} data - The 'info' message string from Stockfish.
 */
function handlePvInfo(data) {
    // Only collect suggestions if the current task is 'suggestions'
    if (currentStockfishTask === 'suggestions') {
        const pvMatch = data.match(/ pv ([a-h][1-8][a-h][1-8])/); // Match the first move string in the PV
        if (pvMatch && pvMatch[1]) {
            const movimento = pvMatch[1];
            // Add the move to the suggestions list if it's not already included
            if (!sugestoesIA.includes(movimento)) {
                sugestoesIA.push(movimento);
            }
        }
    }
}

/**
 * Handles the 'bestmove' message from Stockfish.
 * This message signals that Stockfish has finished thinking and determined its best move.
 * Executes the move on the board if the current task was 'ia_play'.
 * @param {string} data - The 'bestmove' message string from Stockfish.
 */
function handleBestMove(data) {
    stockfishOcupado = false; // Stockfish is no longer busy after sending bestmove
    const [_, movimentoCompleto] = data.split(" "); // Extract the move string (e.g., 'e2e4', 'a7a8q')

    // Check if a valid move string was received from Stockfish
    if (!movimentoCompleto || movimentoCompleto === "(none)") {
        console.error("handleBestMove(): Nenhuma jogada válida recebida do Stockfish.", data);
        mostrarMensagemTemporaria("Erro: Stockfish não retornou uma jogada válida.");
        currentStockfishTask = null; // Reset the current task
        return;
    }

    // Handle the move based on the current task that was requested from Stockfish
    if (currentStockfishTask === 'ia_play') {
        currentStockfishTask = null; // The 'ia_play' task is now completed

        let jogadaEscolhida = movimentoCompleto; // Start with Stockfish's calculated best move
        // Extract components of the best move (origin, destination, potential promotion)
        const [bestFrom, bestTo, bestPromotion] = [movimentoCompleto.slice(0, 2), movimentoCompleto.slice(2, 4), movimentoCompleto.slice(4)];

        // Implement AI error simulation based on the current level setting
        const [profundidadeStr, chanceDeErroStr] = currentLevel.split("-");
        const chanceDeErro = parseInt(chanceDeErroStr); // Get the error chance percentage from the level string
        const chance = Math.random() * 100; // Generate a random number between 0 and 100

        // Sort 'bad' moves collected during calculation by score (ascending). Lower score means worse move.
        pioresJogadas.sort((a, b) => a.score - b.score);
        // Get a few of the worst moves from the sorted list, excluding Stockfish's best move
        const pioresN = pioresJogadas.filter(j => j.movimento !== movimentoCompleto).slice(0, Math.min(5, pioresJogadas.length));

        // If the random chance is less than the configured error chance AND there are 'bad' moves available
        if (chance < chanceDeErro && pioresN.length > 0) {
            // Select a random 'bad' move from the list of worst moves
            const piorJogadaSelecionada = pioresN[Math.floor(Math.random() * pioresN.length)].movimento;
            jogadaEscolhida = piorJogadaSelecionada; // The IA will play this non-optimal move
            console.log(`handleBestMove(): IA (chance de erro ${chanceDeErro}%) escolheu uma jogada não ótima: ${jogadaEscolhida}`);

            // Optionally update the score to reflect the chosen bad move's score.
            // This makes the evaluation display more consistent with the actual move played.
            const piorJogadaInfo = pioresJogadas.find(j => j.movimento === jogadaEscolhida);
            if (piorJogadaInfo) {
                 setScoreAtual(piorJogadaInfo.score); // Set score to the score of the chosen bad move
            } else {
                 setScoreAtual(0); // Or reset score if info not found (shouldn't happen if from pioresN)
            }
        } else {
            console.log(`handleBestMove(): IA (chance de erro ${chanceDeErro}%) escolheu a melhor jogada: ${jogadaEscolhida}`);
            // The scoreAtual was already updated in handleScoreInfo with the best move's score.
            // We might want to keep that score for display or reset it after the move.
            // Let's reset the score after the move is made, as the evaluation now applies to the *next* position.
             setScoreAtual(0); // Reset score after move is made
        }

        // Extract from, to, and potential promotion from the chosen move string
        const [finalFrom, finalTo, finalPromotion] = [jogadaEscolhida.slice(0, 2), jogadaEscolhida.slice(2, 4), jogadaEscolhida.slice(4)];
        const jogo = getJogoInstance(); // Get the current game instance
        const piece = jogo.get(finalFrom);
        // Determine promotion piece if applicable. Default to 'q' if Stockfish didn't specify and it's a pawn reaching the end rank.
        let promotionToUse = finalPromotion || (piece && piece.type === 'p' && (finalTo[1] === '8' || finalTo[1] === '1') ? 'q' : undefined);

        // Attempt to make the move on the Chess.js instance using the chosen move
        const jogadaRealizada = jogo.move({ from: finalFrom, to: finalTo, promotion: promotionToUse });

if (jogadaRealizada) {
    console.log(`handleBestMove(): Jogada executada pela IA: ${jogadaRealizada.from}${jogadaRealizada.to}${jogadaRealizada.promotion ? jogadaRealizada.promotion : ''}`);

    // --- Início da Transação Única ---
    
    // 1. Obter o estado UMA VEZ
    let gameState = getGameState(); 

    // 2. Atualizar Peças Capturadas (se houver)
    if (jogadaRealizada.captured) {
        console.log("handleBestMove() - Piece captured by IA:", jogadaRealizada.captured, "by color:", jogadaRealizada.color);
        const capturerColor = jogadaRealizada.color; 
        const capturedPieceType = jogadaRealizada.captured;
        const capturedPieceColor = capturerColor === 'w' ? 'b' : 'w'; 

        if (!gameState.capturedPieces[capturedPieceColor][capturedPieceType]) {
            gameState.capturedPieces[capturedPieceColor][capturedPieceType] = 0;
        }
        // Modifica o objeto gameState local
        gameState.capturedPieces[capturedPieceColor][capturedPieceType]++; 
        console.log("handleBestMove() - capturedPieces after IA update:", JSON.parse(JSON.stringify(gameState.capturedPieces)));
        
        // REMOVIDO: setGameState(gameState); <- ESTA LINHA CAUSAVA O BUG
    }

    // 3. Atualizar Estado da Jogada da IA e Histórico (no mesmo objeto gameState)
    gameState.origemCasaIA = jogadaRealizada.from;
    gameState.ultimaCasaIA = jogadaRealizada.to;
    gameState.sugestoesIA = []; 
    pioresJogadas = []; // (pioresJogadas é local do stockfish-manager, correto)
    gameState.avaliacaoEmoji = null; // (Assumindo que avaliacaoEmoji está no gameState, se não, ajuste)

    gameState.historicoJogadas = gameState.historicoJogadas.slice(0, gameState.indiceAtual);
    gameState.historicoJogadas.push({ 
        fen: jogo.fen(), 
        score: gameState.scoreAtual, 
        // Salva o estado de captura JÁ MODIFICADO
        captured: JSON.parse(JSON.stringify(gameState.capturedPieces)) 
    });
    gameState.indiceAtual = gameState.historicoJogadas.length; 

    // 4. Salvar o estado UMA VEZ no final
    setGameState(gameState); 
    // --- Fim da Transação Única ---

    // 5. Lógica de Fim de Jogo (executa após o estado ser salvo)
    if (jogo.game_over()) {
        console.log("handleBestMove(): Jogo terminou após jogada da IA.");
        gameState.partidaIniciada = false;
        setGameState(gameState); // Salva a atualização de partidaIniciada
        atualizarEstadoJogo(); 
        if (jogo.in_checkmate()) {
            const vencedor = gameState.corUsuario === 'w' ? gameState.nomeJogador2 || "IA" : gameState.nomeJogador1 || "Você";
            console.log("handleBestMove(): Xeque-mate detectado. Vencedor:", vencedor);
            alert(`Xeque-mate! ${vencedor} venceu!`);
        } else if (jogo.in_draw()) {
            // ... (lógica de empate) ...
            alert(motivoEmpate);
        }

    } else {
        // Se o jogo não acabou, atualiza a UI e avalia a próxima jogada
        atualizarInfo();
        avaliarJogadaAtual();
    }

} else {
    // Se a jogadaRealizada falhou (não deve acontecer com a IA)
    console.error(`handleBestMove(): Jogada inválida tentada pela IA (${jogadaEscolhida}). FEN: ${jogo.fen()}`);
    mostrarMensagemTemporaria("Erro interno da IA. Tente reiniciar.");
}
    } else if (currentStockfishTask === 'suggestions') {
        // If the task was suggestions, the bestmove is just a final message.
        // The suggestions were collected from 'info pv' messages.
        currentStockfishTask = null; // Task completed
        console.log("handleBestMove(): Bestmove recebido durante cálculo de sugestões. Sugestões coletadas:", sugestoesIA);
        updateUISuggestions(sugestoesIA); // Update the suggestions display in the UI
        if (sugestoesIA.length === 0) {
            mostrarMensagemTemporaria("Nenhuma sugestão recebida. Tente novamente.");
        }
    } else if (currentStockfishTask === 'evaluate') {
        // If the task was evaluation, the bestmove is a byproduct.
        // The score was updated in handleScoreInfo.
        currentStockfishTask = null; // Task completed
        console.log("handleBestMove(): Bestmove recebido durante cálculo de avaliação.");
    } else {
        // Handle unexpected bestmove messages (e.g., if a new task was started before bestmove arrived)
        console.log("handleBestMove(): Bestmove recebido sem tarefa ativa conhecida. Ignorando.", data);
    }
}

/**
 * Requests Stockfish to evaluate the current position.
 * Sends the current FEN to Stockfish and requests analysis up to a certain depth.
 */
export function avaliarJogadaAtual() {
    // Only proceed if Stockfish is not busy and is initialized
    if (stockfishOcupado || !stockfish) {
        console.log("Stockfish ocupado ou não inicializado. Avaliação adiada.");
        return;
    }
    stockfishOcupado = true; // Set Stockfish as busy
    currentStockfishTask = 'evaluate'; // Set the current task to evaluation

    const jogo = getJogoInstance(); // Get the current game instance
    stockfish.postMessage("position fen " + jogo.fen()); // Set the current position using FEN
    stockfish.postMessage("go depth 12"); // Request evaluation up to depth 12 (can be adjusted for performance/accuracy)
}

/**
 * Requests Stockfish to calculate and play the best move for the current turn.
 * Sends the current FEN to Stockfish and requests the best move up to the specified depth.
 */
export function jogadaIA() {
    // Only proceed if Stockfish is not busy and is initialized
    if (stockfishOcupado || !stockfish) {
        console.log("Stockfish ocupado ou não inicializado. Jogada adiada.");
        return;
    }
    stockfishOcupado = true; // Set Stockfish as busy
    currentStockfishTask = 'ia_play'; // Set the current task to IA play

    const [profundidade] = currentLevel.split("-"); // Get the depth setting from the current level string
    const jogo = getJogoInstance(); // Get the current game instance
    stockfish.postMessage("position fen " + jogo.fen()); // Set the current position
    stockfish.postMessage(`go depth ${profundidade}`); // Request the best move up to the specified depth
}

/**
 * Requests Stockfish to suggest moves for the current position.
 * Requests analysis for a short time to get a few top moves (principal variations).
 */
export function sugerirJogadas() {
    // Only proceed if Stockfish is not busy and is initialized
    if (stockfishOcupado || !stockfish) {
        mostrarMensagemTemporaria("IA ocupada ou não inicializada. Tente novamente.", 3000);
        return;
    }
    stockfishOcupado = true; // Set Stockfish as busy
    currentStockfishTask = 'suggestions'; // Set the current task to suggestions
    sugestoesIA = []; // Clear the previous suggestions list

    const jogo = getJogoInstance(); // Get the current game instance
    stockfish.postMessage("position fen " + jogo.fen()); // Set the current position
    // Request analysis for a short time (e.g., 1 second) to get quick suggestions
    stockfish.postMessage("go depth 12 movetime 1000"); // Depth 12 is a fallback if movetime is ignored or not supported
}

/**
 * Sets the current AI level.
 * Called by config-setup.js when the user changes the level selection.
 * @param {string} level - The AI level string (e.g., '8-0').
 */
export function setCurrentLevel(level) {
    currentLevel = level;
    console.log("Nível da IA definido para:", currentLevel);
}

/**
 * Gets the current AI level string.
 * @returns {string} The current AI level string.
 */
export function getCurrentLevel() {
    return currentLevel;
}

/**
 * Gets the display name for a given AI level string.
 * Used by ui.js to display the level name.
 * @param {string} level - The AI level string.
 * @returns {string} The display name (e.g., "Médio").
 */
export function getLevelName(level) {
    // Access levelNames directly
    return levelNames[level] || "IA"; // Return the mapped name or "IA" as a fallback
}

// Removed getLevelAvatar and getAvatarName functions

/**
 * Gets the current evaluation score.
 * Used by ui.js to display the score.
 * @returns {number} The current score in centipawns or mate value.
 */
export function getCurrentScore() {
    // Return the score stored in game-state.js
    const gameState = getGameState(); // Get the current game state
    return gameState.scoreAtual;
}

/**
 * Gets the current evaluation emoji.
 * Used by ui.js to display the emoji.
 * @returns {string|null} The emoji string or null.
 */
export function getAvaliacaoEmoji() {
    return avaliacaoEmoji; // This emoji state is managed locally in stockfish-manager
}

/**
 * Sets the evaluation emoji timeout ID.
 * Used by ui.js when setting the timeout to hide the emoji.
 * @param {number} timeoutId - The ID of the timeout returned by setTimeout.
 */
export function setAvaliacaoTimeout(timeoutId) {
    timeoutAvaliacao = timeoutId;
}

/**
 * Clears the evaluation emoji timeout.
 * Used by ui.js to cancel the timeout (e.g., when a new move is made).
 */
export function clearAvaliacaoTimeout() {
    if (timeoutAvaliacao) {
        clearTimeout(timeoutAvaliacao);
        timeoutAvaliacao = null;
    }
}

/**
 * Gets the list of AI suggestions.
 * Used by ui.js to display the suggestions.
 * @returns {string[]} An array of move strings (e.g., ['e2e4', 'd7d4']).
 */
export function getSugestoesIA() {
    return sugestoesIA; // Return the array of collected suggestions
}

// Note: Stockfish should be initialized when the game starts in config-setup.js
