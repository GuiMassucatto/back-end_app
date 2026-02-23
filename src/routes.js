const express = require('express');
const routes = express.Router();

const agendamento = require('./controllers/agendamentoController');

routes.get('/agendamentos', agendamento.read);
routes.put('/agendamentos/:id/reservar', agendamento.reservar);
routes.put('/agendamentos/:id/liberar', agendamento.liberar);
router.delete('/agendamentos/:id', controller.deletarUm);

module.exports = routes