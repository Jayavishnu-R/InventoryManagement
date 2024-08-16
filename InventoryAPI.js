import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
const app = express();
const port = 4000;
env.config();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


const prod = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
//prod.connect();
prod.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Connected to the database 4000');
});
// GET all products
app.get("/products", async (req, res) => {
  try {
    const result = await prod.query('SELECT * FROM products');
    console.log(result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Error retrieving products');
  }
});



// GET a specific product by id
app.get("/products/:id", async (req, res) => {
  const productId = parseInt(req.params.id);

  try {
    const result = await prod.query('SELECT * FROM products WHERE id = $1', [productId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Error retrieving product');
  }
});



// create a new product
app.post("/products", async (req, res) => {
  const { title, description, seller, price,quantity,unit } = req.body;

  try {
    const result = await prod.query(
      'INSERT INTO products (title, description, seller, price,quantity,unit) VALUES ($1, $2, $3, $4 ,$5, $6) RETURNING *',
      [title, description, seller, price,quantity,unit]
    );

    const newProduct = result.rows[0];
    res.status(201).json(newProduct);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Error creating product');
  }
});



// PATCH a product when you just want to update one parameter
app.patch("/products/:id", async (req, res) => {
  const productId = parseInt(req.params.id);
  const { title, description, seller, price ,quantity, unit} = req.body;

  // Build the query dynamically based on the fields provided
  let query = 'UPDATE products SET ';
  const updates = [];
  const values = [];

  if (title) {
    values.push(title);
    updates.push(`title = $${values.length}`);
  }
  if (description) {
    values.push(description);
    updates.push(`description = $${values.length}`);
  }
  if (seller) {
    values.push(seller);
    updates.push(`seller = $${values.length}`);
  }
  if (price) {
    values.push(price);
    updates.push(`price = $${values.length}`);
  }
  if (quantity) {
    values.push(quantity);
    updates.push(`quantity = $${values.length}`);
  }
  if (unit) {
    values.push(unit);
    updates.push(`unit = $${values.length}`);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }

  query += updates.join(', ') + ` WHERE id = $${values.length + 1} RETURNING *`;
  values.push(productId);

  try {
    const result = await prod.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const updatedProduct = result.rows[0];
    res.json(updatedProduct);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Error updating product');
  }
});


// DELETE a specific product by providing the product id
app.delete("/products/:id", async (req, res) => {
  const productId = parseInt(req.params.id);

  try {
    const result = await prod.query('DELETE FROM products WHERE id = $1 RETURNING *', [productId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product deleted", product: result.rows[0] });
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Error deleting product');
  }
});


app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});
