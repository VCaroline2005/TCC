import conexao from '../config/conexao.js'

const Medicamento = conexao.Schema({
    principioAtivo: { type: String },
    nomeComercial: { type: String },
    classe: { type: String },
    via: { type: String },
    diluicao: { type: String },
    detalhes: { type: String },

    // compatibilidade com telas antigas
    nome: { type: String },
    descricao: { type: String },
    dosagem: { type: String },
    fabricante: { type: String },

    fotos: [{ type: String }],

    publicado: {
        type: Boolean,
        default: false
    },

    publicadoEm: {
        type: Date,
        default: null
    }
})

export default conexao.model('Medicamento', Medicamento)