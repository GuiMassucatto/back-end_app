require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

function getSegundaComOffset(offsetSemanas = 0) {
    const hoje = new Date();
    const diaSemana = hoje.getDay(); 

    const diferenca = diaSemana === 0 ? -6 : 1 - diaSemana;

    const segunda = new Date(hoje);
    segunda.setDate(hoje.getDate() + diferenca + (offsetSemanas * 7));
    segunda.setHours(0, 0, 0, 0);

    return segunda;
}

const horariosPorDia = {
    segunda: [
        "15:10 - 16:00",
        "16:00 - 16:50",
        "16:50 - 17:40"
    ],
    quarta: [
        "14:00 - 14:40",
        "15:10 - 16:00",
        "16:00 - 16:50"
    ],
    sexta: [
        "15:10 - 16:00",
        "16:00 - 16:50",
        "16:50 - 17:40"
    ]
};

const gerarSemanaInterno = async (offsetSemanas = 0) => {

    const segundaBase = getSegundaComOffset(offsetSemanas);

    const dias = {
        segunda: new Date(segundaBase),
        quarta: new Date(segundaBase.getTime() + 2 * 86400000),
        sexta: new Date(segundaBase.getTime() + 4 * 86400000)
    };

    const promises = [];

    for (let nomeDia in dias) {

        const dataDia = dias[nomeDia];
        dataDia.setHours(0, 0, 0, 0);

        const horarios = horariosPorDia[nomeDia];

        for (let horario of horarios) {
            promises.push(
                prisma.agendamento.upsert({
                    where: {
                        data_horario: {
                            data: dataDia,
                            horario: horario
                        }
                    },
                    update: {},
                    create: {
                        data: dataDia,
                        horario: horario,
                        ocupado: false
                    }
                })
            );
        }
    }

    await Promise.all(promises);
};

const read = async (req, res) => {
    try {

        const offset = parseInt(req.query.semana) || 0;

        const segunda = getSegundaComOffset(offset);
        const sexta = new Date(segunda);
        sexta.setDate(segunda.getDate() + 4);
        sexta.setHours(23, 59, 59, 999);

        const existeSemana = await prisma.agendamento.findFirst({
            where: {
                data: {
                    gte: segunda,
                    lte: sexta
                }
            }
        });

        if (!existeSemana) {
            await gerarSemanaInterno(offset);
        }

        const agendamentos = await prisma.agendamento.findMany({
            where: {
                data: {
                    gte: segunda,
                    lte: sexta
                }
            },
            orderBy: [
                { data: 'asc' },
                { horario: 'asc' }
            ]
        });

        return res.json(agendamentos);

    } catch (error) {
        console.error(error);

        if (error?.code === 'P1001') {
            return res.status(503).json({ erro: 'Banco de dados inacessível' });
        }

        return res.status(500).json({ erro: "Erro interno do servidor" });
    }
};

const reservar = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { nome } = req.body;

        if (!nome || nome.trim() === "") {
            return res.status(400).json({ erro: "Nome é obrigatório" });
        }

        const agendamento = await prisma.agendamento.findUnique({
            where: { id }
        });

        if (!agendamento) {
            return res.status(404).json({ erro: "Horário não encontrado" });
        }

        if (agendamento.ocupado) {
            return res.status(400).json({ erro: "Horário já está reservado" });
        }

        const atualizado = await prisma.agendamento.update({
            where: { id },
            data: {
                nome: nome.trim(),
                ocupado: true
            }
        });

        return res.status(200).json(atualizado);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ erro: "Erro ao reservar horário" });
    }
};

const liberar = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const atualizado = await prisma.agendamento.update({
            where: { id },
            data: {
                nome: null,
                ocupado: false
            }
        });

        return res.status(200).json(atualizado);

    } catch (error) {
        console.error(error);
        return res.status(400).json({ erro: "Erro ao liberar horário" });
    }
};

module.exports = {
    read,
    reservar,
    liberar
};
