import conexao from '../config/conexao.js'

const Terminologia = conexao.Schema({
    termo: { type: String, required: true },
    definicao: { type: String, required: true },
    categoria: { type: String }, // opcional: area ou fonte
})

export default conexao.model('Terminologia', Terminologia)
