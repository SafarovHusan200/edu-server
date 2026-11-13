// src/modules/live-quiz/liveGame.manager.js
// Jonli viktorina o'yinlari XOTIRADA (bitta Node jarayoni ichida) saqlanadi — har bir
// javob uchun DB'ga yozish shart emas, o'yin tugaganda natija bir marta LiveSession'ga yoziladi.
// DIQQAT: shu sababli server bitta jarayon (process) bo'lib ishlashi kerak. PM2 cluster yoki
// bir nechta instansga o'tilsa — Socket.IO Redis adapter va o'yin holatini Redis'ga ko'chirish kerak.
//
// Bu fayl transportdan (Socket.IO) mustaqil: tashqariga faqat `emit(room|socketId, event, data)`
// funksiyasi orqali gapiradi — liveQuiz.socket.js uni io bilan ulaydi, testlarda mock beriladi.

const crypto = require('crypto');

const MAX_PLAYERS = 200;
const NAME_MAX_LENGTH = 24;
const BASE_POINTS = 1000;
const FINISHED_TTL_MS = 15 * 60 * 1000; // tugagan o'yin natijasi shuncha vaqt ko'rinib turadi
const IDLE_TTL_MS = 3 * 60 * 60 * 1000; // shuncha vaqt hech narsa bo'lmasa o'yin o'chiriladi

class GameError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const hostRoom = (pin) => `live:${pin}:host`;
const playersRoom = (pin) => `live:${pin}:players`;

// Ism: chetdagi va ortiqcha probellar olib tashlanadi, boshqaruv belgilari o'chiriladi
const normalizeName = (raw) =>
  String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Tez javob — ko'proq ball: vaqtning boshida 1000, oxirida 500 (Kahoot formulasiga o'xshash)
const calcPoints = ({ correct, elapsedMs, timeLimitSec, multiplier }) => {
  if (!correct || multiplier === 0) return 0;
  const ratio = Math.min(1, Math.max(0, elapsedMs / (timeLimitSec * 1000)));
  return Math.round(BASE_POINTS * (1 - ratio / 2)) * multiplier;
};

class LiveGame {
  constructor({ pin, quiz, hostId, emit, onFinish }) {
    this.pin = pin;
    this.sessionId = crypto.randomUUID();
    this.quizId = quiz._id.toString();
    this.quizTitle = quiz.title;
    this.hostId = hostId.toString();
    // O'yin boshlangandan keyin savollar tahrirlansa ham bu o'yin o'zgarmasligi uchun nusxa
    this.questions = quiz.questions.map((q) => ({
      text: q.text,
      image: q.image ?? null,
      options: [...q.options],
      correctIndex: q.correctIndex,
      timeLimit: q.timeLimit ?? 20,
      pointsMultiplier: q.pointsMultiplier ?? 1,
    }));
    this.emit = emit;
    this.onFinish = onFinish;

    this.status = 'lobby'; // lobby → question → reveal → ... → finished
    this.currentIndex = -1;
    this.players = new Map(); // playerId → player
    this.questionStartedAt = null;
    this.questionEndsAt = null;
    this.timer = null;
    this.createdAt = Date.now();
    this.startedAt = null;
    this.endedAt = null;
    this.touch();
  }

  touch() {
    this.lastActivity = Date.now();
  }

  // ─────────────── O'yinchilar ───────────────

