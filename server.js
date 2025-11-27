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
        
        // Sorting
        const orderBy = req.query.orderBy || 'createdAt';
        const orderDir = (req.query.orderDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Whitelist allowed columns for sorting to prevent SQL injection
        const allowedSortColumns = ['id', 'description', 'category', 'createdAt'];
        const sortColumn = allowedSortColumns.includes(orderBy) ? orderBy : 'createdAt';

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
            ORDER BY ${sortColumn} ${orderDir}
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
        const newDescription = description !== undefined ? description :