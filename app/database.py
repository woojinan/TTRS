"""PostgreSQL production storage; SQLite fallback for isolated unit tests."""
import hashlib
from contextlib import contextmanager
import hmac
import json
import os
import secrets
import re
import sqlite3
import psycopg
from psycopg.rows import dict_row
import time
from pathlib import Path


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600_000).hex()
    return f'pbkdf2_sha256$600000${salt}${digest}'


def password_ok(password, stored):
    return bool(stored) and hmac.compare_digest(password_hash(password, stored.split('$')[2]), stored)


IntegrityError = (sqlite3.IntegrityError, psycopg.IntegrityError)


class PostgresConnection:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql, params=()):
        return self.connection.execute(sql.replace('?', '%s'), params)

    def executescript(self, sql):
        self.connection.execute(sql)


class Database:
    def __init__(self, path=None):
        self.path = str(path or os.getenv('TTRS_DB', 'data/ttrs.sqlite3'))
        self.url = os.getenv('DATABASE_URL') if path is None else None
        if not self.url:
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            if not self.url:
                db.execute('PRAGMA journal_mode=WAL')
            db.executescript('''
                CREATE TABLE IF NOT EXISTS users (
                  id TEXT PRIMARY KEY, username TEXT UNIQUE, nickname TEXT NOT NULL UNIQUE,
                  password TEXT, created DOUBLE PRECISION NOT NULL);
                CREATE TABLE IF NOT EXISTS sessions (
                  token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
                  csrf TEXT NOT NULL, expires DOUBLE PRECISION NOT NULL);
                CREATE TABLE IF NOT EXISTS tickets (
                  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
                  mode TEXT NOT NULL, seed BIGINT NOT NULL, created DOUBLE PRECISION NOT NULL, used INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS records (
                  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
                  mode TEXT NOT NULL, completed INTEGER NOT NULL, elapsed DOUBLE PRECISION NOT NULL,
                  score INTEGER NOT NULL, lines INTEGER NOT NULL, pieces INTEGER NOT NULL,
                  placement INTEGER, participants INTEGER, created DOUBLE PRECISION NOT NULL, details TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS records_user ON records(user_id,created DESC);
                CREATE INDEX IF NOT EXISTS records_mode ON records(mode,completed);
                CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires);
                CREATE TABLE IF NOT EXISTS entries (
                  token TEXT PRIMARY KEY REFERENCES sessions(token) ON DELETE CASCADE);
            ''')

    @contextmanager
    def connect(self):
        if self.url:
            with psycopg.connect(self.url, row_factory=dict_row, connect_timeout=5) as connection:
                yield PostgresConnection(connection)
            return
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        try:
            with db:
                yield db
        finally:
            db.close()

    def guest(self):
        for _ in range(30):
            nickname = 'guest_' + str(10000 + secrets.randbelow(990000))
            uid = secrets.token_hex(16)
            try:
                with self.connect() as db:
                    db.execute('INSERT INTO users VALUES (?,?,?,?,?)', (uid, None, nickname, None, time.time()))
                    return {'id': uid, 'username': None, 'nickname': nickname}
            except IntegrityError:
                continue
        raise RuntimeError('Could not allocate a unique guest')

    def session(self, uid, entered=False):
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(24)
        with self.connect() as db:
            db.execute('DELETE FROM sessions WHERE expires < ?', (time.time(),))
            db.execute('INSERT INTO sessions VALUES (?,?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), uid, csrf, time.time() + 86400 * 30))
            if entered:
                db.execute('INSERT INTO entries VALUES (?)', (hashlib.sha256(token.encode()).hexdigest(),))
        return token

    def enter(self, token, user):
        # Preserve existing guest records while replacing the old nickname format.
        for _ in range(30):
            try:
                with self.connect() as db:
                    if not user['username'] and not re.fullmatch(r'guest_\d{5,6}', user['nickname']):
                        db.execute('UPDATE users SET nickname=? WHERE id=? AND username IS NULL', ('guest_'+str(10000+secrets.randbelow(990000)), user['id']))
                    db.execute('INSERT INTO entries VALUES (?) ON CONFLICT(token) DO NOTHING', (hashlib.sha256(token.encode()).hexdigest(),))
                return
            except IntegrityError:
                continue
        raise RuntimeError('Could not allocate guest nickname')

    def identity(self, token):
        if not token or len(token) > 128:
            return None
        with self.connect() as db:
            row = db.execute('SELECT u.id,u.username,u.nickname,s.csrf,EXISTS(SELECT 1 FROM entries e WHERE e.token=s.token) AS entered FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires>?', (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone()
            return dict(row) if row else None

    def revoke(self, token):
        with self.connect() as db:
            db.execute('DELETE FROM sessions WHERE token=?', (hashlib.sha256((token or '').encode()).hexdigest(),))

    def upgrade(self, uid, username, nickname, hashed):
        with self.connect() as db:
            changed = db.execute('UPDATE users SET username=?,nickname=?,password=? WHERE id=? AND username IS NULL', (username, nickname, hashed, uid)).rowcount
            if not changed:
                raise ValueError('이미 가입한 계정입니다.')

    def find_user(self, username):
        with self.connect() as db:
            row = db.execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()
            return dict(row) if row else None

    def ticket(self, uid, mode):
        ticket = {'id': secrets.token_hex(16), 'seed': secrets.randbits(32), 'mode': mode}
        with self.connect() as db:
            db.execute('DELETE FROM tickets WHERE created<?', (time.time() - 86400,))
            db.execute('INSERT INTO tickets(id,user_id,mode,seed,created) VALUES (?,?,?,?,?)', (ticket['id'], uid, mode, ticket['seed'], time.time()))
        return ticket

    def get_ticket(self, tid, uid):
        with self.connect() as db:
            row = db.execute('SELECT * FROM tickets WHERE id=? AND user_id=? AND used=0 AND created>?', (tid, uid, time.time()-7200)).fetchone()
            return dict(row) if row else None

    def save_solo(self, ticket, result):
        with self.connect() as db:
            if db.execute('UPDATE tickets SET used=1 WHERE id=? AND used=0', (ticket['id'],)).rowcount != 1:
                return False
            self.insert_record(db, ticket['id'], ticket['user_id'], ticket['mode'], result)
        return True

    def insert_record(self, db, rid, uid, mode, result):
        db.execute('INSERT INTO records VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING', (rid, uid, mode, int(result['completed']), result['elapsed'], result['score'], result['lines'], result['pieces'], result.get('placement'), result.get('participants'), time.time(), json.dumps(result, ensure_ascii=False)))

    def save_battle(self, match, players, elapsed):
        with self.connect() as db:
            for p in players:
                if not p.get('userId'):
                    continue
                result = {**p, 'elapsed': p.get('elapsed', elapsed), 'completed': bool(p.get('won')), 'participants': len(players)}
                self.insert_record(db, f"{match}:{p['userId']}", p['userId'], 'battle', result)

    def history(self, uid):
        with self.connect() as db:
            return [dict(r) for r in db.execute('SELECT id,mode,completed,elapsed,score,lines,pieces,placement,participants,created FROM records WHERE user_id=? ORDER BY created DESC LIMIT 100', (uid,))]

    def ranking(self, mode):
        with self.connect() as db:
            if mode == 'battle':
                rows = db.execute('''SELECT u.nickname,u.username IS NULL AS guest,COUNT(*) AS games,
                  SUM(r.completed) AS wins,
                  SUM(r.participants-r.placement) AS value
                  FROM records r JOIN users u ON u.id=r.user_id WHERE mode='battle'
                  GROUP BY u.id ORDER BY value DESC,wins DESC,games ASC,u.nickname LIMIT 100''')
            else:
                aggregate = 'MIN(r.elapsed)' if mode == 'sprint' else 'MAX(r.score)'
                direction = 'ASC' if mode == 'sprint' else 'DESC'
                rows = db.execute(f'''SELECT u.nickname,u.username IS NULL AS guest,{aggregate} AS value,COUNT(*) AS games
                  FROM records r JOIN users u ON u.id=r.user_id WHERE r.mode=? AND r.completed=1
                  GROUP BY u.id ORDER BY value {direction},u.nickname LIMIT 100''', (mode,))
            return [dict(r) for r in rows]
