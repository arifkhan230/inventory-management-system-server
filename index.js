const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;


// middleware
app.use(cors())
app.use(express.json())


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

        const usersCollection = client.db('inventoryDb').collection('users')
        const shopCollection = client.db('inventoryDb').collection('shops')
        const productCollection = client.db('inventoryDb').collection('products')

        // users related api
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

        app.patch('/users/manager/:email', async (req, res) => {
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

        app.get('/shops/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await shopCollection.findOne(query);
            console.log("-------------------------------------", result)
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
                $set:{
                    limit: parseInt(updateLimit) - 1
                }
            }
            console.log(updateLimit)
            const result = await shopCollection.updateOne(query, updateDoc)
            res.send(result)
        })


        // product related api 

        app.post("/shopProduct", async (req, res) => {
            const bodyInfo = req.body;
            const result = await productCollection.insertOne(bodyInfo)
            res.send(result)
        })

        app.get("/shopProduct/:email", async(req,res)=>{
            const email = req.params.email;
            const query = {email: email};
            const result = await productCollection.find(query).toArray();
            res.send(result)
        })

        app.get("/singleProduct/:id", async(req,res)=>{
            const id = req.params.id;
            console.log("single id---------------------",id)
            const query = {_id: new ObjectId(id)};
            const result = await productCollection.findOne(query);
            res.send(result)
        })

        app.patch('/updateProduct/:id',async(req,res)=>{
            const id = req.params.id;
            const updateProduct = req.body;
            const query = {_id: new ObjectId(id)}
            const updateDoc={
                $set:{
                    ...updateProduct
                }
            }
            const result = await productCollection.updateOne(query,updateDoc);
            res.send(result)
        })

        app.delete('/shopProduct/:id', async(req,res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await productCollection.deleteOne(query);
            res.send(result)
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