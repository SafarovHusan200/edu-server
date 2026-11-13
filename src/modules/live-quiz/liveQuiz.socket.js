// src/modules/live-quiz/liveQuiz.socket.js
// Jonli viktorinaning real-time qismi. Namespace: /live-quiz
//
// Har bir client hodisasi acknowledgement (callback) bilan javob oladi:
//   socket.emit('player:join', { pin, name }, (res) => { res.ok ? ... : res.message })
// Xato bo'lsa: { ok: false, code: 'NAME_TAKEN', message: '...' }
//
// HOST (doska, o'qituvchi) — handshake'da token majburiy: io('/live-quiz', { auth: { token } })
//   host:join  { pin }            → { ok, game }   (qayta ulanishda ham shu)
//   host:start {}                 → birinchi savol
//   host:next  {}                 → savolni yopish / keyingi savol / yakunlash
//   host:kick  { playerId }
//   host:end   {}                 → o'yinni darhol yakunlash (natija saqlanadi)
//   host:close {}                 → o'yinni xotiradan o'chirish (o'yinchilarga game:closed)
//
// O'YINCHI — token ixtiyoriy (berilsa natijada platformadagi akkauntga bog'lanadi)
//   player:join   { pin, name }   → { ok, playerId, playerKey, game }
//   player:rejoin { pin, playerKey } → { ok, playerId, game }  (sahifa yangilansa)
//   player:answer { questionIndex, option } → { ok }
//
// Serverdan keladigan hodisalar: lobby:players (host), lobby:count, question:start,
// question:answers (host), question:end (host), question:result (o'yinchi), game:end,
// player:kicked, game:closed

const jwt = require('jsonwebtoken');
const User = require('../users/user.model');
const gameManager = require('./liveGame.manager');
const liveQuizService = require('./liveQuiz.service');

const { GameError, hostRoom, playersRoom } = gameManager;

const HOST_ROLES = ['teacher', 'admin', 'superadmin'];
const STAFF_ROLES = ['admin', 'superadmin'];

// Bitta socket'dan hodisa oqimini cheklash (masalan javob tugmasini avtomatik bosish skriptlari)
const RATE_WINDOW_MS = 10 * 1000;
const RATE_MAX_EVENTS = 30;

// authenticate middleware'dagi tekshiruvlar bilan bir xil — yaroqsiz bo'lsa null
const resolveUser = async (token) => {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_TOKEN_SECRET);
    const user = await User.findById(decoded.id).select('name role isBlocked isVerified tokenVersion');
    if (!user || user.isBlocked || !user.isVerified || decoded.tokenVersion !== user.tokenVersion) return null;
    return user;
  } catch {
    return null;
  }
};

const fail = (ack, err) => {
  if (typeof ack !== 'function') return;
  if (err instanceof GameError) return ack({ ok: false, code: err.code, message: err.message });
  console.error('❌ Live quiz socket xatosi:', err);
  ack({ ok: false, code: 'SERVER_ERROR', message: 'Serverda xatolik' });
};

const register = (io) => {
  const nsp = io.of('/live-quiz');

  liveQuizService.setEmitter((target, event, data) => nsp.to(target).emit(event, data));

  // Harakatsiz va tugagan o'yinlarni har daqiqada tozalash
  const sweeper = setInterval(
    () => gameManager.sweep((target, event, data) => nsp.to(target).emit(event, data)),
    60 * 1000
  );
  sweeper.unref?.();

  nsp.use(async (socket, next) => {
    socket.data.user = await resolveUser(socket.handshake.auth?.token);
    next();
  });

  nsp.on('connection', (socket) => {
    const events = [];

    // Har bir hodisa: rate limit + xatolarni ack'ga aylantirish
    const on = (event, handler) => {
      socket.on(event, async (payload, ack) => {
        const now = Date.now();
        while (events.length && now - events[0] > RATE_WINDOW_MS) events.shift();
        events.push(now);
        if (events.length > RATE_MAX_EVENTS) {
          return fail(ack, new GameError('RATE_LIMITED', "Juda ko'p so'rov, biroz kuting"));
        }
        try {
          await handler(payload ?? {}, ack);
        } catch (err) {
          fail(ack, err);
        }
      });
    };

    const requireGame = (pin) => {
      const game = gameManager.getGame(pin);
      if (!game) throw new GameError('GAME_NOT_FOUND', "Bunday PIN bilan o'yin topilmadi");
      return game;
    };

    const hostGame = () => {
      const game = socket.data.hostPin && gameManager.getGame(socket.data.hostPin);
      if (!game) throw new GameError('NOT_HOST', "Avval host:join qiling");
      return game;
    };

    const playerContext = () => {
      const game = socket.data.playerPin && gameManager.getGame(socket.data.playerPin);
      if (!game) throw new GameError('GAME_NOT_FOUND', "O'yin topilmadi");
      return { game, playerId: socket.data.playerId };
    };

    const ok = (ack, data = {}) => typeof ack === 'function' && ack({ ok: true, ...data });

    // ─────────────── HOST ───────────────

    on('host:join', ({ pin }, ack) => {
      const user = socket.data.user;
      if (!user || !HOST_ROLES.includes(user.role)) {
        throw new GameError('UNAUTHORIZED', "O'yinni boshqarish uchun o'qituvchi sifatida kiring");
      }
      const game = requireGame(pin);
      if (game.hostId !== user._id.toString() && !STAFF_ROLES.includes(user.role)) {
        throw new GameError('FORBIDDEN', "Bu o'yin sizga tegishli emas");
      }
      socket.data.hostPin = game.pin;
      socket.join(hostRoom(game.pin));
      ok(ack, { game: game.hostSnapshot() });
    });

    on('host:start', (_, ack) => {
      hostGame().start();
      ok(ack);
    });

    on('host:next', (_, ack) => {
      hostGame().next();
      ok(ack);
    });

    on('host:kick', ({ playerId }, ack) => {
      hostGame().kick(playerId);
      ok(ack);
    });

    on('host:end', (_, ack) => {
      hostGame().finish();
      ok(ack);
    });

    on('host:close', (_, ack) => {
      const game = hostGame();
      gameManager.removeGame(game.pin, (target, event, data) => nsp.to(target).emit(event, data));
      socket.data.hostPin = null;
      ok(ack);
    });

    // ─────────────── O'YINCHI ───────────────

    on('player:join', ({ pin, name }, ack) => {
      const game = requireGame(pin);
      const player = game.addPlayer({ name, socketId: socket.id, user: socket.data.user });
      socket.data.playerPin = game.pin;
      socket.data.playerId = player.id;
      socket.join(playersRoom(game.pin));
      ok(ack, { playerId: player.id, playerKey: player.key, game: game.playerSnapshot(player) });
    });

    on('player:rejoin', ({ pin, playerKey }, ack) => {
      const game = requireGame(pin);
      const player = game.rejoin({ playerKey, socketId: socket.id });
      socket.data.playerPin = game.pin;
      socket.data.playerId = player.id;
      socket.join(playersRoom(game.pin));
      ok(ack, { playerId: player.id, game: game.playerSnapshot(player) });
    });

    on('player:answer', ({ questionIndex, option }, ack) => {
      const { game, playerId } = playerContext();
      game.submitAnswer({ playerId, questionIndex, option });
      ok(ack);
    });

    socket.on('disconnect', () => {
      const game = socket.data.playerPin && gameManager.getGame(socket.data.playerPin);
      if (game) game.disconnectSocket(socket.id);
    });
  });

  return nsp;
};

module.exports = { register, resolveUser };
