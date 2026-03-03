import conexao from '../config/conexao.js'

const ProcedimentoSchema = conexao.Schema({
    nome: {type:String, required:true},
    descricao: {type:String},
    categoria: {type:String},
    passos: [{type:String}],
    fotos: [{type:String}],
})

export default conexao.model('Procedimento',ProcedimentoSchema)