  addPlayer({ name, socketId, user = null }) {
    if (this.status !== 'lobby') {
      throw new GameError('GAME_STARTED', "O'yin allaqachon boshlangan");
    }
    if (this.players.size >= MAX_PLAYERS) {
      throw new GameError('GAME_FULL', `O'yinchilar soni ${MAX_PLAYERS} tadan oshmasligi kerak`);
    }

    const clean = normalizeName(name);
    if (!clean) throw new GameError('NAME_REQUIRED', 'Ismingizni kiriting');
    if (clean.length > NAME_MAX_LENGTH) {
      throw new GameError('NAME_TOO_LONG', `Ism ${NAME_MAX_LENGTH} ta belgidan oshmasligi kerak`);
    }

    const nameKey = clean.toLocaleLowerCase('uz');
    for (const p of this.players.values()) {
      if (p.nameKey === nameKey) throw new GameError('NAME_TAKEN', "Bu ism band, boshqa ism tanlang");
      if (user && p.userId === user._id.toString()) {
        throw new GameError('ALREADY_JOINED', "Siz bu o'yinga allaqachon qo'shilgansiz");
      }
    }

    const player = {
      id: crypto.randomUUID(),
      // Qayta ulanish kaliti — faqat shu o'yinchining o'ziga beriladi (sahifa yangilansa
      // yoki internet uzilib qolsa, ball yo'qolmasdan qaytib kirish uchun)
      key: crypto.randomBytes(16).toString('hex'),
      name: clean,
      nameKey,
      userId: user ? user._id.toString() : null,
      socketId,
      connected: true,
      score: 0,
      correctCount: 0,
      streak: 0,
      answers: new Map(), // questionIndex → { option, elapsedMs, points, correct }
      joinedAt: Date.now(),
    };

    this.players.set(player.id, player);
    this.touch();
    this.broadcastLobby();
    return player;
  }

  rejoin({ playerKey, socketId }) {
    const player = [...this.players.values()].find((p) => p.key === playerKey);
    if (!player) throw new GameError('PLAYER_NOT_FOUND', "O'yinchi topilmadi, qaytadan qo'shiling");
    player.socketId = socketId;
    player.connected = true;
    this.touch();
    this.broadcastLobby();
    return player;
  }

  disconnectSocket(socketId) {
    for (const p of this.players.values()) {
      if (p.socketId === socketId) {
        p.connected = false;
        this.broadcastLobby();
      }
    }
  }

  kick(playerId) {
    const player = this.players.get(playerId);
    if (!player) throw new GameError('PLAYER_NOT_FOUND', "O'yinchi topilmadi");
    this.players.delete(playerId);
    if (player.socketId) this.emit(player.socketId, 'player:kicked', {});
    this.broadcastLobby();
    // Hammasi javob berib bo'lgan bo'lishi mumkin (chiqarilgan o'yinchi kutilayotgan edi)
    if (this.status === 'question' && this.allAnswered()) this.endQuestion();
  }

  playerList() {
    return [...this.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({ id: p.id, name: p.name, connected: p.connected, isPlatformUser: !!p.userId }));
  }

  broadcastLobby() {
    this.emit(hostRoom(this.pin), 'lobby:players', { players: this.playerList(), count: this.players.size });
    this.emit(playersRoom(this.pin), 'lobby:count', { count: this.players.size });
  }

  // ─────────────── O'yin oqimi ───────────────

  start() {
    if (this.status !== 'lobby') throw new GameError('INVALID_STATE', "O'yin allaqachon boshlangan");
    if (this.players.size === 0) throw new GameError('NO_PLAYERS', "Hali hech kim qo'shilmagan");
    if (this.questions.length === 0) throw new GameError('NO_QUESTIONS', "Viktorinada savol yo'q");
    this.startedAt = new Date();
    this.startQuestion(0);
  }

