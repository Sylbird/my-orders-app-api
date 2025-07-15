require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT;

app.use(express.json(), cors());

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

// Get all orders
app.get('/orders', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM orders');
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error('Error in GET /orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific order
app.get('/orders/:id', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    await connection.end();
    if (rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error in GET /orders/:id:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all products
app.get('/products', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM products');
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error('Error in GET /products:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new order
app.post('/orders', async (req, res) => {
  const { order_number } = req.body;
  if (!order_number) return res.status(400).json({ message: 'Missing order_number' });
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO orders (order_number) VALUES (?)',
      [order_number]
    );
    await connection.end();
    res.status(201).json({ id: result.insertId, order_number, date: new Date().toISOString().split('T')[0], num_products: 0, final_price: 0.00 });
  } catch (error) {
    console.error('Error in POST /orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update an order
app.put('/orders/:id', async (req, res) => {
  const { order_number } = req.body;
  if (!order_number) return res.status(400).json({ message: 'Missing order_number' });
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'UPDATE orders SET order_number = ? WHERE id = ?',
      [order_number, req.params.id]
    );
    await connection.end();
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found' });
    res.json({ id: parseInt(req.params.id), order_number });
  } catch (error) {
    console.error('Error in PUT /orders/:id:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete an order
app.delete('/orders/:id', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute('DELETE FROM orders WHERE id = ?', [req.params.id]);
    await connection.end();
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (error) {
    console.error('Error in DELETE /orders/:id:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get products for an order
app.get('/order_products', async (req, res) => {
  const { order_id } = req.query;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT op.order_id, op.product_id, p.name, p.unit_price, op.quantity, op.total_price ' +
      'FROM order_products op JOIN products p ON op.product_id = p.id WHERE op.order_id = ?',
      [order_id]
    );
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error('Error in GET /order_products:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add product to an order
app.post('/order_products', async (req, res) => {
  const { order_id, product_id, quantity } = req.body;
  if (!order_id || !product_id || !quantity) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [product] = await connection.execute('SELECT unit_price FROM products WHERE id = ?', [product_id]);
    if (product.length === 0) return res.status(404).json({ message: 'Product not found' });
    const total_price = product[0].unit_price * quantity;
    const [result] = await connection.execute(
      'INSERT INTO order_products (order_id, product_id, quantity, total_price) VALUES (?, ?, ?, ?)',
      [order_id, product_id, quantity, total_price]
    );
    await connection.end();
    res.status(201).json({ order_id, product_id, quantity, total_price });
  } catch (error) {
    console.error('Error in POST /order_products:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update product quantity in an order
app.put('/order_products', async (req, res) => {
  const { order_id, product_id, quantity } = req.body;
  if (!order_id || !product_id || !quantity) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [product] = await connection.execute('SELECT unit_price FROM products WHERE id = ?', [product_id]);
    if (product.length === 0) return res.status(404).json({ message: 'Product not found' });
    const total_price = product[0].unit_price * quantity;
    const [result] = await connection.execute(
      'UPDATE order_products SET quantity = ?, total_price = ? WHERE order_id = ? AND product_id = ?',
      [quantity, total_price, order_id, product_id]
    );
    await connection.end();
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Order product not found' });
    res.json({ order_id, product_id, quantity, total_price });
  } catch (error) {
    console.error('Error in PUT /order_products:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete product from an order
app.delete('/order_products', async (req, res) => {
  const { order_id, product_id } = req.query;
  if (!order_id || !product_id) return res.status(400).json({ message: 'Missing order_id or product_id' });
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'DELETE FROM order_products WHERE order_id = ? AND product_id = ?',
      [order_id, product_id]
    );
    await connection.end();
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Order product not found' });
    res.json({ message: 'Order product deleted' });
  } catch (error) {
    console.error('Error in DELETE /order_products:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});