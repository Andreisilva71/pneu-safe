/* ----------------------------------------------------
   LOGIC ENGINE - PNEU-SAFE
   Roteamento SPA, Banco de Dados SQLite Real
   e IHC Industrial de Alta Performance
   ---------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    
    // ------------------------------------------------
    // 1. DADOS E INTEGRACAO COM O BACKEND
    // ------------------------------------------------
    // As chamadas para persistência e consulta agora ocorrem
    // diretamente através da Fetch API para o servidor Node.js
    
    // ------------------------------------------------
    // 2. ESTADOS DO FORMULÁRIO E APLICATIVO
    // ------------------------------------------------
    const appState = {
        currentScreen: "screen-dashboard",
        activeInspection: {
            pneu_id: "",
            pneu_tipo: "",
            checklist: {
                pressao: "OK",
                banda: "OK",
                laterais: "OK",
                talao: "OK"
            },
            defeito_tipo: "Nenhum",
            status: "APROVADO",
            observacoes: "",
            photo: null
        }
    };


    // ------------------------------------------------
    // 3. SELEÇÃO DE ELEMENTOS DOM
    // ------------------------------------------------
    // Telas
    const splashScreen = document.getElementById("splash-screen");
    const appContainer = document.getElementById("app-container");
    const screenDashboard = document.getElementById("screen-dashboard");
    const screenChecklist = document.getElementById("screen-checklist");
    const screenSummary = document.getElementById("screen-summary");

    // Inputs Checklist
    const inputPneuId = document.getElementById("input-pneu-id");
    const selectPneuTipo = document.getElementById("select-pneu-tipo");
    const selectDefeitoTipo = document.getElementById("select-defeito-tipo");

    // Resumo
    const resultStatusCard = document.getElementById("result-status-card");
    const resultStatusIcon = document.getElementById("result-status-icon");
    const resultStatusText = document.getElementById("result-status-text");
    const resultStatusDesc = document.getElementById("result-status-desc");
    const inputObservacoes = document.getElementById("input-observacoes");

    // Modal SQLite
    const sqliteModal = document.getElementById("sqlite-modal");
    const modalSqlQuery = document.getElementById("modal-sql-query");
    const modalSqlOutput = document.getElementById("modal-sql-output");
    const btnCloseModal = document.getElementById("btn-close-modal");

    // Botões SPA / Ações
    const btnNewInspection = document.getElementById("btn-new-inspection");
    const btnCancelChecklist = document.getElementById("btn-cancel-checklist");
    const btnFinishInspection = document.getElementById("btn-finish-inspection");
    const btnSaveSqlite = document.getElementById("btn-save-sqlite");
    const btnSyncData = document.getElementById("btn-sync-data");
    const btnRefreshList = document.getElementById("btn-refresh-list");

    // Câmera
    const btnTriggerCamera = document.getElementById("btn-trigger-camera");
    const cameraStatusBadge = document.getElementById("camera-status-badge");
    const cameraViewfinder = document.getElementById("camera-viewfinder");
    const cameraVideo = document.getElementById("camera-video");
    const cameraPhotoPreview = document.getElementById("camera-photo-preview");
    const cameraOverlay = document.getElementById("camera-overlay");

    // Estatísticas
    const statTotalCount = document.getElementById("stat-total-count");
    const statOkCount = document.getElementById("stat-ok-count");
    const statFailCount = document.getElementById("stat-fail-count");

    // SQLite Terminal de Suporte na Tela
    const sqliteConsoleBody = document.getElementById("sqlite-console-body");
    const sqliteTerminalForm = document.getElementById("sqlite-terminal-form");
    const sqliteTerminalInput = document.getElementById("sqlite-terminal-input");


    // ------------------------------------------------
    // 4. TRANSICÃO SPLASH E INICIALIZAÇÃO
    // ------------------------------------------------
    setTimeout(() => {
        splashScreen.classList.add("splash-fade-out");
        setTimeout(() => {
            splashScreen.style.display = "none";
            appContainer.classList.remove("app-hidden");
            // Força renderização dos ícones do Lucide
            initializeLucideIcons();
            // Carrega lista inicial
            renderInspectionsList();
        }, 500);
    }, 2000); // 2 segundos conforme o requisito


    // ------------------------------------------------
    // 5. SISTEMA DE ROTEAMENTO SPA (Sem recarregamento)
    // ------------------------------------------------
    function showScreen(screenId) {
        // Oculta todas
        screenDashboard.classList.add("screen-hidden");
        screenChecklist.classList.add("screen-hidden");
        screenSummary.classList.add("screen-hidden");

        // Mostra a selecionada
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.remove("screen-hidden");
            appState.currentScreen = screenId;
            window.scrollTo(0, 0);
        }
        
        // Re-inicializa os ícones do Lucide após trocar de tela
        initializeLucideIcons();
    }

    // Configura ícones com traço grosso (stroke-width: 3) exigido pelo Guia de Estilo
    function initializeLucideIcons() {
        if (window.lucide) {
            window.lucide.createIcons({
                attrs: {
                    'stroke-width': 3,
                    'style': 'stroke-width: 3px;'
                }
            });
        }
    }


    // ------------------------------------------------
    // 6. DASHBOARD DE TURNO (TELA 1 - LISTAGEM)
    // ------------------------------------------------
    function renderInspectionsList() {
        fetch('/api/inspecoes')
            .then(response => {
                if (!response.ok) throw new Error("Erro na comunicação com o banco de dados.");
                return response.json();
            })
            .then(inspections => {
                const tbody = document.getElementById("inspections-tbody");
                tbody.innerHTML = "";
                
                if (inspections.length === 0) {
                    tbody.innerHTML = `
                        <tr class="no-data-row">
                            <td colspan="5">Nenhum pneu inspecionado neste turno.</td>
                        </tr>
                    `;
                    updateDashboardStats(0, 0, 0);
                    return;
                }

                // Ordena por data (mais recente primeiro)
                const sorted = [...inspections].reverse();
                
                let total = sorted.length;
                let aprovados = 0;
                let reprovados = 0;

                sorted.forEach(insp => {
                    let statusBadge = "";
                    if (insp.status === "APROVADO") {
                        aprovados++;
                        statusBadge = `<span class="status-badge ok"><i data-lucide="check" style="width:16px;height:16px;"></i> OK</span>`;
                    } else {
                        reprovados++;
                        statusBadge = `<span class="status-badge reprovado"><i data-lucide="x" style="width:16px;height:16px;"></i> Falha</span>`;
                    }

                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td data-label="ID do Pneu" style="font-weight: 800; color: #FFF;">${escapeHTML(insp.pneu_id)}</td>
                        <td data-label="Tipo">${escapeHTML(insp.pneu_tipo)}</td>
                        <td data-label="Status">${statusBadge}</td>
                        <td data-label="Defeito" style="font-weight: 700; color: ${insp.defeito_tipo !== 'Nenhum' ? 'var(--color-danger)' : 'var(--color-text-muted)'}">${escapeHTML(insp.defeito_tipo)}</td>
                        <td data-label="Data / Hora" style="font-size: 16px; color: var(--color-text-muted);">${insp.data_inspecao}</td>
                    `;
                    tbody.appendChild(tr);
                });

                updateDashboardStats(total, aprovados, reprovados);
                initializeLucideIcons();
            })
            .catch(err => {
                console.error("Erro ao carregar dados:", err);
                showVisualAlert("Erro ao carregar dados do banco SQLite3!");
            });
    }

    function updateDashboardStats(total, aprovados, reprovados) {
        statTotalCount.textContent = total;
        statOkCount.textContent = aprovados;
        statFailCount.textContent = reprovados;
    }

    btnRefreshList.addEventListener("click", () => {
        renderInspectionsList();
        
        // Log técnico do SQLite
        addTerminalLog("SELECT COUNT(*), status FROM inspecoes GROUP BY status;", "command");
        
        fetch('/api/inspecoes')
            .then(res => res.json())
            .then(inspecoes => {
                const total = inspecoes.length;
                addTerminalLog(`-- Retornando ${total} registros do banco de dados SQLite3 real.`, "info");
            })
            .catch(err => {
                addTerminalLog(`-- Erro ao ler base: ${err.message}`, "danger");
            });
    });


    // ------------------------------------------------
    // 7. FORMULÁRIO DE INSPEÇÃO (TELA 2 - CHECKLIST)
    // ------------------------------------------------
    
    // Configura botões de Toggle de Checklist Grandes (Uso com Luvas)
    const checklistCards = document.querySelectorAll(".checklist-card");

    /**
     * Função central de ativação do toggle (Lei de Fitts Industrial)
     * Pode ser chamada pelo clique nos botões ou pelo clique no card inteiro.
     */
    function activateToggle(card, targetButton) {
        const item = card.getAttribute("data-item");
        const buttons = card.querySelectorAll(".btn-toggle");

        // Remove classe ativa de ambos
        buttons.forEach(b => b.classList.remove("active"));

        // Ativa o botão alvo
        targetButton.classList.add("active");

        const value = targetButton.getAttribute("data-value");
        appState.activeInspection.checklist[item] = value;

        // Estiliza visualmente o card baseado no estado (IHC Premium)
        if (value === "NOK") {
            card.classList.add("card-fail-active");
            card.classList.remove("card-ok-active");

            // Sugere o defeito automaticamente se falhar
            if (selectDefeitoTipo.value === "Nenhum") {
                selectDefeitoTipo.value = "Outro";
            }
        } else {
            card.classList.remove("card-fail-active");
            card.classList.add("card-ok-active");

            // Verifica se todos voltaram a ser OK para limpar o defeito sugerido
            checkAllChecklistItems();
        }
    }

    checklistCards.forEach(card => {
        const buttons = card.querySelectorAll(".btn-toggle");

        // Listener nos botões individuais OK / FALHA
        buttons.forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation(); // Previne propagação ao card
                activateToggle(card, btn);
            });
        });

        // -------------------------------------------------------
        // 🫳 LEI DE FITTS: Clique no card inteiro (área gigante)
        // Ao tocar com luva espessa no .checklist-info, o sistema
        // detecta qual toggle está inativo e o ativa.
        // -------------------------------------------------------
        const cardInfo = card.querySelector(".checklist-info");
        if (cardInfo) {
            cardInfo.addEventListener("click", () => {
                // Encontra o botão que está INATIVO no momento e o ativa
                const inactiveBtn = Array.from(buttons).find(b => !b.classList.contains("active"));
                if (inactiveBtn) {
                    activateToggle(card, inactiveBtn);

                    // Micro-animação de feedback visual (pisca borda do card)
                    card.style.outline = "3px solid var(--color-primary)";
                    setTimeout(() => { card.style.outline = ""; }, 300);
                }
            });
        }
    });

    function checkAllChecklistItems() {
        const list = appState.activeInspection.checklist;
        const allOk = Object.values(list).every(val => val === "OK");
        if (allOk) {
            selectDefeitoTipo.value = "Nenhum";
        }
    }

    btnNewInspection.addEventListener("click", () => {
        // Reseta o estado do formulário para nova inspeção
        appState.activeInspection = {
            pneu_id: "",
            pneu_tipo: "",
            checklist: {
                pressao: "OK",
                banda: "OK",
                laterais: "OK",
                talao: "OK"
            },
            defeito_tipo: "Nenhum",
            status: "APROVADO",
            observacoes: "",
            photo: null
        };

        // Reseta Inputs Visuais
        inputPneuId.value = "";
        selectPneuTipo.selectedIndex = 0;
        selectDefeitoTipo.value = "Nenhum";
        inputObservacoes.value = "";

        // Reseta Toggles e Card States
        checklistCards.forEach(card => {
            card.classList.remove("card-fail-active");
            card.classList.remove("card-ok-active");
            const btnOk = card.querySelector(".btn-toggle.ok");
            const btnNok = card.querySelector(".btn-toggle.nok");
            btnOk.classList.add("active");
            btnNok.classList.remove("active");
        });

        // Reseta Câmera
        resetCameraSimulator();

        showScreen("screen-checklist");
        
        // Log técnico do SQLite
        addTerminalLog("BEGIN TRANSACTION; -- Iniciando processo de nova inspeção", "info");
    });

    btnCancelChecklist.addEventListener("click", () => {
        showScreen("screen-dashboard");
        addTerminalLog("ROLLBACK; -- Operação cancelada pelo operador", "danger");
    });

    btnFinishInspection.addEventListener("click", () => {
        const pneuId = inputPneuId.value.trim();
        const pneuTipo = selectPneuTipo.value;

        // Validação obrigatória com foco ergonômico
        if (!pneuId) {
            inputPneuId.focus();
            inputPneuId.style.borderColor = "var(--color-danger)";
            setTimeout(() => { inputPneuId.style.borderColor = "var(--color-input-border)"; }, 1500);
            showVisualAlert("Erro de IHC: ID do Pneu é um campo obrigatório!");
            return;
        }

        if (!pneuTipo) {
            selectPneuTipo.focus();
            selectPneuTipo.style.borderColor = "var(--color-danger)";
            setTimeout(() => { selectPneuTipo.style.borderColor = "var(--color-input-border)"; }, 1500);
            showVisualAlert("Erro de IHC: Por favor, selecione um Tipo de Pneu!");
            return;
        }

        // Salva dados no estado ativo
        appState.activeInspection.pneu_id = pneuId;
        appState.activeInspection.pneu_tipo = pneuTipo;
        appState.activeInspection.defeito_tipo = selectDefeitoTipo.value;

        // EXECUTA REGRA DE NEGÓCIO
        const checklistItems = Object.values(appState.activeInspection.checklist);
        const hasChecklistFail = checklistItems.some(val => val === "NOK");
        const hasDefect = selectDefeitoTipo.value !== "Nenhum";

        if (hasChecklistFail || hasDefect) {
            appState.activeInspection.status = "REPROVADO";
        } else {
            appState.activeInspection.status = "APROVADO";
        }

        // Transiciona e monta Tela 3
        prepareSummaryScreen();
        showScreen("screen-summary");
    });


    // ------------------------------------------------
    // 8. TELA DE RESUMO E FEEDBACK VISUAL (TELA 3)
    // ------------------------------------------------
    function prepareSummaryScreen() {
        const inspection = appState.activeInspection;
        
        // Remove classes antigas
        resultStatusCard.classList.remove("card-approved", "card-rejected");
        
        if (inspection.status === "APROVADO") {
            resultStatusCard.classList.add("card-approved");
            resultStatusText.textContent = "Aprovado";
            resultStatusDesc.textContent = "O pneu atende a todos os critérios e está liberado para operação.";
            resultStatusIcon.setAttribute("data-lucide", "check-circle");
        } else {
            resultStatusCard.classList.add("card-rejected");
            resultStatusText.textContent = "Reprovado";
            
            // Mensagem detalhada de IHC inteligente
            let detalhesDefeito = "";
            if (inspection.defeito_tipo !== "Nenhum") {
                detalhesDefeito += `Defeito: ${inspection.defeito_tipo}. `;
            }
            const falhasChecklist = [];
            for (let k in inspection.checklist) {
                if (inspection.checklist[k] === "NOK") falhasChecklist.push(k.toUpperCase());
            }
            if (falhasChecklist.length > 0) {
                detalhesDefeito += `Falha nos itens: ${falhasChecklist.join(", ")}.`;
            }

            resultStatusText.innerHTML = "Reprovado";
            resultStatusDesc.innerHTML = `Identificado risco operacional crítico! <br><strong style="color: #FFF;">${detalhesDefeito}</strong>`;
            resultStatusIcon.setAttribute("data-lucide", "alert-triangle");
        }

        // Reseta terminal SQL preliminar na tela
        sqliteConsoleBody.innerHTML = `
            <div class="terminal-line text-muted">-- Pneu-Safe Local SQLite3 Engine --</div>
            <div class="terminal-line text-muted">PRAGMA foreign_keys = ON;</div>
            <div class="terminal-line info">-- DADOS PREPARADOS PARA PERSISTÊNCIA:</div>
            <div class="terminal-line success">Pneu ID: ${escapeHTML(inspection.pneu_id)} | Tipo: ${escapeHTML(inspection.pneu_tipo)} | Status: ${inspection.status}</div>
            <div class="terminal-line text-muted">Aguardando execução de INSERT INTO...</div>
        `;
    }

    // SIMULADOR DE CÂMERA DE EVIDÊNCIA
    let localStream = null;

    btnTriggerCamera.addEventListener("click", async () => {
        if (cameraStatusBadge.textContent === "Standby") {
            cameraStatusBadge.textContent = "Iniciando...";
            cameraStatusBadge.classList.add("active");
            
            try {
                const constraints = {
                    video: { width: 320, height: 240, facingMode: "environment" },
                    audio: false
                };
                
                localStream = await navigator.mediaDevices.getUserMedia(constraints);
                cameraVideo.srcObject = localStream;
                cameraVideo.classList.remove("hidden-element");
                cameraOverlay.classList.remove("hidden-element");
                
                cameraViewfinder.querySelector(".viewfinder-placeholder-icon").classList.add("hidden-element");
                cameraViewfinder.querySelector(".viewfinder-text").classList.add("hidden-element");
                
                cameraStatusBadge.textContent = "Ao Vivo";
                btnTriggerCamera.innerHTML = `<i data-lucide="aperture"></i> Registrar Foto`;
                initializeLucideIcons();
            } catch (err) {
                simulateGloveCamera();
            }
        } else if (cameraStatusBadge.textContent === "AO VIVO") {
            capturePhotoFromStream();
        } else {
            resetCameraSimulator();
        }
    });

    function capturePhotoFromStream() {
        const canvas = document.createElement("canvas");
        canvas.width = cameraVideo.videoWidth || 320;
        canvas.height = cameraVideo.videoHeight || 240;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
        
        const photoUrl = canvas.toDataURL("image/jpeg");
        appState.activeInspection.photo = photoUrl;
        
        cameraPhotoPreview.src = photoUrl;
        cameraPhotoPreview.classList.remove("hidden-element");
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        cameraVideo.classList.add("hidden-element");
        cameraOverlay.classList.add("hidden-element");
        
        cameraStatusBadge.textContent = "Registrada";
        cameraStatusBadge.classList.remove("active");
        btnTriggerCamera.innerHTML = `<i data-lucide="rotate-ccw"></i> Capturar Outra`;
        initializeLucideIcons();
    }

    function simulateGloveCamera() {
        cameraStatusBadge.textContent = "Simulando";
        cameraStatusBadge.classList.add("active");
        cameraOverlay.classList.remove("hidden-element");
        
        let flashCount = 0;
        const interval = setInterval(() => {
            cameraViewfinder.style.backgroundColor = flashCount % 2 === 0 ? "#111" : "#FACC15";
            flashCount++;
            if (flashCount > 4) {
                clearInterval(interval);
                cameraViewfinder.style.backgroundColor = "#0c0c0c";
                
                const statusColor = appState.activeInspection.status === "APROVADO" ? "#22C55E" : "#EF4444";
                const mockPhoto = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
                    <rect width="320" height="240" fill="%231E1E1E"/>
                    <circle cx="160" cy="120" r="80" stroke="${encodeURIComponent(statusColor)}" stroke-width="6" fill="none" stroke-dasharray="10 5"/>
                    <line x1="160" y1="20" x2="160" y2="220" stroke="%233A3A3A" stroke-width="2"/>
                    <line x1="20" y1="120" x2="300" y2="120" stroke="%233A3A3A" stroke-width="2"/>
                    <text x="20" y="40" fill="%23FFFFFF" font-family="monospace" font-size="12" font-weight="bold">TARGET ID: ${appState.activeInspection.pneu_id}</text>
                    <text x="20" y="60" fill="%23FFFFFF" font-family="monospace" font-size="12">STATUS: ${appState.activeInspection.status}</text>
                    <text x="20" y="210" fill="${encodeURIComponent(statusColor)}" font-family="monospace" font-size="14" font-weight="bold">Evidência Técnica Salva</text>
                    <rect x="250" y="20" width="50" height="30" fill="none" stroke="%23FFFFFF" stroke-width="2"/>
                    <text x="258" y="40" fill="%23FFFFFF" font-family="monospace" font-size="14">ISO</text>
                </svg>`;
                
                appState.activeInspection.photo = mockPhoto;
                cameraPhotoPreview.src = mockPhoto;
                cameraPhotoPreview.classList.remove("hidden-element");
                
                cameraStatusBadge.textContent = "Imagem OK";
                cameraStatusBadge.classList.remove("active");
                cameraOverlay.classList.add("hidden-element");
                btnTriggerCamera.innerHTML = `<i data-lucide="rotate-ccw"></i> Capturar Outra`;
                initializeLucideIcons();
            }
        }, 100);
    }

    function resetCameraSimulator() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        cameraVideo.classList.add("hidden-element");
        cameraPhotoPreview.classList.add("hidden-element");
        cameraOverlay.classList.add("hidden-element");
        
        cameraViewfinder.querySelector(".viewfinder-placeholder-icon").classList.remove("hidden-element");
        cameraViewfinder.querySelector(".viewfinder-text").classList.remove("hidden-element");
        
        cameraStatusBadge.textContent = "Standby";
        cameraStatusBadge.classList.remove("active");
        btnTriggerCamera.innerHTML = `<i data-lucide="camera"></i> Capturar Imagem`;
        initializeLucideIcons();
    }


    // ------------------------------------------------
    // 9. PERSISTÊNCIA REAL COM SQLITE3 (BACKEND API)
    // ------------------------------------------------
    btnSaveSqlite.addEventListener("click", () => {
        const insp = appState.activeInspection;
        
        // Adiciona observação se o operador escreveu
        insp.observacoes = inputObservacoes.value.trim() || "Nenhuma observação técnica anotada.";
        
        // Data e hora atual formatada localmente
        const date = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const formattedDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

        // Abre o modal de transação SQL
        sqliteModal.classList.remove("hidden-element");
        
        // Escreve a query com os parâmetros reais
        const sqlQueryText = `INSERT INTO inspecoes (\n  pneu_id, \n  pneu_tipo, \n  defeito_tipo, \n  status, \n  data_inspecao, \n  observacoes\n) VALUES (\n  '${insp.pneu_id}',\n  '${insp.pneu_tipo}',\n  '${insp.defeito_tipo}',\n  '${insp.status}',\n  '${formattedDate}',\n  '${insp.observacoes.replace(/'/g, "''")}'\n);`;
        
        modalSqlQuery.textContent = sqlQueryText;
        modalSqlOutput.innerHTML = `sqlite> -- Analisando sintaxe SQL...\nsqlite> -- Gravando na tabela 'inspecoes' do SQLite3...`;
        
        // Simulação do carregamento visual do banco de dados
        const progress = sqliteModal.querySelector(".sql-loader-progress");
        progress.style.animation = "none";
        void progress.offsetWidth; // Trigger reflow
        progress.style.animation = "sql-progress 1.5s forwards linear";

        setTimeout(() => {
            // Executa a requisição real de inserção para a API Express
            fetch('/api/inspecoes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pneu_id: insp.pneu_id,
                    pneu_tipo: insp.pneu_tipo,
                    defeito_tipo: insp.defeito_tipo,
                    status: insp.status,
                    data_inspecao: formattedDate,
                    observacoes: insp.observacoes
                })
            })
            .then(res => {
                if (!res.ok) throw new Error("Falha ao gravar registro no banco SQLite3.");
                return res.json();
            })
            .then(data => {
                modalSqlOutput.innerHTML = `sqlite> Query OK, 1 row affected (0.02 sec)\nsqlite> sqlite3_changes() -> 1\nsqlite> last_insert_rowid() -> ${data.id}\nsqlite> COMMIT TRANSACTION;`;
                
                // Adiciona no terminal principal de suporte da tela
                addTerminalLog(sqlQueryText, "command");
                addTerminalLog(`sqlite> Query OK, 1 row affected (0.02 sec). Registro '${insp.pneu_id}' gravado em pneusafe.db!`, "success");
                
                // Habilita o botão de fechar modal
                btnCloseModal.disabled = false;
            })
            .catch(err => {
                modalSqlOutput.innerHTML = `sqlite> ERRO: ${err.message}\nsqlite> ROLLBACK TRANSACTION;`;
                addTerminalLog(`sqlite> ERRO: ${err.message}`, "danger");
                btnCloseModal.disabled = false;
            });
        }, 1500);
    });

    btnCloseModal.addEventListener("click", () => {
        // Fecha modal
        sqliteModal.classList.add("hidden-element");
        // Atualiza a tabela na tela 1
        renderInspectionsList();
        // Volta para a Tela 1
        showScreen("screen-dashboard");
    });


    // ------------------------------------------------
    // 9.5 TERMINAL INTERATIVO SQLITE3 REAL
    // ------------------------------------------------
    if (sqliteTerminalForm && sqliteTerminalInput) {
        sqliteTerminalForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const sql = sqliteTerminalInput.value.trim();
            if (!sql) return;
            
            sqliteTerminalInput.value = "";
            executeCustomQuery(sql);
        });
    }

    function executeCustomQuery(sql) {
        addTerminalLog(`sqlite> ${sql}`, "command");
        
        fetch('/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: sql })
        })
        .then(res => {
            if (!res.ok) {
                return res.json().then(data => { throw new Error(data.error || "Erro de execução."); });
            }
            return res.json();
        })
        .then(data => {
            if (data.type === 'select') {
                if (data.rows.length === 0) {
                    addTerminalLog("-- Nenhum registro correspondente encontrado.", "info");
                } else {
                    const cols = Object.keys(data.rows[0]);
                    addTerminalLog(`| ${cols.join(' | ')} |`, "success");
                    addTerminalLog(`| ${cols.map(() => '---').join(' | ')} |`, "text-muted");
                    data.rows.forEach(row => {
                        const vals = cols.map(c => row[c]);
                        addTerminalLog(`| ${vals.join(' | ')} |`, "info");
                    });
                    addTerminalLog(`-- ${data.count} registro(s) retornado(s) em ${data.time}ms`, "text-muted");
                }
            } else {
                addTerminalLog(`Query OK, ${data.changes} linha(s) modificada(s) em ${data.time}ms (ID gerado: ${data.lastID || 'N/A'})`, "success");
            }
        })
        .catch(err => {
            addTerminalLog(`sqlite> Erro: ${err.message}`, "danger");
        });
    }


    // ------------------------------------------------
    // 10. SINCRONIZAÇÃO DE DADOS (API Backend Real)
    // ------------------------------------------------
    btnSyncData.addEventListener("click", () => {
        btnSyncData.disabled = true;
        btnSyncData.innerHTML = `<i data-lucide="refresh-cw" class="animate-spin"></i> Sincronizando...`;
        initializeLucideIcons();

        const icon = btnSyncData.querySelector("svg");
        if (icon) icon.classList.add("animate-spin");

        addTerminalLog("SELECT * FROM inspecoes WHERE synced = 0;", "command");
        addTerminalLog("-- Estabelecendo comunicação TLS com o servidor central da Pneu-Safe...", "info");

        // Dispara requisição HTTP POST para sincronização
        fetch('/api/sync', { method: 'POST' })
            .then(res => {
                if (!res.ok) throw new Error("Servidor de sincronização indisponível.");
                return res.json();
            })
            .then(data => {
                setTimeout(() => {
                    addTerminalLog(`-- Sincronização concluída com sucesso! ${data.changes} registros transmitidos.`, "success");
                    
                    btnSyncData.disabled = false;
                    btnSyncData.innerHTML = `<i data-lucide="refresh-cw"></i> Sincronizar`;
                    initializeLucideIcons();
                    
                    showVisualAlert(`Sincronização Concluída! ${data.changes} registros pendentes foram integrados ao servidor central da Pneu-Safe.`);
                }, 2000);
            })
            .catch(err => {
                setTimeout(() => {
                    addTerminalLog(`-- Falha na sincronização: ${err.message}`, "danger");
                    
                    btnSyncData.disabled = false;
                    btnSyncData.innerHTML = `<i data-lucide="refresh-cw"></i> Sincronizar`;
                    initializeLucideIcons();
                    
                    showVisualAlert(`Erro de conexão com o servidor de sincronização!`);
                }, 2000);
            });
    });


    // ------------------------------------------------
    // 11. UTILITÁRIOS E AUXILIARES DE IHC
    // ------------------------------------------------
    function addTerminalLog(text, type = "") {
        const line = document.createElement("div");
        line.className = `terminal-line ${type}`;
        line.textContent = text;
        sqliteConsoleBody.appendChild(line);
        sqliteConsoleBody.scrollTop = sqliteConsoleBody.scrollHeight;
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // Alerta Ergonômico Técnico na tela
    function showVisualAlert(message) {
        const alertBox = document.createElement("div");
        alertBox.style.position = "fixed";
        alertBox.style.bottom = "120px";
        alertBox.style.left = "50%";
        alertBox.style.transform = "translateX(-50%) translateY(20px)";
        alertBox.style.backgroundColor = "var(--color-card)";
        alertBox.style.border = "2px solid var(--color-primary)";
        alertBox.style.color = "#FFFFFF";
        alertBox.style.padding = "16px 32px";
        alertBox.style.borderRadius = "30px";
        alertBox.style.boxShadow = "0 8px 30px rgba(0,0,0,0.8)";
        alertBox.style.zIndex = "2000";
        alertBox.style.fontSize = "18px";
        alertBox.style.fontWeight = "700";
        alertBox.style.textAlign = "center";
        alertBox.style.maxWidth = "90%";
        alertBox.style.opacity = "0";
        alertBox.style.transition = "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        
        alertBox.textContent = message;
        document.body.appendChild(alertBox);

        // Anima entrada
        setTimeout(() => {
            alertBox.style.opacity = "1";
            alertBox.style.transform = "translateX(-50%) translateY(0)";
        }, 50);

        // Anima saída
        setTimeout(() => {
            alertBox.style.opacity = "0";
            alertBox.style.transform = "translateX(-50%) translateY(20px)";
            setTimeout(() => {
                alertBox.remove();
            }, 300);
        }, 4000);
    }

});

// Estilos de animação spin adicionados dinamicamente para o botão de sinc
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
.animate-spin {
    animation: spin 1s linear infinite;
}
`;
document.head.appendChild(styleSheet);
