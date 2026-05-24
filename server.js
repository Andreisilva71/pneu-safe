const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Inicialização do Banco de Dados SQLite3
const dbPath = path.join(__dirname, 'pneusafe.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados SQLite3:', err.message);
    } else {
        console.log('Banco de dados SQLite3 conectado com sucesso em:', dbPath);
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Criar tabela de inspeções
        db.run(`
            CREATE TABLE IF NOT EXISTS inspecoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pneu_id TEXT NOT NULL,
                pneu_tipo TEXT NOT NULL,
                defeito_tipo TEXT NOT NULL,
                status TEXT NOT NULL,
                data_inspecao TEXT NOT NULL,
                observacoes TEXT,
                synced INTEGER DEFAULT 0
            )
        `, (err) => {
            if (err) {
                console.error('Erro ao criar tabela:', err.message);
            } else {
                console.log('Tabela "inspecoes" verificada/criada.');
                insertSampleData();
            }
        });
    });
}

function insertSampleData() {
    db.get('SELECT COUNT(*) AS count FROM inspecoes', (err, row) => {
        if (err) {
            console.error('Erro ao verificar registros:', err.message);
            return;
        }

        if (row.count === 0) {
            const sampleData = [
                {
                    pneu_id: "P-101",
                    pneu_tipo: "OTR (Fora de Estrada)",
                    defeito_tipo: "Nenhum",
                    status: "APROVADO",
                    data_inspecao: "2026-05-20 07:15:30",
                    observacoes: "Pressão normal de 120 PSI. Sem cortes aparentes."
                },
                {
                    pneu_id: "P-102",
                    pneu_tipo: "Caminhão Pesado",
                    defeito_tipo: "Rasgo",
                    status: "REPROVADO",
                    data_inspecao: "2026-05-20 08:02:15",
                    observacoes: "Rasgo profundo de 5cm expôs cintas de aço na lateral."
                },
                {
                    pneu_id: "P-103",
                    pneu_tipo: "Agrícola",
                    defeito_tipo: "Nenhum",
                    status: "APROVADO",
                    data_inspecao: "2026-05-20 08:35:48",
                    observacoes: "Banda de rodagem em excelente estado de conservação."
                }
            ];

            const stmt = db.prepare(`
                INSERT INTO inspecoes (pneu_id, pneu_tipo, defeito_tipo, status, data_inspecao, observacoes, synced)
                VALUES (?, ?, ?, ?, ?, ?, 0)
            `);

            sampleData.forEach((data) => {
                stmt.run(data.pneu_id, data.pneu_tipo, data.defeito_tipo, data.status, data.data_inspecao, data.observacoes);
            });

            stmt.finalize((err) => {
                if (err) {
                    console.error('Erro ao inserir registros iniciais:', err.message);
                } else {
                    console.log('Registros de exemplo inseridos no SQLite3 com sucesso.');
                }
            });
        }
    });
}

// Servir o index.html na raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API: Listar inspeções
app.get('/api/inspecoes', (req, res) => {
    db.all('SELECT * FROM inspecoes', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// API: Salvar nova inspeção
app.post('/api/inspecoes', (req, res) => {
    const { pneu_id, pneu_tipo, defeito_tipo, status, data_inspecao, observacoes } = req.body;
    
    if (!pneu_id || !pneu_tipo || !status) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }

    const query = `
        INSERT INTO inspecoes (pneu_id, pneu_tipo, defeito_tipo, status, data_inspecao, observacoes, synced)
        VALUES (?, ?, ?, ?, ?, ?, 0)
    `;

    db.run(query, [pneu_id, pneu_tipo, defeito_tipo, status, data_inspecao, observacoes], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.status(201).json({
            id: this.lastID,
            pneu_id,
            pneu_tipo,
            defeito_tipo,
            status,
            data_inspecao,
            observacoes,
            changes: this.changes
        });
    });
});

// API: Sincronizar dados pendentes
app.post('/api/sync', (req, res) => {
    db.run('UPDATE inspecoes SET synced = 1 WHERE synced = 0', function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ changes: this.changes, message: 'Registros sincronizados com sucesso.' });
    });
});

// API: Terminal SQL Interativo
app.post('/api/query', (req, res) => {
    const { query } = req.body;
    
    if (!query) {
        return res.status(400).json({ error: 'Nenhuma consulta SQL fornecida.' });
    }

    // Validações básicas de segurança para evitar exclusão acidental da base em ambiente de teste
    const normalizedQuery = query.trim().toUpperCase();
    if (normalizedQuery.startsWith('DROP ') || normalizedQuery.startsWith('DELETE FROM sqlite_')) {
        return res.status(403).json({ error: 'Comando SQL restrito por motivos de segurança.' });
    }

    const startTime = process.hrtime();

    // Determina se a query é uma leitura (SELECT, PRAGMA) ou escrita
    const isSelect = normalizedQuery.startsWith('SELECT') || normalizedQuery.startsWith('PRAGMA') || normalizedQuery.startsWith('EXPLAIN');

    if (isSelect) {
        db.all(query, [], (err, rows) => {
            const diff = process.hrtime(startTime);
            const timeTaken = (diff[0] * 1000 + diff[1] / 1000000).toFixed(2);
            
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json({
                type: 'select',
                rows: rows,
                time: timeTaken,
                count: rows.length
            });
        });
    } else {
        db.run(query, [], function(err) {
            const diff = process.hrtime(startTime);
            const timeTaken = (diff[0] * 1000 + diff[1] / 1000000).toFixed(2);

            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json({
                type: 'run',
                changes: this.changes,
                lastID: this.lastID,
                time: timeTaken
            });
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor Pneu-Safe rodando em http://localhost:${PORT}`);
});
