import conexao from '../config/conexao.js'

const Medicamento = conexao.Schema({
    nome: {type:String, required:true},
    descricao: {type:String},
    dosagem: {type:String},
    via: {type:String},
    fabricante: {type:String},
    fotos: [{type:String}],
})

export default conexao.model('Medicamento',Medicamento)
