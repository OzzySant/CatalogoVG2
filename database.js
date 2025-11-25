// database.js (V2.0.7 - Adicionada tabela 'settings')
const mysql = require('mysql2/promise');

// -----------------------------------------------------------------
// ATENÇÃO: SUAS CREDENCIAIS DO MYSQL
// -----------------------------------------------------------------
const dbConfig = {
    host: '127.0.0.1',       
    user: 'root',            
    password: '1234',        
    database: 'catalogo_db', 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};
// -----------------------------------------------------------------

let pool = null;

/**
 * Cria e retorna o pool de conexões MySQL.
 */
function getDbPool() {
    if (!pool) {
        try {
            pool = mysql.createPool(dbConfig);
            console.log('Pool de conexões MySQL criado com sucesso.');
        } catch (err) {
            console.error('Erro ao criar pool de conexões MySQL:', err);
            // Removed process.exit(1) to allow server to stay alive
        }
    }
    return pool;
}

/**
 * Inicializa o banco de dados.
 * Garante que a tabela 'products' exista.
 */
async function initDb() {
    let connection;
    try {
        const pool = getDbPool(); 
        if (!pool) throw new Error("Pool não foi criado.");
        
        connection = await pool.getConnection();
        console.log('Banco de dados MySQL conectado com sucesso.');

        // Cria a tabela principal de produtos se ela não existir
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(100) PRIMARY KEY NOT NULL,
                description TEXT NOT NULL,
                imageName VARCHAR(255),
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `);
        
        console.log("Tabela 'products' garantida no MySQL.");

        // ========= INÍCIO V2.2.0 (Adicionar Coluna Categoria) =========
        try {
            // Tenta adicionar a coluna 'category'
            await connection.execute(
                `ALTER TABLE products ADD COLUMN category VARCHAR(255) DEFAULT NULL AFTER imageName`
            );
            console.log("V2.2.0: Coluna 'category' adicionada com sucesso à tabela 'products'.");
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log("V2.2.0: Coluna 'category' já existe na tabela 'products'.");
            } else {
                console.error("V2.2.0: Erro ao adicionar coluna 'category':", err.message);
            }
        }
        // ========= FIM V2.2.0 =========

        // V2.0.7: Cria a tabela de configurações
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS settings (
                config_id INT PRIMARY KEY DEFAULT 1,
                settings_data JSON NOT NULL,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT config_id_check CHECK (config_id = 1)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `);

        console.log("Tabela 'settings' garantida no MySQL.");


    } catch (err) {
        console.error('Erro ao inicializar o banco de dados MySQL:', err.message);
        if (err.code === 'ER_BAD_DB_ERROR') {
            console.error(`ERRO: O banco de dados '${dbConfig.database}' não foi encontrado.`);
        }
        // Removed process.exit(1)
    } finally {
        if (connection) {
            connection.release(); 
        }
    }
}

module.exports = { getDbPool, initDb };