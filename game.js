const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 400,
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const game = new Phaser.Game(config);

// ======================
// SETTINGS
// ======================

// Toggle this:

// let AI_INTERVALS = [0, 3000, 2500, 2000];
let AI_INTERVALS = [0, 2000, 1500, 1250];
// ms between "correct answers" for each player (0 means human)

let speedInitial = 10;
let speedDelta = 1;
let carLength = 50;
let numPlayers = 4;
let minTimes = 1;
let maxTimes = 12;

// ======================
// STATE
// ======================

let players = [];
let places = [];
let ticks = 0;

let currentAnswer = 0;
let answerBuffer = "";

let score = 0;

let hasStarted = false;
let hasEnded = false;

let startTime = 0;
let forceStop = false;

let pressedDel = false;

// ======================
// PLAYER FACTORY
// ======================

function preload() {
  this.load.image('turtleA1', 'assets/turtleA1.png');
  this.load.image('turtleA2', 'assets/turtleA2.png');
  this.load.image('turtleA3', 'assets/turtleA3.png');
  this.load.image('turtleB1', 'assets/turtleB1.png');
  this.load.image('turtleB2', 'assets/turtleB2.png');
  this.load.image('turtleB3', 'assets/turtleB3.png');
  this.load.image('turtleC1', 'assets/turtleC1.png');
  this.load.image('turtleC2', 'assets/turtleC2.png');
  this.load.image('turtleC3', 'assets/turtleC3.png');
  this.load.image('turtleD1', 'assets/turtleD1.png');
  this.load.image('turtleD2', 'assets/turtleD2.png');
  this.load.image('turtleD3', 'assets/turtleD3.png');
}

function createPlayer(scene, y, color, isHuman = false, baseSpeed = 0, aiInterval = null, boostList = [], baseSprite = 'turtleA1') {
  return {
    sprite: scene.add.sprite(50, y, baseSprite).setScale(0.18),
    x: 0,
    speed: 0,
    baseSpeed: baseSpeed,
    isHuman: isHuman,
    finished: false,
    smart: false,
    boosts: boostList,

    // AI timing system
    aiInterval: aiInterval,
    lastBoostTime: 0
  };
}

// ======================
// CREATE
// ======================

