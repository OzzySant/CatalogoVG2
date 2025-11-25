// server.js (V2.1.0 - Fixed CRUD)
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { getDbPool, initDb } = require('./database'); 
const fsp = require('fs/promises');
const app = express();
const PORT = 3000;

app.use(cors()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir);
        console.log('Pasta /uploads criada com sucesso.');
    } catch (e) {
        console.error('Erro ao criar pasta uploads:', e);
    }
}

app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Funções Auxiliares (Salvar/Remover Imagem) ---
function saveImageFromDataUrl(id, imageDataUrl) {
    if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
        return null;
    }
    // Simple regex to detect format
    let ext = 'jpg';
    if (imageDataUrl.startsWith('data:image/png')) ext = 'png';
    else if (imageDataUrl.startsWith('data:image/webp')) ext = 'webp';

    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageName = `${id}_${Date.now()}.${ext}`; 
    const imagePath = path.join(__dirname, 'uploads', imageName);
    try {
        fs.writeFileSync(imagePath, base64Data, 'base64');
        console.log(`[${id}] Imagem salva: ${imageName}`);
        return imageName;
    } catch (err) {
        console.error(`[${id}] Erro ao salvar imagem:`, err.message);
        return null;
    }
}

function removeImageFile(imageName) {
    if (!imageName) return;
    try {
        const imagePath = path.join(__dirname, 'uploads', imageName);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`Imagem antiga removida: ${imageName}`);
        }
    } catch (err) {
        console.error(`Erro ao remover imagem antiga:`, err.message);
    }
}

// Middleware to check DB connection
const checkDb = (req, res, next) => {
    try {
        const pool = getDbPool();
        if (!pool) throw new Error("DB Pool unavailable");
        next();
    } catch (e) {
        console.error("Database access failed:", e.message);
        res.status(503).json({ error: "Database unavailable" });
    }
};

// --- ROTAS DA API (CRUD) ---

// [GET] Obter todos os produtos
app.get('/api/products', checkDb, async (req, res) => {
    try {
        const pool = getDbPool();

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const search = req.query.search ? req.query.search.trim() : '';
        const category = req.query.category ? req.query.category.trim() : '';
        
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1'; 
        const params = []; 

        if (search) {
            whereClause += ' AND (id LIKE ? OR description LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern);
        }
        
        if (category && category !== 'all') {
            whereClause += ' AND category = ?';
            params.push(category);
        }

        // Count
        const countQuery = `SELECT COUNT(*) AS totalCount FROM products ${whereClause}`;
        const [countResult] = await pool.query(countQuery, params);
        
        const totalCount = countResult[0].totalCount;
        const totalPages = Math.ceil(totalCount / limit);

        // Fetch
        const productsQuery = `
            SELECT * FROM products
            ${whereClause}
            ORDER BY createdAt DESC
            LIMIT ? OFFSET ?
        `;
        const productParams = [...params, limit, offset]; 

        const [rows] = await pool.query(productsQuery, productParams);
        
        res.status(200).json({
            products: rows,
            totalCount: totalCount,
            currentPage: page,
            totalPages: totalPages,
            limit: limit
        });

    } catch (err) {
        console.error('Erro GET /api/products:', err.message);
        res.status(500).json({ error: 'Erro ao buscar produtos. ' + err.message });
    }
});


// [POST] Criar um novo produto
app.post('/api/products', checkDb, async (req, res) => {
    const { id, description, imageDataUrl, category } = req.body;
    
    if (!id || !description) {
        return res.status(400).json({ error: 'ID e Descrição são obrigatórios.' });
    }

    try {
        const pool = getDbPool();
        
        const [existing] = await pool.execute('SELECT id FROM products WHERE id = ?', [id]);
        if (existing.length > 0) {
            return res.status(409).json({ error: `O ID '${id}' já está cadastrado.` });
        }
        
        const imageName = saveImageFromDataUrl(id, imageDataUrl);

        await pool.execute(
            'INSERT INTO products (id, description, imageName, category) VALUES (?, ?, ?, ?)',
            [id, description, imageName, category || null]
        );
        
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ?', [id]);
        res.status(201).json(rows[0]);

    } catch (err) {
        console.error('Erro POST /api/products:', err.message);
        res.status(500).json({ error: 'Erro ao salvar produto.' });
    }
});


// [PUT] Atualizar um produto
app.put('/api/products/:id', checkDb, async (req, res) => {
    const { id } = req.params;
    // Retrieve fields. If undefined, we'll keep existing values.
    const { description, imageDataUrl, category } = req.body;

    try {
        const pool = getDbPool();
        
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }
        
        const currentProduct = rows[0];
        
        // Determine new values
        const newDescription = description !== undefined ? description : currentProduct.description;
        const newCategory = category !== undefined ? category : currentProduct.category;
        let newImageName = currentProduct.imageName;

        // If imageDataUrl is explicitly passed as a string (Base64), update it.
        // If it's null (explicit removal) or undefined (no change), handle accordingly.
        // NOTE: Frontend sends 'null' to keep existing, empty string to remove? 
        // Let's stick to: If it is a Base64 string, replace. 
        
        if (imageDataUrl && typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image')) {
            // Replace image
            if (currentProduct.imageName) removeImageFile(currentProduct.imageName);
            newImageName = saveImageFromDataUrl(id, imageDataUrl);
        } 
        // If user specifically requested to remove image (optional logic, usually frontend just doesn't send anything if no change)
        
        await pool.execute(
            'UPDATE products SET description = ?, imageName = ?, category = ? WHERE id = ?',
            [newDescription, newImageName, newCategory, id]
        );
        
        const [updatedRows] = await pool.execute('SELECT * FROM products WHERE id = ?', [id]);
        res.status(200).json(updatedRows[0]);

    } catch (err) {
        console.error(`Erro PUT /api/products/${id}:`, err.message);
        res.status(500).json({ error: 'Erro ao atualizar produto: ' + err.message });
    }
});


