import conexao from '../config/conexao.js'

const Nota = conexao.Schema({
    usuario: { type: String },
    conteudo: { type: String, required: true },
    data: { type: Date, default: Date.now }
})

export default conexao.model('Nota', Nota)
