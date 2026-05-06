import conexao from '../config/conexao.js'

const Quiz = conexao.Schema({
    usuario: { type: String, index: true },

    pergunta: { type: String, required: true },
    opcoes: [{ type: String }],
    correta: { type: Number, required: true },

    categoria: { type: String },

    publicado: { type: Boolean, default: false },
    publicadoEm: { type: Date },

    // 🔴 NOVO CAMPO (ESSENCIAL)
    tipo: {
        type: String,
        enum: ['admin', 'ia'],
        default: 'admin'
    }
})

export default conexao.model('Quiz', Quiz)