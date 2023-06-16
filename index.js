const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

const app = express();
require("dotenv").config();


const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);


const nodemailer = require("nodemailer");
const mg = require('nodemailer-mailgun-transport');

// trial attempted with sendGrid

// let transporter = nodemailer.createTransport({
//   host: 'smtp.sendgrid.net',
//   port: 587,
//   auth: {
//       user: "apikey",
//       pass: process.env.SENDGRID_API_KEY
//   }
// })

const auth = {
  auth: {
    api_key: process.env.EMAIL_PRIVATE_KEY,
    domain: process.env.EMAIL_DOMAIN
  }
}

const transporter = nodemailer.createTransport(mg(auth));


// send payment confirmation email
const sendPaymentConfirmationEmail = payment => {
  transporter.sendMail({
    from: "sayed91515@gmail.com", // verified sender email
    to: "sayed91515@gmail.com", // recipient email
    subject: "Your order is confirmed!", // Subject line
    text: "Hello world!", // plain text body
    html: `
    <div>
      <h2>Payment Confirmed!!</h2>
      <p>Transaction ID: ${payment.transactionID}</p>
    </div>
    `, // html body
  }, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}


// middleware
app.use(cors());
app.use(express.json());


// creating a custom middleware function for JWT purpose
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access!" });
  }
  // extracting token from authorization code (without bearer)
  const token = authorization.split(" ")[1];
  console.log("authorization token inside JWT", token);

  // verification
  jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access!" });
    }
    req.decoded = decoded;
    next();
  });
};


const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.BD_PASS}@cluster0.ebwgrc3.mongodb.net/?retryWrites=true&w=majority`;
// const uri = "mongodb+srv://<username>:<password>@cluster0.ebwgrc3.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("bistroDB").collection("users");
    const menuCollection = client.db("bistroDB").collection("menu");
    const reviewCollection = client.db("bistroDB").collection("reviews");
    const cartCollection = client.db("bistroDB").collection("carts");
    const paymentCollection = client.db("bistroDB").collection("payments");





    // JWT operation
    app.post("/jwt", (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.SECRET_ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      // console.log(token);
      res.send({ token });
    });


    // middleware for admin checking.
    const verifyAdmin = async (req, res, next) => {
      const adminCheckEmail = req.decoded.email;
      const query = { email: adminCheckEmail };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        res.status(403).send({ error: true, message: "forbidden message" });
      }
      next();
    };





    // user related API

    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      // console.log(user);

      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      console.log("already existing user:", existingUser);

      if (existingUser) {
        return res.send({ message: "user already exists.." });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });





    // admin related APIs

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const adminEmail = req.params.email;

      if (req.decoded.email !== adminEmail) {
        res.status(402).send({ error: true, message: "unauthorized Access" });
      }

      const query = { email: adminEmail };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });





    // menu related API

    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.post("/menu", verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    });

    app.delete("/menu:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });





    // reviews related API

    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });





    // cart collection CRUD operation

    app.get("/carts", verifyJWT, async (req, res) => {
      const userEmail = req.query.email;
      if (!userEmail) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (decodedEmail !== userEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access!" });
      }

      const query = { email: userEmail };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const item = req.body;
      // console.log(item);
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const itemID = req.params.id;
      const query = { _id: new ObjectId(itemID) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });





    // create payment intent

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: price * 100,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });


    
    // payment related API

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: { $in: payment.cartItems.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await cartCollection.deleteMany(query);

      // send an email confirming payment
      console.log(payment);
      sendPaymentConfirmationEmail(payment);


      res.send({ insertResult, deleteResult });
    });





    // API to get stats data
    app.get("/admin-stats", verifyJWT, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const products = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      // best way to get sum of the price field is to use group & sum operator ---
          const payments = await paymentCollection
            .aggregate([
              {
                $group: {
                  _id: null,
                  total: { $sum: "$price" },
                },
              },
            ])
            .toArray();
            const revenue = payments[0].total;


      // and, here is the simple version using reduce function ---
          // const payments = await paymentCollection.find().toArray();
          // const revenue = payments.reduce( (sum, paymentRecordItem) => sum + paymentRecordItem.price , 0)

      res.send({ users, products, orders, revenue });
    });



    // More API for stats
    app.get('/orders-stats', verifyJWT, verifyAdmin, async (req, res) => {
      const pipeline = [
        {
          $lookup: {
            from: 'menu',
            localField: 'menuItems',
            foreignField: '_id',
            as: 'menuItemsData',
          },
        },
        {
          $unwind: '$menuItemsData',
        },
        {
          $group: {
            _id: '$menuItemsData.category',
            count: { $sum: 1 },
            total: { $sum: '$menuItemsData.price' },
          },
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            total: { $round: ['$total', 2] },
            _id: 0,
          },
        },
      ];

      const result = await paymentCollection.aggregate(pipeline).toArray();
      res.send(result)
    });



    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("boss is serving at bistro restaurant");
});

app.listen(port, () => {
  console.log(`boss is running at ${port} kmp server`);
});
