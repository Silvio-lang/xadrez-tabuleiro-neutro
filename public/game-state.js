/* game-state.js */
// Manages the central game state, including the Chess.js instance and game history.

// Import necessary functions from ui.js and stockfish-manager.js
import { criarTabuleiro, atualizarInfo, atualizarEstadoJogo, mostrarMensagemTemporaria, setCasaSelecionada, atualizarAvaliacao, mostrarCor } from './ui.js';
import { jogadaIA, avaliarJogadaAtual } from './stockfish-manager.js';

// Game state variables
let jogo = new window.Chess(); // Initialize Chess.js instance
let historicoJogadas = []; // Array to store game history
let indiceAtual = 0; // Current index in the history array
let corUsuario = 'w'; // User's chosen color
let modoJogo = "humano-ia"; // Game mode
let nomeJogador1 = ""; // Name for player 1
let nomeJogador2 = ""; // Name for player 2
let partidaIniciada = false; // Flag indicating if a game is currently in progress

// Variables to track last moves for UI highlighting
let ultimaCasaIA = null;
let origemCasaIA = null;
let ultimaCasaHumano = null;

// Evaluation score
let scoreAtual = 0;

// Captured pieces state
let capturedPieces = {
    w: {},
    b: {}
};

/**
 * Trigger the AI move manually.
 * This is called by the "Jogue" button in UI.js.
 */
export function fazerJogadaIA() {
    const gameState = getGameState();
    // Verifica se é modo IA, se o jogo não acabou e se é a vez da IA
    if (gameState.modoJogo === "humano-ia" && !jogo.game_over() && jogo.turn() !== gameState.corUsuario) {
         mostrarMensagemTemporaria(`IA (${mostrarCor(jogo.turn())}) a jogar...`, 2000);
         setTimeout(jogadaIA, 500); // Dispara a IA
    }
}

/**
 * Initializes a new game with the specified configuration.
 */
export function iniciarNovoJogo(modo, cor, nome1, nome2) {
    console.log(`iniciarNovoJogo() chamado. Modo: ${modo}, Cor: ${cor}`);
    
    try {
        jogo = new window.Chess();
    } catch (e) {
        console.error("iniciarNovoJogo(): Falha ao criar nova instância de Chess.js:", e);
        mostrarMensagemTemporaria("Erro interno ao iniciar jogo.");
        return;
    }

    // Reset game state variables
    historicoJogadas = [];
    indiceAtual = 0;
    corUsuario = cor;
    modoJogo = modo;
    nomeJogador1 = nome1 || "Jogador 1";
    nomeJogador2 = nome2 || "Jogador 2";
    partidaIniciada = true;
    ultimaCasaIA = null;
    origemCasaIA = null;
    ultimaCasaHumano = null;
    scoreAtual = 0;
    capturedPieces = { w: {}, b: {} };

    // Add the initial position to history
    historicoJogadas.push({ fen: jogo.fen(), score: scoreAtual, captured: JSON.parse(JSON.stringify(capturedPieces)) });
    indiceAtual = 1;

    // Update UI elements
    criarTabuleiro();
    atualizarInfo();
    atualizarEstadoJogo();
    atualizarAvaliacao();

    // If in Human vs IA mode and IA plays first (user chose black)
    if (modo === "humano-ia" && jogo.turn() !== corUsuario) {
        mostrarMensagemTemporaria(`IA (${mostrarCor(jogo.turn())}) a jogar...`, 2000);
        setTimeout(jogadaIA, 500);
    } else if (modo === "humano-humano") {
         mostrarMensagemTemporaria(`Partida Humano vs Humano iniciada.`, 3000);
    } else {
         mostrarMensagemTemporaria(`Partida Humano vs IA iniciada.`, 3000);
    }
}

/**
 * Attempts to move a piece from a source square to a target square.
 */
/**
 * Attempts to move a piece from a source square to a target square.
 */
