/* pos_salvas.js */
// Gerencia a lista de problemas e posições salvas, persistindo no localStorage.

const problemasPadrao = [
    { nome: "Mate em 1 - Torre", fen: "5k2/5pp1/5P1P/8/8/8/8/5R1K w - - 0 1", solucao: "Rf1-f8#" },
    { nome: "Mate em 1 - Rainha", fen: "8/8/8/8/8/6k1/6P1/6QK w - - 0 1", solucao: "Qh1-h8#" },
    { nome: "Mate em 2 - Torre e Rei", fen: "8/8/8/8/8/8/5R2/5K1k w - - 0 1", solucao: "Qh1-h8#" },
    { nome: "Mate em 3 - Dama e Rei", fen: "8/8/8/8/8/6Qk/8/6K1 w - - 0 1", solucao: "Qh1-h8#" },
    { nome: "Mate em 2 - Bispo e C", fen: "8/8/8/8/8/8/5BN1/5K1k w - - 0 1", solucao: "Qh1-h8#" },
    { nome: "Tática - Mate em 2 com Sacrifício", fen: "rnbqkb1r/pppp1ppp/5n2/5Q2/8/8/PPPPPPPP/RNB1KBNR w KQkq - 1 2", solucao: "Qh1-h8#" },
    { nome: "Mate em 3 - Ataque com Peças Maiores", fen: "8/8/8/8/8/5p2/5Q1p/5R1K w - - 0 1", solucao: "Qh1-h8#" },
    { nome: "Final de Peões - Posição Crítica", fen: "8/8/8/8/8/6p1/6Pp/6K1 w - - 0 1", solucao: "Qh1-h8#" },
    { nome: "Mate em 2 - Corredor de Mate", fen: "8/8/8/8/8/8/5RR1/5K1k w - - 0 1", solucao: "Qh1-h8#" },
    { nome: "Tática - Descoberto com Mate", fen: "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 1 2", solucao: "Qh1-h8#" },
    { nome: "Mate em 3 - Dama e Cavalo", fen: "8/8/8/8/8/5N2/5Q1p/5K1k w - - 0 1", solucao: "Qh1-h8#" },
    { nome: "Tática - Mate em 2 com Peão", fen: "8/8/8/8/8/5p2/5Pp1/5K1k w - - 0 1", solucao: "Qh1-h8#" },
];

// Chave utilizada no localStorage (alterada para v2 para forçar limpeza de dados antigos incorretos)
const STORAGE_KEY = "problemasXadrez_v2";

function obterProblemas() {
    console.log("Obtendo problemas do localStorage...");
    let problemasSalvos = localStorage.getItem(STORAGE_KEY);
    
    if (problemasSalvos) {
        try {
            return JSON.parse(problemasSalvos);
        } catch (e) {
            console.error("Erro ao parsear problemas do localStorage:", e);
            localStorage.removeItem(STORAGE_KEY);
        }
    }
    
    // Verificar se window.Chess está disponível
    if (typeof window.Chess !== "function") {
        console.error("Erro: window.Chess não está disponível. Certifique-se de que chess.js foi carregado.");
        if (typeof window.mostrarMensagemTemporaria === "function") {
             window.mostrarMensagemTemporaria("Erro: Biblioteca de xadrez não carregada corretamente.", 5000);
        }
        return [];
    }
    
    let problemas = problemasPadrao.map(p => {
        // Tenta criar instância do Chess para validar FEN e pegar o turno
        let turnoTexto = '?';
        try {
            // Nota: window.Chess deve estar disponível se o script chess.js foi carregado.
            const chess = new window.Chess(p.fen);
            turnoTexto = chess.turn() === 'w' ? 'Brancas' : 'Pretas';
        } catch (err) {
            console.error(`Erro ao processar FEN para ${p.nome}:`, err);
        }

        return {
            nome: p.nome,
            fen: p.fen,
            solucao: p.solucao,
            turno: turnoTexto
        };
    });
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(problemas));
    return problemas;
}

