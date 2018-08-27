const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
const Schema = mongoose.Schema;
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/exercise-track' )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const exerciseSchema = new Schema({
  description: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true
  }
}, { _id: false });

const exerciseLogSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  exercises: [exerciseSchema]
}, { usePushEach: true });

const ExerciseLog = mongoose.model('ExerciseLog', exerciseLogSchema);

const createAndSaveUser = function(username, done) {
  var newUser = new ExerciseLog({ username });
  newUser.save((err, data) => {
    if(err) { return done(err); }
    return done(null, data);
  });
};

const findUserByUsername = function(username, done) {
  ExerciseLog.findOne({ username }, (err, user) => {
    if(err) { return done(err); }
    return done(null, user);
  });
};

const findUserThenAddExercise = function(userId, exerciseInfo, done) {
  ExerciseLog.findById({ _id: userId }, (err, user) => {
    if(err) { return done(err); }
    if(!user) { return done({'message': 'User does not exist'}); }
    let exerciseInfoObj = {
      description: exerciseInfo[0],
      duration: exerciseInfo[1],
      date: exerciseInfo[2] ? new Date(exerciseInfo[2]) : Date.now()
    };
    user.exercises.push(exerciseInfoObj);
    user.save((err, data) => {
      if(err) { return done(err); }
      return done(null, data);
    });
  });
};

const getUserExerciseLog = function(userId, queries, done) {
  ExerciseLog.findById({ _id: userId }, (err, user) => {
    if(err) { return done(err); }
    if(!user) { return done({'message': 'User does not exist'}); }
    let exercises = user.exercises;
    
    if(queries.hasOwnProperty('from')) {
      exercises = exercises.filter((exercise) => exercise.date >= queries.from);
    }
    if(queries.hasOwnProperty('to')) {
      exercises = exercises.filter((exercise) => exercise.date <= queries.to);
    }
    return done(null, queries.hasOwnProperty('limit') ? exercises.slice(0, queries.limit) : exercises);
  });
};

app.post('/api/exercise/new-user', (req, res, next) => {
  findUserByUsername(req.body.username, (err, user) => {
    if(err) { return next(err); }
    if(user) {
      res.json({'error': 'Username already exists'});
    } else {
      createAndSaveUser(req.body.username, (err, user) => {
        if(err) { return next(err); }
        res.json({'message': 'User successfully created!', 'new-user': {'username': user.username, 'id': user._id}});
      });
    }
  });
});

app.post('/api/exercise/add', (req, res, next) => {
  if(!req.body.userId || !req.body.description || !req.body.duration) {
    res.json({'error': 'User Id, Description and Duration are required fields'});
  } else {
    findUserThenAddExercise(req.body.userId, [req.body.description, req.body.duration, req.body.date], (err, user) => {
      if(err) { return next(err); }
      res.json({'message': 'Exercise successfully added', 'updatedUser': user.username});
    });
  }
});

app.get('/api/exercise/log', (req, res, next) => {
  console.log(req.query.hasOwnProperty('userId'));
  if(!req.query.hasOwnProperty('userId')) {
    res.json({'error': 'User Id is required to search exercise logs'});
  } else {
    let userId = req.query.userId;
    let queries = {};
    if(req.query.hasOwnProperty('from')) {
      queries.from = new Date(req.query.from);
    }
    if(req.query.hasOwnProperty('to')) {
      queries.to = new Date(req.query.to);
    }
    if(req.query.hasOwnProperty('limit')) {
      queries.limit = req.query.limit;
    }
    getUserExerciseLog(userId, queries, (err, exerciseLog) => {
      if(err) { return next(err); }
      res.json(exerciseLog);
    });
  }
  
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})