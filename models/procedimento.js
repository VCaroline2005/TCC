import conexao from '../config/conexao.js'

const ProcedimentoSchema = conexao.Schema({
    nome: {type:String, required:true},
    descricao: {type:String},
    categoria: {type:String},
    passos: [{type:String}],
    fotos: [{type:String}],
    popPdfNome: { type: String },
    popPdfOriginal: { type: String },
    popPdfMimeType: { type: String },
    popPdfTamanho: { type: Number },
    publicado: {type:Boolean, default:false},
    publicadoEm: {type:Date},
})

export default conexao.model('Procedimento',ProcedimentoSchema)
