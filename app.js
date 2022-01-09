const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cors = require("cors");

app.use(express.json());
app.use(cors());

let db = null;
const dbPath = path.join(__dirname, "financepeer.db");
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    console.log(process.env.PORT);
    app.listen(process.env.PORT || 3004, () => {
      console.log("server is running http://localhost3004/");
    });
  } catch (e) {
    console.log(`DB ERROR ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

// Middleware function

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "udaykiran", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// API 1

app.post("/register/", async (request, response) => {
  const { username, name, password, gender, city } = request.body;
  const hashPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
    select * from user 
    where 
    username = "${username}";`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length >= 6) {
      const createUser = `
           INSERT INTO user 
           (username,name,password,gender,city) 
           values (
            "${username}",
             "${name}",
             "${hashPassword}",
             "${gender}",
             "${city}");`;
      const createQuery = await db.run(createUser);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getLoginQuery = `
    select * from user 
    where 
    username = "${username}";`;
  const dbData = await db.get(getLoginQuery);
  if (dbData === undefined) {
    response.status(400);

    response.send({ error_msg: "Invalid user" });
  } else {
    const isPasswordEqual = await bcrypt.compare(password, dbData.password);
    if (isPasswordEqual === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "udaykiran");
      response.send({ jwt_token: jwtToken });
    } else {
      response.status(400);
      response.send({ error_msg: "Invalid password" });
    }
  }
});

//API 3
app.post("/data", authenticateToken, async (request, response) => {
  try {
    const dataDetails = request.body;

    const values = dataDetails.map(
      (eachDataId) =>
        `(${eachDataId.user_id}, ${eachDataId.id}, '${eachDataId.title}','${eachDataId.body}')`
    );

    const valuesString = values.join(",");

    const addDataQuery = `
    INSERT INTO
      userdata (user_id,id,title,body)
    VALUES
       ${valuesString};`;

    const dbResponse = await db.run(addDataQuery);
    response.send("Uploaded successfully");
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    response.send("Uploading Failed");
  }
});

// get post  userdata

const convertDataDetailsToObjectDetails = (dataDetails) => {
  return dataDetails.map((each) => ({
    userId: each.user_id,
    id: each.id,
    title: each.title,
    body: each.body,
  }));
};

app.get("/posts", async (request, response) => {
  const selectQuery = `SELECT * FROM userdata;`;
  const dataDetails = await db.all(selectQuery);
  console.log(dataDetails);
  response.send(convertDataDetailsToObjectDetails(dataDetails));
});

// delete data

app.delete("/data", async (request, response) => {
  try {
    const deleteQuery = `DELETE FROM userdata;`;
    const deleteResponse = await db.run(deleteQuery);
    response.send("Deleted");
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    response.send("Delete Failed");
  }
});

module.exports = app;
