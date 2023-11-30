const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config()
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.PAYMENT_GATEWAY_SK);
const port = process.env.PORT || 5000;


// middleware
app.use(cors({
    origin: ["http://localhost:5173"],
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())


// console.log(process.env.DB_USER)
// console.log(process.env.DB_PASS)


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cwfli1i.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });

        // middlewares
        const verifyToken = (req, res, next) => {
            const token = req.cookies?.token;
            console.log(token);
            if (!token) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                else {
                    req.decoded = decoded
                    next()
                }
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'access forbidden' })
            }
            next()
        }


        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.SECRET_ACCESS_TOKEN, { expiresIn: '1h' })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production" ? true : false,
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict"
                })
                .send({ success: true })
        })

        app.post('/logout', async (req, res) => {
            const user = req.user;
            console.log(user)
            res.clearCookie('token', {
                maxAge: 0,
                secure: process.env.NODE_ENV === "production" ? true : false,
                sameSite: process.NODE_ENV === "production" ? "none" : "strict"
            }).send({ success: true })
        })




        const usersCollection = client.db('inventoryDb').collection('users')
        const shopCollection = client.db('inventoryDb').collection('shops')
        const productCollection = client.db('inventoryDb').collection('products')
        const cartCollection = client.db('inventoryDb').collection('carts')
        const salesCollection = client.db('inventoryDb').collection('sales')
        const paymentCollection = client.db('inventoryDb').collection('payments')

        // users related api

        // getting all users

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const page = req.query.page;
            const pageNumber = parseInt(page);
            const perPage = 5;
            const skip = pageNumber * perPage;

            const result = await usersCollection.find().skip(skip).limit(perPage).toArray();
            const count = await usersCollection.estimatedDocumentCount()
            res.send({ result, count })
        })

        // getting admin data
        app.get('/users/systemAdmin/:email',async(req,res)=>{
            const email = req.params.email;
            const query = {email:email};
            const result = await usersCollection.findOne(query);
            res.send(result)
        })

        // verifying admin
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);

            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin });
        })




        app.get('/users/isManager/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            // TODO: verify with token
            const query = { email: email };
            const user = await usersCollection.findOne(query);

            let manager = false;
            if (user) {
                manager = user?.role === 'manager'
            }
            res.send({ manager });
        })


        // getting single user

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            console.log(query)
            const result = await usersCollection.findOne(query);
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            // console.log(user)
            // checking duplicate email
            const query = { email: user.email }
            const isExist = await usersCollection.findOne(query);
            if (isExist) {
                return res.send({ message: 'user already exist', insertedId: null })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

        app.patch('/users/manager/:email', verifyToken, async (req, res) => {
            const managerInfo = req.body;
            const email = req.params.email;
            const query = { email: email }
            console.log(query);
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    shopName: managerInfo.shopName,
                    shopLogo: managerInfo.shopLogo,
                    shopId: managerInfo.shopId,
                    role: managerInfo.role
                }
            }
            console.log(updateDoc)
            const result = await usersCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })

        // shop related api

        app.get('/shops/:email',verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await shopCollection.findOne(query);
            res.send(result)
        })

        app.get('/shops', verifyToken, verifyAdmin, async (req, res) => {
            const result = await shopCollection.find().toArray()
            res.send(result)
        })


        app.post('/shops', async (req, res) => {
            const shopData = req.body;
            // console.log(shopData)
            const query = { email: shopData.email }
            // console.log(query)
            const isExist = await shopCollection.findOne(query)
            if (isExist) {
                return res.send({ message: "You Can Create Only One Shop" })
            }
            // console.log(shopData)
            const updatedShopData = { ...shopData, limit: 3 }
            const shopResult = await shopCollection.insertOne(updatedShopData)
            res.send(shopResult)
        })

        app.patch('/updateLimit/:email', async (req, res) => {
            const updateLimit = req.body.limit;
            const email = req.params.email;
            const query = { email: email }
            console.log(query)
            const updateDoc = {
                $set: {
                    limit: parseInt(updateLimit) - 1
                }
            }
            console.log(updateLimit)
            const result = await shopCollection.updateOne(query, updateDoc)
            res.send(result)
        })


        // product related api 

        // getting all products
        app.get('/allProducts', async (req, res) => {
            const result = await productCollection.find().toArray();
            res.send(result)
        })

        app.post("/shopProduct", async (req, res) => {
            const bodyInfo = req.body;
            const result = await productCollection.insertOne(bodyInfo)
            res.send(result)
        })

        app.get("/shopProduct/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await productCollection.find(query).toArray();
            res.send(result)
        })

        app.get("/singleProduct/:id", async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { _id: new ObjectId(id) };
            console.log(query)
            const result = await productCollection.findOne(query);
            res.send(result)
        })

        app.patch('/updateProduct/:id', async (req, res) => {
            const id = req.params.id;
            const updateProduct = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...updateProduct
                }
            }
            const result = await productCollection.updateOne(query, updateDoc);
            res.send(result)
        })

        app.patch('/product/:id', async (req, res) => {
            const id = req.params.id;
            const updateProduct = req.body;
            const query = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    quantity: parseInt(updateProduct?.quantity),
                    saleCount: parseInt(updateProduct?.saleCount)
                }
            }
            const result = await productCollection.updateOne(query, updateDoc, options);
            res.send(result)
        })

        app.patch('/shop-update-quantity/:id',async(req,res)=>{
            const id = req.params.id;
            const newLimit = req.body;
            const query = {_id: new ObjectId(id)}
            const options= {upsert: true};
            const updateDoc = {
                $set:{
                    limit: parseInt(newLimit.limit)
                }
            }
            const result = await shopCollection.updateOne(query,updateDoc,options);
            res.send(result)
        })

        app.delete('/shopProduct/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await productCollection.deleteOne(query);
            res.send(result)
        })

        // cart related api 
        app.post('/addToCart', async (req, res) => {
            const cartData = req.body;
            // console.log(cartData);
            const result = await cartCollection.insertOne(cartData);
            res.send(result)
        })

        app.get('/cartProducts/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result)
        })

        // sales related api

        // getting all the sales data

        app.get('/allSales',verifyToken,verifyAdmin, async (req, res) => {
            const result = await salesCollection.find().toArray();
            res.send(result);
        })

        app.get('/manager/salesProduct', async (req, res) => {
            const email = req.query.email;
            const page = parseInt(req.query.page);
            const limit = 5 ;
            const skip = page  * 5
            console.log(page);
            let query = {}
            if (email) {
                query = { email: email }
            }
            console.log(query);
            const totalSales = await salesCollection.countDocuments(query);
            const result = await salesCollection.find(query).sort({soldDate: -1}).skip(skip).limit(limit).toArray();
            
            res.send({result,totalSales})

            
        })

        app.post('/salesProduct', async (req, res) => {
            const product = req.body;
            const result = await salesCollection.insertOne(product);
            res.send(result)
        })

        app.delete('/sold-product-delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result)
        })

        // payment intent

        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100)
            console.log(amount, "Price amount in the backend");

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        // after doing payment

        app.put("/payment", async (req, res) => {
            const item = req.body;
            const result = await paymentCollection.insertOne(item);
            res.send(result)
        })

        app.patch('/newProductLimit/:email', async (req, res) => {
            const email = req.params.email;
            const newProductLimit = req.body;
            const query = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    limit: newProductLimit.newProductLimit
                }
            }
            const result = await shopCollection.updateOne(query, updateDoc, options);
            res.send(result)
        })

        app.patch("/system-admin-income", async (req, res) => {
            const price = parseInt(req.query.price);
            const query = { role: "admin" };
            const result = await usersCollection.findOne(query);
            const income = result?.income + price;
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    income: income
                }
            }
            const adminIncome = await usersCollection.updateOne(query, updateDoc, options);
            res.send(adminIncome)
        })


        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})