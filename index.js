const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
 const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const port = process.env.PORT || 3000
const app = express()


const corsOptions = {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174'
    ],
    credentials: true,
    optionSuccessStatus: 200,
  }
  app.use(cors(corsOptions))
  app.use(express.json())
  app.use(cookieParser())


  const verifyToken = (req, res, next) => {
    const token = req.cookies?.token
    if (!token) return res.status(401).send({ message: 'unauthorized access' })
    if (token) {
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          console.log(err)
          return res.status(401).send({ message: 'unauthorized access' })
        }
        console.log(decoded)
  
        req.user = decoded
        next()
      })
    }
  }


  const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dsubcfq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
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
       
      
      const jobsCollection = client.db('jobDB').collection('job')
      const applyJobsCollection = client.db('jobDB').collection('applyJobs')
      
  
      // jwt generating
      app.post('/jwt', async (req, res) => {
        const email = req.body
        const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: '2h',
        })
        res
          .cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
      })
  
      // Clear  the token when logout
      app.get('/logout', (req, res) => {

        res
          .clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 0,
          })
          .send({ success: true })
      })

      app.get('/jobs', async (req, res) => {

        const result = await jobsCollection.find().toArray()
  
        res.send(result)
      })

       // Get a single job data from db using job id
      app.get('/jobs/:id', async (req, res) => {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await jobsCollection.findOne(query)
        res.send(result)
       })  

       // Get all jobs data from db for pagination and filtering search and sorting 
        app.get('/allJobs', async (req, res) => {
        const size = parseInt(req.query.size)
        const page = parseInt(req.query.page) - 1
        const filter = req.query.filter
        const sort = req.query.sort
        const search = req.query.search
        
  
        let query = {
          job_title: { $regex:'^' + search, $options: 'i' },
        }
        if (filter) query.job_category = filter
        let options = {}
        if (sort) options = { sort: { application_deadline: sort === 'asc' ? 1 : -1 } }
        const result = await jobsCollection
          .find(query, options)
          .skip(page * size)
          .limit(size)
          .toArray()
  
        res.send(result)
      })

          // Get all jobs data count from db
        app.get('/jobsCount', async (req, res) => {
        const filter = req.query.filter
        const search = req.query.search
        let query = {
          job_title: { $regex: '^' + search, $options: 'i' },
        }
        if (filter) query.job_category = filter
        const count = await jobsCollection.countDocuments(query)
  
        res.send({ count })
       })

       //adding job
       app.post('/job', async (req, res) => {
        const singleJobData = req.body
  
        const result = await jobsCollection.insertOne(singleJobData)
        res.send(result)
      })


       // Save a applied job data in db
    app.post('/apply', async (req, res) => {
        const applyData = req.body
  
        // check if its a duplicate request
        const query = {
          'applicant.email': applyData.applicant.email,
          applyJobId: applyData.applyJobId,
        }
        const alreadyApplied = await applyJobsCollection.findOne(query)

        
         console.log(alreadyApplied);
        if (alreadyApplied) {
          return res
            .status(400)
            .send('You have already applied for this job.')
        }
  
        const result = await applyJobsCollection.insertOne(applyData)
         console.log(applyData);
  
        // update job count in jobs collection
        const updateDoc = {
          $inc: { job_applicants_number: 1 },
        }
        console.log(applyData.applyJobId);
        const jobQuery = { _id: new ObjectId(applyData.applyJobId) }
        const updateBidCount = await jobsCollection.updateOne(jobQuery, updateDoc)
        console.log(updateBidCount);
        res.send(result)
      })

          // get all jobs posted by a specific user
        app.get('/jobs/:email', verifyToken, async (req, res) => {
        const tokenEmail = req.user.email
        const email = req.params.email
        if (tokenEmail !== email) {
          return res.status(403).send({ message: 'forbidden access' })
        }
        const query = { 'buyer.email': email }
        const result = await jobsCollection.find(query).toArray()
        res.send(result)
      })



 


  
    
  
     
  
      // Send a ping to confirm a successful connection
     //await client.db('admin').command({ ping: 1 })
      console.log(
        'Pinged your deployment. You successfully connected to MongoDB!'
      )
    } finally {
      // Ensures that the client will close when you finish/error
    }
  }
  run().catch(console.dir)





  app.get('/', (req, res) => {
    res.send('server is working ....')
  })
  
  app.listen(port, () => console.log(`Server running on port ${port}`))