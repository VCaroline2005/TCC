import conexao from '../config/conexao.js'

const Terminologia = conexao.Schema({
    termo: { type: String, required: true },
    definicao: { type: String, required: true },
    categoria: { type: String }, 
    publicado: { type: Boolean, default: false },
    publicadoEm: { type: Date },
})

export default conexao.model('Terminologia', Terminologia)