  startQuestion(index) {
    const q = this.questions[index];
    this.status = 'question';
    this.currentIndex = index;
    this.questionStartedAt = Date.now();
    this.questionEndsAt = this.questionStartedAt + q.timeLimit * 1000;
    this.touch();

    this.emit(hostRoom(this.pin), 'question:start', this.publicQuestion());
    this.emit(playersRoom(this.pin), 'question:start', this.publicQuestion());

    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.endQuestion(), q.timeLimit * 1000);
    this.timer.unref?.();
  }

  // To'g'ri javob YUBORILMAYDI — faqat savol tugagach 'question:end'/'question:result'da
  publicQuestion() {
    const q = this.questions[this.currentIndex];
    return {
      index: this.currentIndex,
      total: this.questions.length,
      text: q.text,
      image: q.image,
      options: q.options,
      timeLimit: q.timeLimit,
      pointsMultiplier: q.pointsMultiplier,
      endsAt: this.questionEndsAt,
      serverNow: Date.now(), // client o'z soatini moslashtirishi uchun
    };
  }

  submitAnswer({ playerId, questionIndex, option }) {
    const player = this.players.get(playerId);
    if (!player) throw new GameError('PLAYER_NOT_FOUND', "O'yinchi topilmadi");
    if (this.status !== 'question' || questionIndex !== this.currentIndex) {
      throw new GameError('QUESTION_CLOSED', 'Bu savolga javob qabul qilinmaydi');
    }
    if (player.answers.has(questionIndex)) {
      throw new GameError('ALREADY_ANSWERED', 'Siz bu savolga javob bergansiz');
    }

    const q = this.questions[questionIndex];
    if (!Number.isInteger(option) || option < 0 || option >= q.options.length) {
      throw new GameError('INVALID_OPTION', "Noto'g'ri variant");
    }

    const elapsedMs = Date.now() - this.questionStartedAt;
    const correct = option === q.correctIndex;
    const points = calcPoints({ correct, elapsedMs, timeLimitSec: q.timeLimit, multiplier: q.pointsMultiplier });

    player.answers.set(questionIndex, { option, elapsedMs, points, correct });
    this.touch();

    const answered = this.answeredCount();
    this.emit(hostRoom(this.pin), 'question:answers', { answered, total: this.players.size });

    if (this.allAnswered()) this.endQuestion();
    return { accepted: true };
  }

  answeredCount() {
    let n = 0;
    for (const p of this.players.values()) if (p.answers.has(this.currentIndex)) n += 1;
    return n;
  }

  allAnswered() {
    return this.players.size > 0 && this.answeredCount() >= this.players.size;
  }

  endQuestion() {
    if (this.status !== 'question') return;
    clearTimeout(this.timer);
    this.timer = null;
    this.status = 'reveal';
    this.touch();

    const index = this.currentIndex;
    const q = this.questions[index];
    const distribution = q.options.map(() => 0);

    // Ballar faqat shu yerda qo'shiladi — savol ochiq turganda reyting o'zgarmaydi
    for (const p of this.players.values()) {
      const a = p.answers.get(index);
      if (a) {
        distribution[a.option] += 1;
        p.score += a.points;
        if (a.correct) {
          p.correctCount += 1;
          p.streak += 1;
        } else {
          p.streak = 0;
        }
      } else {
        p.streak = 0;
      }
    }

    const ranking = this.ranking();
    const rankOf = new Map(ranking.map((p, i) => [p.id, i + 1]));

    this.emit(hostRoom(this.pin), 'question:end', {
      index,
      correctIndex: q.correctIndex,
      distribution,
      answered: distribution.reduce((s, n) => s + n, 0),
      total: this.players.size,
      leaderboard: this.leaderboard(10, ranking),
      isLast: index === this.questions.length - 1,
    });

    for (const p of this.players.values()) {
      const a = p.answers.get(index);
      this.emit(p.socketId, 'question:result', {
        index,
        answered: !!a,
        correct: !!a?.correct,
        correctIndex: q.correctIndex,
        points: a?.points ?? 0,
        score: p.score,
        streak: p.streak,
        rank: rankOf.get(p.id),
        totalPlayers: this.players.size,
      });
    }
  }

  // Host "Keyingi" tugmasi: savol ochiq bo'lsa — yopadi (natija), natija ko'rsatilayotgan
  // bo'lsa — keyingi savolga o'tadi yoki oxirgisi bo'lsa o'yinni yakunlaydi
  next() {
    if (this.status === 'question') return this.endQuestion();
    if (this.status !== 'reveal') throw new GameError('INVALID_STATE', "Hozir bu amal mumkin emas");
    if (this.currentIndex + 1 < this.questions.length) return this.startQuestion(this.currentIndex + 1);
    return this.finish();
  }

  finish() {
    if (this.status === 'finished') return;
    clearTimeout(this.timer);
    this.timer = null;
    // Savol ochiq paytida yakunlansa — shu savol ballari ham hisoblansin
    if (this.status === 'question') this.endQuestion();
    this.status = 'finished';
    this.endedAt = new Date();
    this.touch();

    const ranking = this.ranking();
    this.emit(hostRoom(this.pin), 'game:end', {
      podium: this.leaderboard(3, ranking),
      leaderboard: this.leaderboard(ranking.length, ranking),
      totalPlayers: ranking.length,
      totalQuestions: this.questions.length,
    });
    ranking.forEach((p, i) => {
      this.emit(p.socketId, 'game:end', {
        rank: i + 1,
        score: p.score,
        correctCount: p.correctCount,
        totalQuestions: this.questions.length,
        totalPlayers: ranking.length,
      });
    });

    if (this.onFinish) {
      Promise.resolve(this.onFinish(this, ranking)).catch((err) =>
        console.error(`❌ Jonli viktorina natijasini saqlash xatosi (${this.pin}):`, err.message)
      );
    }
  }

  // Ball bo'yicha, teng bo'lsa — ko'proq to'g'ri javob, keyin kim oldin qo'shilgan
  ranking() {
    return [...this.players.values()].sort(
      (a, b) => b.score - a.score || b.correctCount - a.correctCount || a.joinedAt - b.joinedAt
    );
  }

  leaderboard(limit, ranking = this.ranking()) {
    return ranking.slice(0, limit).map((p, i) => ({
      rank: i + 1,
      id: p.id,
      name: p.name,
      score: p.score,
      correctCount: p.correctCount,
      streak: p.streak,
    }));
  }

  // Host qayta ulanganda (sahifa yangilansa) joriy holatni to'liq tiklash uchun
  hostSnapshot() {
    const snapshot = {
      pin: this.pin,
      sessionId: this.sessionId,
      quizTitle: this.quizTitle,
      status: this.status,
      totalQuestions: this.questions.length,
      currentIndex: this.currentIndex,
      players: this.playerList(),
    };
    if (this.status === 'question') {
      snapshot.question = this.publicQuestion();
      snapshot.answered = this.answeredCount();
    }
    if (this.status === 'reveal' || this.status === 'finished') {
      snapshot.leaderboard = this.leaderboard(10);
      if (this.currentIndex >= 0) snapshot.correctIndex = this.questions[this.currentIndex].correctIndex;
    }
    return snapshot;
  }

  // O'yinchi qayta ulanganda — o'ziga tegishli holat
  playerSnapshot(player) {
    const snapshot = {
      pin: this.pin,
      quizTitle: this.quizTitle,
      status: this.status,
      playerId: player.id,
      name: player.name,
      score: player.score,
      totalQuestions: this.questions.length,
    };
    if (this.status === 'question') {
      snapshot.question = this.publicQuestion();
      snapshot.alreadyAnswered = player.answers.has(this.currentIndex);
    }
    if (this.status === 'finished') {
      const ranking = this.ranking();
      snapshot.rank = ranking.findIndex((p) => p.id === player.id) + 1;
      snapshot.totalPlayers = ranking.length;
    }
    return snapshot;
  }

  dispose() {
    clearTimeout(this.timer);
    this.timer = null;
  }
}

