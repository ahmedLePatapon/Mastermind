const Express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const app = Express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const { rand } = require('./utilities/choixAleatoire');
const baseRouter = require('./routes');
const { db_user, db_pwd, db_name, port } = require("./config");

app.use('/src_static', Express.static(__dirname + '/src' ));

app.use(cookieParser());

app.use(session({
    secret:'123456789SECRET',
    saveUninitialized : false,
    resave: false
}));

app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({
  extended: false
}));

app.use('/', baseRouter);

var room = [];
var jeu = {};
var joueurs = {};

io.on('connection', function(socket) {
  console.log(room);
  if(room.length === 0) {
    let newRoom = 'room' + room.length;
    room.push(newRoom);
    socket.join(newRoom);
    jeu[newRoom] = {};
    jeu[newRoom][socket.id] = {};
    joueurs[socket.id] = newRoom;
    jeu[joueurs[socket.id]]['joueur1'] = socket.id;
    socket.emit('attente', true);
    socket.on('disconnect', function() {
      socket.leave(newRoom);
    });
  } else {
    for (var i = 0; i < room.length; i++) {
      var verifRoomDisponible = io.sockets.adapter && jeu[joueurs[socket.id]] !== undefined && jeu[joueurs[socket.id]].couleurRandom !== undefined && jeu[joueurs[socket.id]].couleurRandom.rooms[room[i]] !== undefined ? jeu[joueurs[socket.id]].couleurRandom.rooms[room[i]].length : '' ;
      if(verifRoomDisponible === 2) {
        let newRoom = 'room' + room.length;
        room.push(newRoom);
        socket.join(newRoom);
        joueurs[socket.id] = newRoom;
        jeu[newRoom] = {};
        jeu[newRoom][socket.id] = {};
        jeu[newRoom].joueur1 = socket.id;
        socket.on('disconnect', () => socket.leave(newRoom));
        break;
      } else {
        socket.join(room[i]);
        jeu[room[i]][socket.id] = {};
        jeu[room[i]].couleurRandom = rand();
        joueurs[socket.id] = room[i];
        jeu[room[i]].joueur2 = socket.id;
        socket.emit('attente', false);
        socket.on('disconnect', () => socket.leave(room[i]));
        break;
      }
    }
  }

  // console.log('Couleur à trouvé: ', jeu[joueurs[socket.id]].couleurRandom);
  // console.log(joueurs[socket.id]);
  // console.log(jeu[joueurs[socket.id]].joueur2);

  var nbrCoupAdverse = 0;
  var coup = 0;
  socket.on('coup',function(data) {
    console.log('coup ' + data);
    coup = data;
  });
  socket.on('coupAdverse',function(data) {
    console.log('coupadverse ' +data);
    nbrCoupAdverse = data;
  });

  //***************** Comparaison des tableaux *************//
  socket.on('verif', function(verif) {
    verif = verif;
    function compareArray(a1, a2) {
      var combienYaDeBoulesBonnesLorsDeLaComparaison = 0;
      var hintNoir = 0;
      if (a1.length != a2.length) {
        return false;
      } else {
        for (var i = 0; i < a1.length; ++i) {
          if (a1.includes(a2[i]) && a1[i] === a2[i]) {
            hintNoir++;
            socket.emit('noir', combienYaDeBoulesBonnesLorsDeLaComparaison);
            combienYaDeBoulesBonnesLorsDeLaComparaison++;
          }else if(a1.includes(a2[i])){
            socket.emit('gris', combienYaDeBoulesBonnesLorsDeLaComparaison);
            combienYaDeBoulesBonnesLorsDeLaComparaison++;
          }
        }
      }
      if (hintNoir === 4) {
        socket.emit('victoire', true);
      }else {
        socket.emit('essaiEncore', true);
      }
      return true;
    }
    if (jeu[joueurs[socket.id]].couleurRandom !== undefined) {
      compareArray(jeu[joueurs[socket.id]].couleurRandom, verif);
    }
  });
  //***************** fin Comparaison des tableaux *************//

  socket.on('choixAdverse', function(data) {
    socket.broadcast.to(joueurs[socket.id]).emit('reChoixAdverse', data);
  });
  socket.on('finChoix', function(data) {
    socket.broadcast.to(joueurs[socket.id]).emit('reFinChoix', data);
  });
});

mongoose.Promise = Promise;
mongoose
  .connect(`mongodb+srv://${db_user}:${db_pwd}@mastermind.tjryu.mongodb.net/${db_name}?retryWrites=true&w=majority`, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
  })
  .then(() => console.log('Connection to mongodb Atlas in db : ' + db_name))
  .catch(err => console.log(new Error(`Connection problem to mongodb : ${err}`)));

http.listen(port, function(socket) {
  console.log(`Server start at http://localhost:${port}`);
});