function create() {
  this.finishLine = 920;
  this.startLine = 75;

  let lastTime = localStorage.getItem("lastRaceTime");
  let humanBoosts = JSON.parse(localStorage.getItem("lastBoosts") || "[]");
  if (localStorage.getItem("topBoosts") === null) {
    localStorage.setItem("topBoosts", JSON.stringify([[],[],[]]));
    console.log("No boost data saved");
  }
  this.topBoostList = JSON.parse(localStorage.getItem("topBoosts"));

  this.intro = this.add.text(200, 10, 'Press any key to begin...', { fontSize: '24px' });

  // ======================
  // FINISH LINE
  // ======================

  const blockSize = 10;
  for (let i = 0; i < Math.floor(400 / blockSize); i++) {
    this.add.rectangle(this.finishLine, (2*i+1)*blockSize, blockSize, blockSize, 0xffffff);
    this.add.rectangle(this.finishLine + blockSize, (2*i)*blockSize, blockSize, blockSize, 0xffffff);
  }

  // ======================
  // START LINE
  // ======================

  this.add.rectangle(this.startLine, 200, 10, 400, 0xaaaaaa);

  // ======================
  // LANE LINES
  // ======================

  const dashNum = 10;
  const dashLength = (this.finishLine - this.startLine) / (2 * dashNum);

  for (let i = 0; i < numPlayers; i++) {
    for (let j = 0; j < dashNum; j++) {
      this.add.rectangle(
        this.startLine + (2*j+1)*dashLength,
        50 + i*350/numPlayers,
        dashLength,
        5,
        0xeeeeee
      );
    }
  }

  // ======================
  // PLAYERS
  // ======================
  
  sp1 = 10.0
  sp2 = 15.0
  sp3 = 20.0
  
  players = [
    createPlayer(this, 50+350/8, 0x00ff00, true, 0, 0),
    createPlayer(this, 50+3*350/8, 0xffff00, false, sp1, AI_INTERVALS[1], this.topBoostList[0],'turtleB1'),
    createPlayer(this, 50+5*350/8, 0x00ffff, false, sp2, AI_INTERVALS[2], this.topBoostList[1],'turtleC1'),
    createPlayer(this, 50+7*350/8, 0xff00ff, false, sp3, AI_INTERVALS[3], this.topBoostList[2],'turtleD1')
  ];
  
  console.log(localStorage.getItem("topTimes"));
  console.log(localStorage.getItem("topTimes") === null);
  if (localStorage.getItem("topTimes") === null) {
    tp1 = (this.finishLine - this.startLine)/(sp1*speedDelta);
    tp2 = (this.finishLine - this.startLine)/(sp2*speedDelta);
    tp3 = (this.finishLine - this.startLine)/(sp3*speedDelta);
    localStorage.setItem("topTimes", JSON.stringify([tp1,tp2,tp3]));
  }
  this.topTimeList = JSON.parse(localStorage.getItem("topTimes"));
  console.log("Initial top times",this.topTimeList);
  // ======================
  // UI
  // ======================

  this.questionText = this.add.text(300, 10, '', { fontSize: '24px' });
  this.inputText = this.add.text(450, 10, '', { fontSize: '24px', color: '#ffff00' });
  this.timeText = this.add.text(300, 50+350/8, '', { fontSize: '24px', color: '#FF0000' });
  this.bestTimeText = this.add.text(300, 50+7*350/8, '', { fontSize: '24px', color: '#FF0000' });
  this.eraseMessage = this.add.text(300,3*350/4,"",{ fontSize: '24px', color: '#FF0000' });

  // ======================
  // INPUT
  // ======================

  this.input.keyboard.on('keydown', (event) => {

    if (!hasStarted) {
      hasStarted = true;
      startTime = this.time.now;
      this.intro.destroy();
      generateQuestion(this);

      // Initialize AI timers so they don't all boost instantly
      players.forEach(p => {
        if (!p.isHuman) {
          p.lastBoostTime = this.time.now;
        }
        p.speed = speedInitial
      });
    }

    if (hasEnded && event.key === ' ') {
      forceStop = true;
    }
    
    if (hasEnded && event.key === 'Delete') {
      if (pressedDel) {
        players.forEach(p => {p.boosts = null});
        localStorage.setItem("lastBoosts", JSON.stringify([]));
        this.eraseMessage.setText("Times erased.");
        localStorage.setItem("topBoosts", JSON.stringify([[],[],[]]));
        
        localStorage.removeItem("topTimes");
      } else {
        this.eraseMessage.setText("Press DEL again to erase saved times.");
        pressedDel = true;
      }
    } else if (hasEnded && pressedDel) {
      this.eraseMessage.setText("Times not erased.");
      pressedDel = false;
    }

    if (event.key >= '0' && event.key <= '9') {
      answerBuffer += event.key;
      this.inputText.setText(answerBuffer);
    }

    if (event.key === 'Backspace') {
      answerBuffer = answerBuffer.slice(0, -1);
      this.inputText.setText(answerBuffer);
    }

    if (event.key === 'Enter') {
      checkAnswer(this);
    }
  });
}

// ======================
// UPDATE
// ======================