export function moverPeca(source, target, promotion = 'q') {
    
    const jogo = getJogoInstance();
    let gameState = getGameState();

    // TRAVA DE SEGURANÇA REDE/LOCAL: 
    // Impede mover se o jogo não iniciou, acabou, ou se a peça/turno não pertence ao usuário ativo
    if (!gameState.partidaIniciada || jogo.game_over() || jogo.turn() !== gameState.corUsuario) {
        console.log("moverPeca(): Movimento não permitido. Não é seu turno ou suas peças.");
        setCasaSelecionada(null); 
        criarTabuleiro(); 
        return;
    }

    // Tenta fazer a jogada
    const jogada = jogo.move({
        from: source,
        to: target,
        promotion: promotion 
    });

    // Se a jogada foi válida...
    if (jogada) {
        console.log(`moverPeca(): Jogada válida feita: ${jogada.from}${jogada.to}`);

        // Atualizar Capturas
        if (jogada.captured) {
            const capturerColor = jogada.color; 
            const capturedPieceType = jogada.captured;
            const capturedPieceColor = capturerColor === 'w' ? 'b' : 'w'; 

            if (!gameState.capturedPieces[capturedPieceColor][capturedPieceType]) {
                gameState.capturedPieces[capturedPieceColor][capturedPieceType] = 0;
            }
            gameState.capturedPieces[capturedPieceColor][capturedPieceType]++;
        }

        // Atualizar Estado da Jogada Humana e Histórico
        gameState.ultimaCasaHumano = jogada.to; 
        
        // --- Atualizar Histórico (Limpar futuro e adicionar posição atual) ---
        gameState.historicoJogadas = gameState.historicoJogadas.slice(0, gameState.indiceAtual);
        gameState.historicoJogadas.push({ 
            fen: jogo.fen(), 
            score: gameState.scoreAtual, 
            captured: JSON.parse(JSON.stringify(gameState.capturedPieces)) 
        });
        gameState.indiceAtual = gameState.historicoJogadas.length; 

        // Atualiza UI
        criarTabuleiro(); 
        atualizarInfo();
        atualizarEstadoJogo(); 
        atualizarAvaliacao();

        // Lógica Pós-Movimento
        if (jogo.game_over()) {
            gameState.partidaIniciada = false;
            setGameState(gameState);
            atualizarEstadoJogo(); 
        } else {
            atualizarInfo();
            avaliarJogadaAtual(); 
        }

    } else {
        // Se a jogada foi inválida
        mostrarMensagemTemporaria("Jogada inválida!", 2000); 
        setCasaSelecionada(null); 
        criarTabuleiro(); 
    }
}

/**
 * Função utilitária para carregar uma posição do histórico
 * @param {object} position - O objeto de estado {fen, score, captured}
 */
function carregarPosicaoHistorico(position) {
    const loadResult = jogo.load(position.fen);
    if (loadResult === false) {
        console.error("Carregamento de FEN inválido no histórico:", position.fen);
        mostrarMensagemTemporaria("Erro: Histórico de jogo corrompido.", 5000);
        return false;
    }

    // 1. Criar um novo objeto de estado com base no estado atual
    let newState = getGameState();

    // 2. Aplicar as propriedades históricas
    newState.scoreAtual = position.score || 0;
    newState.capturedPieces = JSON.parse(JSON.stringify(position.captured || { w: {}, b: {} }));
    
    // 3. Manter o índice de histórico atualizado
    newState.indiceAtual = indiceAtual; 

    // 4. Limpar indicadores visuais específicos de UI para navegação
    newState.ultimaCasaIA = null;
    newState.origemCasaIA = null;
    newState.ultimaCasaHumano = null;
    newState.casaSelecionada = null;
    setCasaSelecionada(null); // Limpa o estado de seleção global

    // 5. Atualizar o estado global (sem recarregar o FEN, que já foi carregado acima)
    setGameState(newState, true);
    
    return true;
}


/**
 * Navigates back one move in the game history.
 */
export function voltarJogada() {
    const gameState = getGameState();

    if (gameState.indiceAtual > 1) {
        console.log("voltando jogada...");
        indiceAtual--; // Decrementa a variável global diretamente
        const previousPosition = historicoJogadas[indiceAtual - 1];

        if (carregarPosicaoHistorico(previousPosition)) {
             mostrarMensagemTemporaria(`Voltando para a jogada ${Math.floor((indiceAtual - 1) / 2)}.`, 1500);
        } else {
            // Reverter o índice se o carregamento falhar
            indiceAtual++;
        }

    } else {
        console.log("voltando jogada: Já na primeira jogada.");
        mostrarMensagemTemporaria("Já na primeira jogada.", 1500);
    }
}

/**
 * Navigates forward one move in the game history.
 */
export function avancarJogada() {
    const gameState = getGameState();

    if (indiceAtual < historicoJogadas.length) { // Usa a variável global diretamente
        console.log("avancando jogada...");
        indiceAtual++; // Incrementa a variável global diretamente
        const nextPosition = historicoJogadas[indiceAtual - 1];

        if (carregarPosicaoHistorico(nextPosition)) {
            mostrarMensagemTemporaria(`Avançando para a jogada ${Math.floor((indiceAtual - 1) / 2)}.`, 1500);
        } else {
            // Reverter o índice se o carregamento falhar
            indiceAtual--;
        }

    } else {
        console.log("avancando jogada: Já na última jogada.");
        mostrarMensagemTemporaria("Já na última jogada.", 1500);
    }
}

/**
 * Resumes the game from the current position in the history.
 */
