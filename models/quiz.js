import conexao from '../config/conexao.js'

const Quiz = conexao.Schema({
    pergunta: { type: String, required: true },
    opcoes: [{ type: String }],
    correta: { type: Number, required: true }, // índice da opção correta
    categoria: { type: String },
})

export default conexao.model('Quiz', Quiz)