// ─────────────── O'yinlar ro'yxati (registry) ───────────────

const games = new Map(); // pin → LiveGame

const generatePin = () => {
  for (let i = 0; i < 50; i += 1) {
    const pin = String(crypto.randomInt(100000, 1000000));
    if (!games.has(pin)) return pin;
  }
  throw new GameError('PIN_UNAVAILABLE', "PIN yaratib bo'lmadi, qayta urinib ko'ring");
};

const createGame = (options) => {
  const game = new LiveGame({ ...options, pin: generatePin() });
  games.set(game.pin, game);
  return game;
};

const getGame = (pin) => games.get(String(pin ?? '').trim()) ?? null;

const removeGame = (pin, emit) => {
  const game = games.get(pin);
  if (!game) return;
  game.dispose();
  games.delete(pin);
  if (emit) emit(playersRoom(pin), 'game:closed', {});
};

// Tugagan va uzoq vaqt harakatsiz o'yinlarni xotiradan tozalaydi
const sweep = (emit, now = Date.now()) => {
  for (const game of games.values()) {
    const finishedExpired = game.status === 'finished' && now - game.lastActivity > FINISHED_TTL_MS;
    const idleExpired = now - game.lastActivity > IDLE_TTL_MS;
    if (finishedExpired || idleExpired) removeGame(game.pin, emit);
  }
};

const resetAll = () => {
  for (const game of games.values()) game.dispose();
  games.clear();
};

module.exports = {
  LiveGame,
  GameError,
  createGame,
  getGame,
  removeGame,
  sweep,
  resetAll,
  calcPoints,
  normalizeName,
  hostRoom,
  playersRoom,
  MAX_PLAYERS,
};
