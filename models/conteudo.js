import conexao from '../config/conexao.js'

const ConteudoSchema = conexao.Schema({
    usuario: { type: String, required: true },
    titulo: { type: String, required: true },
    categoria: { type: String },
    descricao: { type: String },
    arquivoNome: { type: String, required: true },
    arquivoOriginal: { type: String, required: true },
    mimeType: { type: String },
    tamanho: { type: Number },
    criadoEm: { type: Date, default: Date.now }
})

export default conexao.model('Conteudo', ConteudoSchema)
