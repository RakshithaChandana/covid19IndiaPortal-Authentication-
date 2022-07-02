const express = require("express");
const app = express();
app.use(express.json());

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

//API 1

function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "fgthsdhjsbfd", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username="${username}";`;
  const dbUser = await database.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordValid = await bcrypt.compare(password, dbUser.password);
    if (isPasswordValid === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "fgthsdhjsbfd");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
//Return all list of states from states table

const convertDBToObjectAPI1 = (objectItem) => {
  return {
    stateId: objectItem.state_id,
    stateName: objectItem.state_name,
    population: objectItem.population,
  };
};

app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state;`;
  const getStatesQueryResponse = await database.all(getStatesQuery);
  response.send(
    getStatesQueryResponse.map((item) => convertDBToObjectAPI1(item))
  );
});

//API 3
//Return state based on stateId from states table
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT * FROM state WHERE state_id="${stateId}";`;
  const getStateQueryResponse = await database.get(getStateQuery);
  response.send(convertDBToObjectAPI1(getStateQueryResponse));
});

//API 4
//post a state into database
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
    INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
    VALUES ("${districtName}", "${stateId}","${cases}","${cured}","${active}","${deaths}");`;
  await database.run(postDistrictQuery);
  response.send("District Successfully Added");
});

//API 5
//Return list of districts based on districtID
const convertDbObjectAPI4 = (objectItem) => {
  return {
    districtId: objectItem.district_id,
    districtName: objectItem.district_name,
    stateId: objectItem.state_id,
    cases: objectItem.cases,
    cured: objectItem.cured,
    active: objectItem.active,
    deaths: objectItem.deaths,
  };
};
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT * FROM district WHERE district_id="${districtId}";`;
    const getDistrictQueryResponse = await database.get(getDistrictQuery);
    response.send(convertDbObjectAPI4(getDistrictQueryResponse));
  }
);

//API 6
//Deletes a district from the district table based on the districtId
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district
    WHERE district_id="${districtId}";`;
    await database.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7
//Updates the details of a specific district based on districtId
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictsQuery = `
    UPDATE district 
    SET district_name="${districtName}",
        state_id="${stateId}",
        cases="${cases}",
        cured="${cured}",
        active="${active}",
        deaths="${deaths}"
    WHERE district_id="${districtId}";`;
    await database.run(updateDistrictsQuery);
    response.send("District Details Updated");
  }
);

//API 8
//Returns the statistics of total cases, cured,active,deaths of a specific state based on stated  }
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const stats = await database.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);
module.exports = app;