// [DELETE] Deletar um produto
app.delete('/api/products/:id', checkDb, async (req, res) => {
    const { id } = req.params;
    let connection;

    try {
        connection = await getDbPool().getConnection();

        const [rows] = await connection.execute('SELECT imageName FROM products WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: `Produto com ID "${id}" não encontrado.` });
        }

        const { imageName } = rows[0];

        await connection.execute('DELETE FROM products WHERE id = ?', [id]);

        if (imageName) {
            await removeImageFile(imageName);
        }

        res.status(200).json({ success: true, message: `Produto ${id} excluído.` });

    } catch (err) {
        console.error(`[DELETE /api/products/${id}] Erro:`, err.message);
        res.status(500).json({ error: 'Erro de servidor ao excluir produto.' });
    } finally {
        if (connection) connection.release();
    }
});


// [GET] Obter todas as categorias
app.get('/api/categories', checkDb, async (req, res) => {
    try {
        const pool = getDbPool();
        const [rows] = await pool.query(
            "SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category ASC"
        );
        const categories = rows.map(row => row.category);
        res.status(200).json(categories);

    } catch (err) {
        console.error('Erro GET /api/categories:', err.message);
        res.status(500).json({ error: 'Erro ao buscar categorias.' });
    }
});


// [POST] Limpeza
app.post('/api/cleanup/orphaned-images', checkDb, async (req, res) => {
    let connection;
    try {
        const pool = getDbPool();
        connection = await pool.getConnection();

        const [rows] = await connection.query(
            "SELECT DISTINCT imageName FROM products WHERE imageName IS NOT NULL AND imageName != ''"
        );

        const dbImageSet = new Set(rows.map(row => row.imageName));
        const uploadDir = path.join(__dirname, 'uploads');
        
        if (!fs.existsSync(uploadDir)) return res.status(200).json({ message: "Sem pasta uploads.", deletedCount: 0 });

        const filesOnDisk = await fsp.readdir(uploadDir);
        let deletedCount = 0;
        let keptCount = 0;
        const errors = [];

        await Promise.all(filesOnDisk.map(async (fileName) => {
            if (!dbImageSet.has(fileName)) {
                try {
                    await fsp.unlink(path.join(uploadDir, fileName));
                    deletedCount++;
                } catch (err) {
                    errors.push(fileName);
                }
            } else {
                keptCount++;
            }
        }));

        res.status(200).json({ message: "Limpeza concluída.", deletedCount, keptCount, errors });

    } catch (err) {
        console.error('Erro cleanup:', err.message);
        res.status(500).json({ error: 'Erro de servidor durante a limpeza.' });
    } finally {
        if (connection) connection.release();
    }
});


// --- SETTINGS ---
app.get('/api/settings', checkDb, async (req, res) => {
    try {
        const pool = getDbPool();
        const [rows] = await pool.execute('SELECT settings_data FROM settings WHERE config_id = 1');
        if (rows.length > 0) res.status(200).json(rows[0].settings_data || {});
        else {
            await pool.execute('INSERT INTO settings (config_id, settings_data) VALUES (1, ?)', [JSON.stringify({})]);
            res.status(200).json({});
        }
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar configurações.' });
    }
});

app.post('/api/settings', checkDb, async (req, res) => {
    const settingsData = req.body;
    if (!settingsData) return res.status(400).json({ error: 'Nenhum dado.' });
    const json = JSON.stringify(settingsData);
    try {
        const pool = getDbPool();
        await pool.execute(
            `INSERT INTO settings (config_id, settings_data) VALUES (1, ?) ON DUPLICATE KEY UPDATE settings_data = ?`,
            [json, json]
        );
        res.status(200).json({ message: 'Salvo.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar.' });
    }
});

// --- BATCH IMPORT ---
app.post('/api/products/batch-import', checkDb, async (req, res) => {
    const products = req.body;
    if (!Array.isArray(products)) return res.status(400).json({ error: 'Dados inválidos.' });

    const pool = getDbPool();
    const connection = await pool.getConnection();
    let imported = 0, skipped = 0;

    try {
        await connection.beginTransaction();
        for (const p of products) {
            if (!p.id || !p.description) { skipped++; continue; }
            const [ex] = await connection.execute('SELECT id FROM products WHERE id = ?', [p.id]);
            if (ex.length === 0) {
                await connection.execute(
                    'INSERT INTO products (id, description, imageName, category) VALUES (?, ?, ?, ?)',
                    [p.id, p.description, null, p.category || null]
                );
                imported++;
            } else {
                skipped++;
            }
        }
        await connection.commit();
        res.status(200).json({ imported, skipped });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: 'Erro na importação.' });
    } finally {
        connection.release();
    }
});

app.listen(PORT, async () => {
    try { await initDb(); console.log(`Servidor rodando: http://localhost:${PORT}`); }
    catch(e) { console.error("DB Error:", e.message); }
});