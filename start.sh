#!/bin/bash
echo "Iniciando microservicios..."
cd services/auth-service && npm install && npm start &
cd services/user-service && npm install && npm start &
cd services/donor-service && npm install && npm start &
cd services/donation-service && npm install && npm start &
cd services/expense-service && npm install && npm start &
cd services/tax-service && npm install && npm start &
cd services/accounting-service && npm install && npm start &
cd services/api-gateway && npm install && node src/server.js &
wait

