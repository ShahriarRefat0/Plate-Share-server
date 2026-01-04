require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//middle ware
app.use(
  cors({
    origin: [
      "https://plate-share-client-nu.vercel.app",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);
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
    // await client.connect();
    //DB collections
    const plateShareDb = client.db("plate-share-db");
    const foodsCollections = plateShareDb.collection("foods");
    const foodRequestCollections = plateShareDb.collection("food-request");
    //apis here
    app.get("/foods", async (req, res) => {
      try {
        const {
          limit = 8,
          skip = 0,
          status,
          sort = "expire_date",
          order = "desc",
          search = "",
        } = req.query;

        const query = {};

        // ✅ Status filter (Available / Donated)
        if (status) {
          query.food_status = status.charAt(0).toUpperCase() + status.slice(1);
        }

        // ✅ Live Search (food name, location, donor)
        if (search) {
          query.$or = [
            { food_name: { $regex: search, $options: "i" } },
            { pickup_location: { $regex: search, $options: "i" } },
            { "donator.name": { $regex: search, $options: "i" } },
          ];
        }

        // ✅ Sorting
        const sortOption = {
          [sort]: order === "asc" ? 1 : -1,
        };

        // ✅ Fetch foods
        const foods = await foodsCollections
          .find(query)
          .sort(sortOption)
          .skip(Number(skip))
          .limit(Number(limit))
          .project({ additional_notes: 0, "donator.email": 0 })
          .toArray();

        // ✅ Count for pagination
        const total = await foodsCollections.countDocuments(query);

        res.send({ foods, total });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    app.get("/highest-quantity-foods", async (req, res) => {
      const query = { food_status: "Available" };
      const result = await foodsCollections
        .find(query)
        .sort({ food_quantity: -1 })
        .limit(8)
        .toArray();
      res.send(result);
    });

    app.get(`/foods/:id`, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodsCollections.findOne(query);
      res.send(result);
    });

    app.post("/foods", async (req, res) => {
      const newFood = req.body;
      const result = await foodsCollections.insertOne(newFood);
      //console.log(result);
      res.send(result);
    });

    //get food by user email
    app.get("/my-foods", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { "donator.email": email };
      }
      const result = await foodsCollections.find(query).toArray();
      res.send(result);
    });

    //update food info
    app.put("/update-food/:id", async (req, res) => {
      const id = req.params.id;
      const updatedFood = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          food_name: updatedFood.food_name,
          food_image: updatedFood.food_image,
          food_quantity: updatedFood.food_quantity,
          pickup_location: updatedFood.pickup_location,
          expire_date: updatedFood.expire_date,
          additional_notes: updatedFood.additional_notes,
          donator: updatedFood.donator,
          food_status: updatedFood.food_status,
        },
      };
      const result = await foodsCollections.updateOne(query, update);
      console.log(result);
      res.send(result);
    });

    //delete food
    app.delete(`/delete-food/:id`, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodsCollections.deleteOne(query);
      res.send(result);
    });

    //request food
    app.post("/food-request", async (req, res) => {
      const reqInfo = req.body;
      const result = await foodRequestCollections.insertOne(reqInfo);
      res.send(result);
    });

    app.get(`/food-request`, async (req, res) => {
      const req_foodId = req.query.req_foodId;
      const donator_email = req.query.donator_email;

      let query = {};
      if (req_foodId && donator_email) {
        query = { req_foodId: req_foodId, donator_email: donator_email };
      }

      const result = await foodRequestCollections.find(query).toArray();
      res.send(result);
    });

    //request status api
    app.put("/update-request/:id", async (req, res) => {
      const id = req.params.id;
      const { foodId, status } = req.body;

      const result = await foodRequestCollections.updateOne(
        { _id: new ObjectId(id) },
        { $set: { req_status: status } }
      );

      if (status === "Accepted") {
        await foodsCollections.updateOne(
          { _id: new ObjectId(foodId) },
          { $set: { food_status: "Donated" } }
        );
      }

      res.send(result);
    });

    //my food requests
    app.get("/user-food-request", async (req, res) => {
      const userEmail = req.query.user;
      let query = {};
      if (userEmail) {
        query = { req_email: userEmail };
      }
      const result = await foodRequestCollections.find(query).toArray();
      res.send(result);
    });

    //delete food request
    app.delete(`/delete-request-food/:id`, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodRequestCollections.deleteOne(query);
      res.send(result);
    });

    //dashboard api
    // app.get("/dashboard/summary", async (req, res) => {
    //   try {
    //     const email = req.query.email;
    //     if (!email) return res.status(400).send({ error: "Email required" });

    //     const totalFoods = await foodsCollections.countDocuments({
    //       "donator.email": email,
    //     });

    //     const activeFoods = await foodsCollections.countDocuments({
    //       "donator.email": email,
    //       food_status: "Available",
    //     });

    //     const donatedFoods = await foodsCollections.countDocuments({
    //       "donator.email": email,
    //       food_status: "Donated",
    //     });

    //     const totalRequests = await foodRequestCollections.countDocuments({
    //       donator_email: email,
    //     });

    //     res.send({
    //       totalFoods,
    //       activeFoods,
    //       donatedFoods,
    //       totalRequests,
    //     });
    //   } catch (err) {
    //     res.status(500).send({ error: "Dashboard summary failed" });
    //   }
    // });

    //     app.get("/dashboard/food-activity", async (req, res) => {
    //       try {
    //         const email = req.query.email;

    //         const result = await foodsCollections
    //           .aggregate([
    //             { $match: { "donator.email": email } },
    //             {
    //               $group: {
    //                 _id: {
    //                   $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
    //                 },
    //                 foods: { $sum: 1 },
    //               },
    //             },
    //             { $sort: { _id: 1 } },
    //             { $limit: 7 },
    //           ])
    //           .toArray();

    //         res.send(result);
    //       } catch (err) {
    //         res.status(500).send({ error: "Food activity failed" });
    //       }
    //     });

    //     app.get("/dashboard/request-status", async (req, res) => {
    //       try {
    //         const email = req.query.email;

    //         const result = await foodRequestCollections
    //           .aggregate([
    //             { $match: { donator_email: email } },
    //             {
    //               $group: {
    //                 _id: "$req_status",
    //                 value: { $sum: 1 },
    //               },
    //             },
    //           ])
    //           .toArray();

    //         res.send(result);
    //       } catch (err) {
    //         res.status(500).send({ error: "Request status failed" });
    //       }
    //     });

    //     app.get("/dashboard/recent-requests", async (req, res) => {
    //       try {
    //         const email = req.query.email;

    //         const result = await foodRequestCollections
    //           .find({ donator_email: email })
    //           .sort({ _id: -1 })
    //           .limit(5)
    //           .toArray();

    //         res.send(result);
    //       } catch (err) {
    //         res.status(500).send({ error: "Recent requests failed" });
    //       }
    //     });

    //dashboard api - FIXED VERSION
    app.get("/dashboard/summary", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) return res.status(400).send({ error: "Email required" });

        const totalFoods = await foodsCollections.countDocuments({
          "donator.email": email,
        });

        const activeFoods = await foodsCollections.countDocuments({
          "donator.email": email,
          food_status: "Available",
        });

        const donatedFoods = await foodsCollections.countDocuments({
          "donator.email": email,
          food_status: "Donated",
        });

        const totalRequests = await foodRequestCollections.countDocuments({
          donator_email: email,
        });
        
        console.log("Dashboard Summary:", {
          totalFoods,
          activeFoods,
          donatedFoods,
          totalRequests,
        });

        res.send({
          totalFoods,
          activeFoods,
          donatedFoods,
          totalRequests,
        });
      } catch (err) {
        console.error("Dashboard summary error:", err);
        res
          .status(500)
          .send({ error: "Dashboard summary failed", details: err.message });
      }
    });

    app.get("/dashboard/food-activity", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) return res.status(400).send({ error: "Email required" });

        // Check if createdAt field exists, if not use alternative approach
        const sampleDoc = await foodsCollections.findOne({
          "donator.email": email,
        });

        if (!sampleDoc || !sampleDoc.createdAt) {
          // Fallback: return dummy data or use _id timestamp
          const result = await foodsCollections
            .aggregate([
              { $match: { "donator.email": email } },
              {
                $addFields: {
                  dateFromId: { $toDate: "$_id" },
                },
              },
              {
                $group: {
                  _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$dateFromId" },
                  },
                  foods: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
              { $limit: 7 },
            ])
            .toArray();

          console.log("Food Activity (from _id):", result);
          return res.send(result);
        }

        // If createdAt exists, ensure it's a Date object
        const result = await foodsCollections
          .aggregate([
            { $match: { "donator.email": email } },
            {
              $addFields: {
                createdAtDate: {
                  $cond: {
                    if: { $eq: [{ $type: "$createdAt" }, "string"] },
                    then: { $toDate: "$createdAt" },
                    else: "$createdAt",
                  },
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAtDate" },
                },
                foods: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $limit: 7 },
          ])
          .toArray();

        console.log("Food Activity:", result);
        res.send(result);
      } catch (err) {
        console.error("Food activity error:", err);
        res
          .status(500)
          .send({ error: "Food activity failed", details: err.message });
      }
    });

    app.get("/dashboard/request-status", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) return res.status(400).send({ error: "Email required" });

        const result = await foodRequestCollections
          .aggregate([
            { $match: { donator_email: email } },
            {
              $group: {
                _id: "$req_status",
                value: { $sum: 1 },
              },
            },
          ])
          .toArray();

        console.log("Request Status:", result);
        res.send(result);
      } catch (err) {
        console.error("Request status error:", err);
        res
          .status(500)
          .send({ error: "Request status failed", details: err.message });
      }
    });

    app.get("/dashboard/recent-requests", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) return res.status(400).send({ error: "Email required" });

        const result = await foodRequestCollections
          .find({ donator_email: email })
          .sort({ _id: -1 })
          .limit(5)
          .toArray();

        console.log("Recent Requests:", result);
        res.send(result);
      } catch (err) {
        console.error("Recent requests error:", err);
        res
          .status(500)
          .send({ error: "Recent requests failed", details: err.message });
      }
    });

    //await client.db("admin").command({ ping: 1 });
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
