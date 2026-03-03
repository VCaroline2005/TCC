import conexao from '../config/conexao.js'

const Lembrete = conexao.Schema({
    usuario: { type: String },
    conteudo: { type: String, required: true },
    vencimento: { type: Date }
})

export default conexao.model('Lembrete', Lembrete)
