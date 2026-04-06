import conexao from '../config/conexao.js'

const Quiz = conexao.Schema({
    usuario: { type: String, index: true },
    pergunta: { type: String, required: true },
    opcoes: [{ type: String }],
    correta: { type: Number, required: true }, // índice da opção correta
    categoria: { type: String },
    publicado: { type: Boolean, default: false },
    publicadoEm: { type: Date },
})

export default conexao.model('Quiz', Quiz)
