require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion } = require("mongodb");

//middle ware
app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Food Share Server is running");
});

async function run() {
  try {
    await client.connect();
    //DB collections
    const plateShareDb = client.db("plate-share-db");
    const foodsCollections = plateShareDb.collection("foods");

    app.get("/foods", async (req, res) => {
      const status = req.query.status;

      const query = status ? { food_status: "Available" } : {};
      const result = await foodsCollections.find(query).toArray();
      // console.log(result);
      res.send(result);
    });
    
    app.get('/highest-quantity-foods', async (req, res) => {
      const query = { food_status: "Available" };
      const result = await foodsCollections
        .find(query)
        .sort({ food_quantity: -1 })
        .limit(6)
        .toArray();
      res.send(result)
    })

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
