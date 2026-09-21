const request = require('supertest');
const { openDatabase } = require('../src/database');
const { createApp } = require('../src/app');
const { createUser } = require('../src/data/usuarios');
const { hashPassword } = require('../src/security');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');

const password = 'Una clave de pruebas 2026!';
const config = { jwtSecret: 'testing-only-secret-with-at-least-48-characters-2026', setupToken: 'testing-only-setup-token-at-least-32-characters', tokenSeconds: 1800, loginMax: 1000, publicOrigin: 'http://127.0.0.1:3000', production: false, trustProxy: false };
let passwordHash;

async function fixture(empty = false, overrides = {}) {
  passwordHash ||= await hashPassword(password);
  const db = openDatabase();
  const settings = { ...config, ...overrides };
  const app = createApp({ db, config: settings, requestLog: () => {} });
  const users = empty ? {} : Object.fromEntries(['admin', 'ana', 'mateo'].map((name) => [name, createUser(db, { name, email: `${name}@example.com`, role: name === 'admin' ? 'Administrador' : 'Usuario' }, passwordHash)]));
  function token(user, claims = {}) {
    const id = randomUUID();
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(id, user.id, Math.floor(Date.now()/1000)+1800);
    return jwt.sign({}, settings.jwtSecret, { algorithm:'HS256', subject: user.id, jwtid:id, issuer:'donativoseguro', audience:'donativoseguro-web', expiresIn:1800, ...claims });
  }
  const auth = (name = 'admin') => ({ Authorization: `Bearer ${token(users[name])}` });
  return { db, app, users, auth, token, request: request(app), config: settings };
}

const donorInput = (ownerId = null) => ({ name:'Donante de prueba', email:'donante@example.com', phone:'5512345678', person:'Persona física', ownerId });
const donationInput = { type:'Efectivo', amount:500.25, date:'2026-01-01', notes:'Apoyo escolar' };
module.exports = { fixture, password, donorInput, donationInput };