export function atualizarListaProblemas() {
    console.log("Atualizando lista de problemas na interface...");
    const lista = document.getElementById("lista-problemas");
    if (!lista) {
        console.error("Elemento #lista-problemas não encontrado.");
        return;
    }
    
    lista.innerHTML = "";
    const problemas = obterProblemas();
    
    // Verificar se houve erro ao obter problemas
    if (!problemas || problemas.length === 0) {
        lista.innerHTML = "<li>Nenhum problema disponível ou erro ao carregar.</li>";
        return;
    }
    
    problemas.forEach((problema, index) => {
        const li = document.createElement("li");
        li.style.marginBottom = "10px";
        li.style.display = "flex";
        li.style.alignItems = "center";
        li.style.justifyContent = "space-between";
        li.style.padding = "5px";
        li.style.borderBottom = "1px solid #eee";
        
        const nomeSpan = document.createElement("span");
        const nomeExibicao = problema.nome || "Problema sem nome";
        nomeSpan.textContent = `${nomeExibicao} (${problema.turno})`;
        nomeSpan.style.flexGrow = "1";
        
        const controlsDiv = document.createElement("div");

        const carregarBtn = document.createElement("button");
        carregarBtn.textContent = "Carregar";
        carregarBtn.onclick = () => carregarProblema(problema.fen);
        carregarBtn.style.marginRight = "5px";
        
        const removerBtn = document.createElement("button");
        removerBtn.textContent = "Remover";
        removerBtn.style.backgroundColor = "#ffcccc";
        removerBtn.onclick = () => removerProblema(index);
        
        controlsDiv.appendChild(carregarBtn);
        controlsDiv.appendChild(removerBtn);
        
        li.appendChild(nomeSpan);
        li.appendChild(controlsDiv);
        lista.appendChild(li);
    });
}

export function carregarProblema(fen) {
    // RESOLUÇÃO DO ERRO: Tenta chamar a função global de carregamento do ui.js
    if (typeof window.carregarEstadoDeJogo === 'function') {
        window.carregarEstadoDeJogo(fen);
    } else {
        console.error("Erro crítico: Função window.carregarEstadoDeJogo não encontrada no ui.js");
        if (typeof window.mostrarMensagemTemporaria === 'function') {
            window.mostrarMensagemTemporaria("Erro interno: Falha na comunicação (ui.js não pronto).");
        }
    }
}

export function salvarPosicaoAtual() {
    // ATUALIZADO: Usa a função oficial de obter instância exposta pelo ui.js
    let jogoInstancia = null;

    // Tenta obter a instância de jogo do módulo principal
    if (typeof window.getJogoInstance === 'function') {
        jogoInstancia = window.getJogoInstance();
    } 

    if (!jogoInstancia) {
        console.error("Instância de jogo não encontrada. Impossível salvar.");
        if (typeof window.mostrarMensagemTemporaria === 'function') {
            window.mostrarMensagemTemporaria("Erro: Jogo não iniciado.");
        }
        return;
    }
    
    try {
        const fen = jogoInstancia.fen();
        const nome = prompt("Digite um nome para esta posição (Treino):");
        if (!nome) return;
        
        const problemas = obterProblemas();
        const novoProblema = {
            nome: nome,
            fen: fen,
            solucao: "",
            turno: jogoInstancia.turn() === 'w' ? 'Brancas' : 'Pretas'
        };
        
        problemas.push(novoProblema);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(problemas));
        atualizarListaProblemas();
        
        if (typeof window.mostrarMensagemTemporaria === 'function') {
            window.mostrarMensagemTemporaria("Posição salva com sucesso!", 3000);
        }
    } catch(e) {
        console.error("Erro ao salvar:", e);
    }
}

function removerProblema(index) {
    if (!confirm("Tem certeza que deseja remover este treino?")) return;
    
    const problemas = obterProblemas();
    problemas.splice(index, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(problemas));
    atualizarListaProblemas();
    
    if (typeof window.mostrarMensagemTemporaria === 'function') {
        window.mostrarMensagemTemporaria("Problema removido!", 3000);
    }
}