export function continuarAPartirDaqui() {
    const gameState = getGameState();
    const jogo = getJogoInstance();

    if (gameState.partidaIniciada && indiceAtual < historicoJogadas.length) { // Usa a variável global diretamente
        // Altera as variáveis globais diretamente antes de chamar setGameState
        historicoJogadas = historicoJogadas.slice(0, indiceAtual);
        indiceAtual = historicoJogadas.length;

        ultimaCasaIA = null;
        origemCasaIA = null;
        ultimaCasaHumano = null;

        // setGameState carrega as variáveis globais do objeto state.
        // Como alteramos as globais (historicoJogadas, indiceAtual), vamos obter o novo estado 
        // para persistir a limpeza dos indicadores e o novo histórico.
        const newState = getGameState();
        setGameState(newState);
        mostrarMensagemTemporaria("Continuando a partir desta posição.", 2000);

        // Se ao retomar for a vez da IA, deixamos ela jogar (comportamento padrão de retomada)
        if (gameState.modoJogo === "humano-ia" && jogo.turn() !== gameState.corUsuario && !jogo.game_over()) {
             mostrarMensagemTemporaria(`IA (${mostrarCor(jogo.turn())}) a jogar...`, 2000);
             setTimeout(jogadaIA, 500);
        }

    } else if (!gameState.partidaIniciada) {
         mostrarMensagemTemporaria("Nenhuma partida iniciada.", 2000);
    }
    else {
         mostrarMensagemTemporaria("Já na última jogada.", 2000);
    }
}


/**
 * Gets the current game state object.
 */
export function getGameState() {
    return {
        jogo: jogo.fen(),
        historicoJogadas: historicoJogadas,
        indiceAtual: indiceAtual,
        corUsuario: corUsuario,
        modoJogo: modoJogo,
        nomeJogador1: nomeJogador1,
        nomeJogador2: nomeJogador2,
        partidaIniciada: partidaIniciada,
        ultimaCasaIA: ultimaCasaIA,
        origemCasaIA: origemCasaIA,
        ultimaCasaHumano: ultimaCasaHumano,
        scoreAtual: scoreAtual,
        capturedPieces: JSON.parse(JSON.stringify(capturedPieces))
    };
}

/**
 * Sets the entire game state from a provided state object.
 * @param {object} state - The state object to load.
 * @param {boolean} [skipFenLoad=false] - Se verdadeiro, ignora o carregamento do FEN de state.jogo.
 */
export function setGameState(state, skipFenLoad = false) {
    console.log("setGameState() called with state:", state, "skipFenLoad:", skipFenLoad);

    if (!jogo) {
        try {
            jogo = new window.Chess(); 
        } catch (e) {
            mostrarMensagemTemporaria("Erro interno: Não foi possível inicializar o tabuleiro.", 5000);
            return;
        }
    }

    // --- CRÍTICO: Só carrega FEN se skipFenLoad for falso ---
    if (!skipFenLoad && state && typeof state.jogo === 'string' && state.jogo !== '') {
        const loadResult = jogo.load(state.jogo);
        if (loadResult === false) {
             mostrarMensagemTemporaria("Erro: Posição de jogo inválida.", 5000);
        }
    }
    // --- FIM DA CORREÇÃO ---


    // Atualiza as variáveis globais de estado do módulo
    historicoJogadas = Array.isArray(state.historicoJogadas) ? state.historicoJogadas : [];
    indiceAtual = typeof state.indiceAtual === 'number' ? state.indiceAtual : 0;
    corUsuario = typeof state.corUsuario === 'string' ? state.corUsuario : 'w';
    modoJogo = typeof state.modoJogo === 'string' ? state.modoJogo : "humano-ia";
    nomeJogador1 = typeof state.nomeJogador1 === 'string' ? state.nomeJogador1 : "";
    nomeJogador2 = typeof state.nomeJogador2 === 'string' ? state.nomeJogador2 : "";
    partidaIniciada = typeof state.partidaIniciada === 'boolean' ? state.partidaIniciada : false;
    
    // As variáveis de UI (última casa) devem ser atualizadas aqui
    ultimaCasaIA = typeof state.ultimaCasaIA === 'string' || state.ultimaCasaIA === null ? state.ultimaCasaIA : null;
    origemCasaIA = typeof state.origemCasaIA === 'string' || state.origemCasaIA === null ? state.origemCasaIA : null;
    ultimaCasaHumano = typeof state.ultimaCasaHumano === 'string' || state.ultimaCasaHumano === null ? state.ultimaCasaHumano : null;
    
    scoreAtual = typeof state.scoreAtual === 'number' ? state.scoreAtual : 0;
    
    capturedPieces = (state.capturedPieces && typeof state.capturedPieces === 'object' && state.capturedPieces !== null)
        ? JSON.parse(JSON.stringify(state.capturedPieces))
        : { w: {}, b: {} };

    // Update UI
    if (jogo) {
        criarTabuleiro();
        atualizarInfo(); 
        atualizarEstadoJogo(); 
        atualizarAvaliacao(); 
    }
}

/**
 * Gets the current Chess.js instance.
 */
export function getJogoInstance() {
    return jogo;
}

/**
 * Sets the current evaluation score.
 */
export function setScoreAtual(score) {
    scoreAtual = score;
}

/**
 * Gets the current captured pieces state.
 */
export function getCapturedPieces() {
    return capturedPieces;
}