import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";
import axios from 'axios';
const app = express();
const port = 3000;
const saltRounds = 10;
const API_URL = "http://localhost:4000";
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(bodyParser.json());

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
//db.connect();
db.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Connected to the database 3000');
});

let items = [
  {  },
];

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/tobuy", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM items ORDER BY id ASC");
    items = result.rows;

    res.render("tobuy.ejs", {
      listTitle: "To buy",
      listItems: items,
    });
  } catch (err) {
    console.log(err);
  }
});
// Route to render the inventory page
app.get("/inventory", async (req, res) => {
  
  console.log(req.user);
  if (req.isAuthenticated()) {
    try{
      console.log("before sql");

  const response = await axios.get(`${API_URL}/products`);
  console.log("after");

  console.log(response);
  res.render("inventory.ejs", { products: response.data });
  }
 catch (error) {
  res.status(500).json({ message: "Error fetching products" });
}
}
  else{
    res.redirect("/login");
  }


});
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/inventory",
    failureRedirect: "/login",
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      res.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/inventory");
          });
        }
      });
    }
  } catch (err) {
    
    console.log(err);
  }
});

// Route to render the create page
app.get("/new", (req, res) => {

  if (req.isAuthenticated()) {

  res.render("modify.ejs", { heading: "New Product", submit: "Create" });
  }
  else{
    res.redirect("/login");
  }
}
);
// Route to render the edit page
app.get("/edit/:id", async (req, res) => {
  if (req.isAuthenticated()) {
  try {
    const response = await axios.get(`${API_URL}/products/${req.params.id}`);
    console.log(response.data);
    res.render("modify.ejs", {
      heading: "Edit Product",
      submit: "Update Product",
      product: response.data,
    });

    
  } catch (error) {
    res.status(500).json({ message: "Error fetching product" });
  }

}
else{
  res.redirect("/login");
}
});

// Create a new product
app.post("/api/products", async (req, res) => {
  if (req.isAuthenticated()) {
  try {
    const response = await axios.post(`${API_URL}/products`, req.body);
    console.log(response.data);
    res.redirect("/inventory");
  } catch (error) {
    res.status(500).json({ message: "Error creating product" });
  }
  
}
else{
  res.redirect("/login");
}
});

// Partially update a product
app.post("/api/products/:id", async (req, res) => {
  //console.log("called");
  if (req.isAuthenticated()) {
  try {
    const response = await axios.patch(
      `${API_URL}/products/${req.params.id}`,
      req.body
    );
    console.log("after patch");
    console.log(response.data);
    res.redirect("/inventory");
  } catch (error) {
    res.status(500).json({ message: "Error updating product" });
  }
  
}
else{
  res.redirect("/login");
}
});

// Delete a product
app.get("/api/products/delete/:id", async (req, res) => {
  
  if (req.isAuthenticated()) {
  try {
    await axios.delete(`${API_URL}/products/${req.params.id}`);
    res.redirect("/inventory");
  } catch (error) {
    res.status(500).json({ message: "Error deleting product" });
  }

}
else{
  res.redirect("/login");
}
});

//tobuy


app.post("/tobuy/add", async (req, res) => {
  const item = req.body.newItem;
  // items.push({title: item});
  try {
    await db.query("INSERT INTO items (title) VALUES ($1)", [item]);
    res.redirect("/tobuy");
  } catch (err) {
    console.log(err);
  }
});

app.post("/tobuy/edit", async (req, res) => {
  const item = req.body.updatedItemTitle;
  const id = req.body.updatedItemId;

  try {
    await db.query("UPDATE items SET title = ($1) WHERE id = $2", [item, id]);
    res.redirect("/tobuy");
  } catch (err) {
    console.log(err);
  }
});

app.post("/tobuy/delete", async (req, res) => {
  const id = req.body.deleteItemId;
  try {
    await db.query("DELETE FROM items WHERE id = $1", [id]);
    res.redirect("/tobuy");
  } catch (err) {
    console.log(err);
  }
});



passport.use(
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            //Error with password check
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              //Passed password check
              return cb(null, user);
            } else {
              //Did not pass password check
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