function update(time, delta) {
  if (hasStarted && !hasEnded) {ticks++}

  players.forEach((p, index) => {

    // Teleport cars to finish line
    if (forceStop) {
      players.forEach(p => p.speed = 0);
      players.forEach(p => {
        p.x = this.finishLine;
        p.sprite.x = 50 + p.x;
      });
      return;
    }

    // if (hasEnded) return;

    // ======================
    // AI LOGIC
    // ======================

    if (!p.isHuman && hasStarted && !hasEnded) {
      // console.log("p.boosts:", p.boosts, "type:", typeof p.boosts);
      if (p.boosts.length > 0) {
        p.boosts.forEach(b => {
          if (b === ticks) {
            p.speed += speedDelta;
          } 
        });
        // p.speed *= (1 - 0.002 * (0.25 + speedDelta / (p.speed + 1)));
      }
      else if (p.smart) {
        // Boost at fixed intervals (simulating correct answers)
        if (time - p.lastBoostTime > p.aiInterval) {
          p.speed += speedDelta;
          p.lastBoostTime = time;
        }
        // p.speed *= (1 - 0.002 * (0.25 + speedDelta / (p.speed + 1)));
      } else {
        // Constant speed mode
        p.speed = p.baseSpeed * speedDelta;
      }
    }

    // ======================
    // MOVEMENT
    // ======================

    if (!p.finished) {
      p.x += p.speed * delta / 1000;
      p.sprite.x = 50 + p.x;
      if (p.speed > 0) {
        let skin = p.sprite.texture.key
        let skin_num = parseInt(skin.at(-1))
        skin_num = skin_num % 3 + 1
        skin = skin.slice(0,-1) + skin_num.toString();
        p.sprite.setTexture(skin)
      }
    }

    // ======================
    // FINISH DETECTION
    // ======================

    if (!p.finished && p.sprite.x >= this.finishLine - carLength/2) {
      p.finished = true;
      places.push(index);
    }
  });

  // ======================
  // HUMAN DRAG
  // ======================

  let human = players[0];
  // human.speed *= (1 - 0.002 * (0.25 + speedDelta / (human.speed + 1)));

  // ======================
  // END CONDITION
  // ======================

  if (!hasEnded && players[0].finished) {
    hasEnded = true;

    let endTime = time - startTime;
    let seconds = (endTime / 1000).toFixed(2);

    localStorage.setItem("lastRaceTime", seconds);
    localStorage.setItem("lastBoosts", JSON.stringify(players[0].boosts));
    let max_val = Math.max(...this.topTimeList);
    if (endTime/1000 < max_val) {
      let max_idx = this.topTimeList.indexOf(max_val);
      this.topTimeList[max_idx] = endTime/1000;
      localStorage.setItem("topTimes", JSON.stringify(this.topTimeList));
      console.log("Old boost markers",this.topBoostList, max_idx);
      this.topBoostList[max_idx] = human.boosts;
      console.log("New boost markers",this.topBoostList);
      localStorage.setItem("topBoosts", JSON.stringify(this.topBoostList));
      console.log("Top times",this.topTimeList);
    }

    let place = places.indexOf(0) + 1;

    this.add.text(350, 175, 'Game Over!', { fontSize: '24px', color: '#FF0000' });

    this.timeText.setText(`Time: ${seconds}s | Score: ${score} | Place: ${place}`);
    this.bestTimeText.setText(`Best Time: ${Math.min(...this.topTimeList).toFixed(2)}s`);
  }
}

// ======================
// QUESTION SYSTEM
// ======================

function generateQuestion(scene) {
  const a = Phaser.Math.Between(minTimes, maxTimes);
  const b = Phaser.Math.Between(minTimes, maxTimes);

  currentAnswer = a * b;

  // Unicode multiply sign (fix)
  scene.questionText.setText(`${a} \u00D7 ${b} =`);

  answerBuffer = "";
  scene.inputText.setText("");
}

function checkAnswer(scene) {
  let human = players[0];

  if (parseInt(answerBuffer) === currentAnswer) {
    human.speed += speedDelta;
    score++;
    generateQuestion(scene);
    human.boosts.push(ticks)
  } else {
    human.speed *= 1.0;
    answerBuffer = "";
    scene.inputText.setText("");
  }
}